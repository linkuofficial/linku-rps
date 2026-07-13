import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { ServerMessage, ToolId } from '@rps/shared';
import { server } from './server';

let wsBaseUrl = '';

beforeAll(async () => {
    if (!server.listening) {
        await new Promise<void>((resolve) => {
            server.listen(0, '127.0.0.1', () => resolve());
        });
    }

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to resolve test server address');
    }

    wsBaseUrl = `ws://127.0.0.1:${address.port}`;
});

afterAll(async () => {
    if (!server.listening) return;
    await new Promise<void>((resolve, reject) => {
        server.close((err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
});

function wait(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function openClient(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsBaseUrl);
        ws.once('open', () => resolve(ws));
        ws.once('error', reject);
    });
}

function waitForMessage<T extends ServerMessage>(
    ws: WebSocket,
    predicate: (msg: ServerMessage) => msg is T,
    timeoutMs = 2500,
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('Timed out waiting for websocket message'));
        }, timeoutMs);

        const onMessage = (raw: WebSocket.RawData) => {
            let parsed: ServerMessage;
            try {
                parsed = JSON.parse(String(raw)) as ServerMessage;
            } catch {
                return;
            }
            if (!predicate(parsed)) return;
            cleanup();
            resolve(parsed);
        };

        const onClose = () => {
            cleanup();
            reject(new Error('Socket closed before expected message'));
        };

        const cleanup = () => {
            clearTimeout(timer);
            ws.off('message', onMessage);
            ws.off('close', onClose);
        };

        ws.on('message', onMessage);
        ws.on('close', onClose);
    });
}

function waitForClose(ws: WebSocket, timeoutMs = 2500): Promise<{ code: number; reason: string }> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('Timed out waiting for websocket close'));
        }, timeoutMs);

        const onClose = (code: number, reason: Buffer) => {
            cleanup();
            resolve({ code, reason: reason.toString('utf8') });
        };

        const cleanup = () => {
            clearTimeout(timer);
            ws.off('close', onClose);
        };

        ws.on('close', onClose);
    });
}

async function closeClient(ws: WebSocket) {
    if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) return;
    const closed = waitForClose(ws, 1500).catch(() => null);
    ws.close();
    await closed;
}

async function setupRoom(tool: ToolId) {
    const host = await openClient();
    const guest = await openClient();

    host.send(JSON.stringify({ type: 'create_room', bestOf: 1, tool }));
    const created = await waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'room_created' }> => msg.type === 'room_created');

    guest.send(JSON.stringify({ type: 'join_room', roomId: created.roomId }));
    await waitForMessage(guest, (msg): msg is Extract<ServerMessage, { type: 'joined' }> => msg.type === 'joined');

    return { host, guest, roomId: created.roomId };
}

