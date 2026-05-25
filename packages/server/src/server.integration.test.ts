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