describe('websocket rate limiting integration', () => {
    it('starts non-rps rooms immediately for solo play', async () => {
        const host = await openClient();

        const createdPromise = waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'room_created' }> => msg.type === 'room_created');
        const startedPromise = waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'game_start' }> => msg.type === 'game_start');
        host.send(JSON.stringify({ type: 'create_room', bestOf: 1, tool: 'coin' }));
        const [created, started] = await Promise.all([createdPromise, startedPromise]);

        expect(created.tool).toBe('coin');
        expect(started.tool).toBe('coin');
        expect(started.you).toBe('a');

        host.send(JSON.stringify({ type: 'coin_flip' }));
        const result = await waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'coin_result' }> => msg.type === 'coin_result');
        expect(result.by).toBe('a');

        await closeClient(host);
    });

    // Asserts the full error envelope — not just `type: 'error'` — and that it never
    // carries the raw exception message or a stack trace. Runs each payload on its own
    // fresh client so a single bad payload can't be masked by state left over from the
    // previous one, then proves *that same connection* can still create a room right
    // after receiving the error, showing the connection/room machinery is untouched.
    async function expectContainedError(
        payload: string,
        expectedMessage: string,
    ): Promise<void> {
        const client = await openClient();

        const errorPromise = waitForMessage(client, (msg): msg is Extract<ServerMessage, { type: 'error' }> => msg.type === 'error');
        client.send(payload);
        const error = await errorPromise;
        expect(error).toMatchObject({ type: 'error', code: 'invalid_message_type', message: expectedMessage });
        expect(error).not.toHaveProperty('stack');
        expect(JSON.stringify(error)).not.toMatch(/TypeError|at\s+\S+\s+\(/);

        const createdPromise = waitForMessage(client, (msg): msg is Extract<ServerMessage, { type: 'room_created' }> => msg.type === 'room_created');
        client.send(JSON.stringify({ type: 'create_room', bestOf: 1, tool: 'coin' }));
        const created = await createdPromise;
        expect(created.tool).toBe('coin');

        await closeClient(client);
    }

    it('rejects structurally invalid envelopes with a stable error and stays usable', async () => {
        // Each of these is valid JSON but not a valid message envelope: null, an array,
        // a bare scalar, or an object with a missing/unknown `type`. None of these
        // reach the handler switch — the server answers with payloadGuard's fixed
        // message instead.
        const envelopeRejections = [
            'null',
            '"just a string"',
            '42',
            'true',
            '[]',
            '[{"type":"create_room"}]',
            '{}',
            '{"foo":1}',
            '{"type":42}',
            '{"type":"totally_unknown"}',
        ];

        for (const payload of envelopeRejections) {
            await expectContainedError(payload, 'Unsupported message type');
        }
    });

    it('contains handler exceptions for known types with missing/dirty required fields', async () => {
        // These pass the envelope guard (a supported `type`) but are missing or have
        // the wrong type for a field the handler reads unconditionally — e.g. `join_room`
        // calling `msg.roomId.toUpperCase()`. That throw is caught by the per-message
        // try/catch and answered with the handler-level message, distinct from the
        // envelope-guard message above, and still without leaking the exception.
        const handlerThrowPayloads = [
            '{"type":"join_room"}',
            '{"type":"join_room","roomId":null}',
            '{"type":"join_room","roomId":{}}',
        ];

        for (const payload of handlerThrowPayloads) {
            await expectContainedError(payload, 'Malformed message');
        }
    });

    it('rejects dirty choice field values via the existing invalid_game_state error, not a crash', async () => {
        const { host, guest } = await setupRoom('rps');

        // `choice` is a known type inside an active room; these values are wrong-typed
        // rather than throw-inducing, so they should hit the existing
        // `choice_invalid_value` validation, not the outer catch-all.
        const dirtyChoices: unknown[] = [null, {}, 42, 'lizard'];
        for (const choice of dirtyChoices) {
            const errorPromise = waitForMessage(
                host,
                (msg): msg is Extract<ServerMessage, { type: 'error' }> =>
                    msg.type === 'error' && msg.code === 'invalid_game_state' && msg.reason === 'choice_invalid_value',
            );
            host.send(JSON.stringify({ type: 'choice', choice }));
            await errorPromise;
        }

        expect(host.readyState).toBe(WebSocket.OPEN);
        expect(guest.readyState).toBe(WebSocket.OPEN);

        await closeClient(host);
        await closeClient(guest);
    });

    it('ignores a cheat field on choice and resolves by real RPS rules', async () => {
        const { host, guest } = await setupRoom('rps');

        // Player A tries the old backdoor: rock + cheat:true. Under the removed
        // logic the server rewrote A's choice to beat B, forcing an A win. Now the
        // extra field is ignored and rock genuinely loses to paper.
        host.send(JSON.stringify({ type: 'choice', choice: 'rock', cheat: true }));
        guest.send(JSON.stringify({ type: 'choice', choice: 'paper' }));

        const result = await waitForMessage(
            host,
            (msg): msg is Extract<ServerMessage, { type: 'round_result' }> => msg.type === 'round_result',
        );
        expect(result.choices).toEqual({ a: 'rock', b: 'paper' });
        expect(result.result).toBe('b_wins');
        expect(result.score).toEqual({ a: 0, b: 1 });

        await closeClient(host);
        await closeClient(guest);
    });

    it('supports solo reaction rounds after readying up', async () => {
        const host = await openClient();

        const createdPromise = waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'room_created' }> => msg.type === 'room_created');
        const startedPromise = waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'game_start' }> => msg.type === 'game_start');
        host.send(JSON.stringify({ type: 'create_room', bestOf: 1, tool: 'reaction' }));
        await Promise.all([createdPromise, startedPromise]);

        host.send(JSON.stringify({ type: 'reaction_ready', ready: true }));
        const countdown = await waitForMessage(
            host,
            (msg): msg is Extract<ServerMessage, { type: 'reaction_state' }> => msg.type === 'reaction_state' && msg.phase === 'countdown',
        );
        expect(countdown.readyBy).toEqual(['a']);

        const green = await waitForMessage(
            host,
            (msg): msg is Extract<ServerMessage, { type: 'reaction_state' }> => msg.type === 'reaction_state' && msg.phase === 'green',
            10000,
        );
        expect(green.by).toBe('system');

        host.send(JSON.stringify({ type: 'reaction_press' }));
        const result = await waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'reaction_result' }> => msg.type === 'reaction_result');
        expect(result.winner).toBe('a');
        expect(result.reactionMs.a).not.toBeNull();
        expect(result.reactionMs.b).toBeNull();

        await closeClient(host);
    }, 15000);

    it('supports solo target mode and returns target delta payload', async () => {
        const host = await openClient();

        const createdPromise = waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'room_created' }> => msg.type === 'room_created');
        const startedPromise = waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'game_start' }> => msg.type === 'game_start');
        host.send(JSON.stringify({ type: 'create_room', bestOf: 1, tool: 'reaction' }));
        await Promise.all([createdPromise, startedPromise]);

        host.send(JSON.stringify({ type: 'reaction_ready', ready: true, mode: 'target' }));
        const countdown = await waitForMessage(
            host,
            (msg): msg is Extract<ServerMessage, { type: 'reaction_state' }> => msg.type === 'reaction_state' && msg.phase === 'countdown',
        );
        expect(countdown.mode).toBe('target');
        expect(countdown.targetCentis).not.toBeNull();

        await waitForMessage(
            host,
            (msg): msg is Extract<ServerMessage, { type: 'reaction_state' }> => msg.type === 'reaction_state' && msg.phase === 'green' && msg.mode === 'target',
            5000,
        );

        await wait(120);
        host.send(JSON.stringify({ type: 'reaction_press' }));

        const result = await waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'reaction_result' }> => msg.type === 'reaction_result');
        expect(result.mode).toBe('target');
        expect(result.targetCentis).not.toBeNull();
        expect(result.winner).toBe('a');
        expect(result.deltaCentis.a).not.toBeNull();
        expect(result.deltaCentis.b).toBeNull();

        await closeClient(host);
    });

    it('resolves target mode winner by closest timing delta', async () => {
        const { host, guest } = await setupRoom('reaction');

        host.send(JSON.stringify({ type: 'reaction_ready', ready: true, mode: 'target' }));
        guest.send(JSON.stringify({ type: 'reaction_ready', ready: true, mode: 'target' }));

        const countdown = await waitForMessage(
            host,
            (msg): msg is Extract<ServerMessage, { type: 'reaction_state' }> => msg.type === 'reaction_state' && msg.phase === 'countdown',
        );
        expect(countdown.mode).toBe('target');
        expect(countdown.targetCentis).not.toBeNull();

        await waitForMessage(
            host,
            (msg): msg is Extract<ServerMessage, { type: 'reaction_state' }> => msg.type === 'reaction_state' && msg.phase === 'green' && msg.mode === 'target',
            5000,
        );

        host.send(JSON.stringify({ type: 'reaction_press' }));
        await wait(200);
        guest.send(JSON.stringify({ type: 'reaction_press' }));

        const result = await waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'reaction_result' }> => msg.type === 'reaction_result');
        expect(result.mode).toBe('target');
        expect(result.targetCentis).not.toBeNull();
        expect(result.winner).toBe('b');
        expect(result.deltaCentis.a).not.toBeNull();
        expect(result.deltaCentis.b).not.toBeNull();
        expect((result.deltaCentis.b ?? Number.POSITIVE_INFINITY)).toBeLessThan((result.deltaCentis.a ?? Number.POSITIVE_INFINITY));

        await closeClient(host);
        await closeClient(guest);
    });

    it('closes the socket when system bucket limit is exceeded', async () => {
        const ws = await openClient();
        const closePromise = waitForClose(ws);

        for (let i = 0; i < 45; i++) {
            ws.send(JSON.stringify({ type: 'create_room', bestOf: 1, tool: 'rps' }));
        }

        const closed = await closePromise;
        expect(closed.code).toBe(1008);
    });

    it('keeps socket open and returns invalid_game_state for chat bucket over-limit', async () => {
        const { host, guest } = await setupRoom('rps');

        for (let i = 0; i < 20; i++) {
            host.send(JSON.stringify({ type: 'chat', text: `spam-${i}` }));
        }

        const error = await waitForMessage(
            host,
            (msg): msg is Extract<ServerMessage, { type: 'error' }> =>
                msg.type === 'error' && msg.code === 'invalid_game_state' && msg.reason === 'rate_limit_exceeded',
        );

        expect(error.reason).toBe('rate_limit_exceeded');
        await wait(250);
        expect(host.readyState).toBe(WebSocket.OPEN);

        await closeClient(host);
        await closeClient(guest);
    });

    it('keeps socket open and returns invalid_game_state for reaction bucket over-limit', async () => {
        const { host, guest } = await setupRoom('reaction');

        for (let i = 0; i < 25; i++) {
            host.send(JSON.stringify({ type: 'reaction_ready', ready: true }));
        }

        const error = await waitForMessage(
            host,
            (msg): msg is Extract<ServerMessage, { type: 'error' }> =>
                msg.type === 'error' && msg.code === 'invalid_game_state' && msg.reason === 'rate_limit_exceeded',
        );

        expect(error.reason).toBe('rate_limit_exceeded');
        await wait(250);
        expect(host.readyState).toBe(WebSocket.OPEN);

        await closeClient(host);
        await closeClient(guest);
    });
});
