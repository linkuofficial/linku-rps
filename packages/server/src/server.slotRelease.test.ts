import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { ServerMessage } from '@rps/shared';

// RECONNECT_GRACE_MS is read once at module load, so it must be overridden
// before `./server` is imported. Using a dynamic import (not hoisted, unlike a
// static `import`) lets this env assignment run first.
process.env.RECONNECT_GRACE_MS = '150';

let server: import('http').Server;
let wsBaseUrl = '';

beforeAll(async () => {
    const mod = await import('./server.js');
    server = mod.server;

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
        server.close((err) => (err ? reject(err) : resolve()));
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

async function closeClient(ws: WebSocket) {
    if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) return;
    const closed = new Promise<void>((resolve) => ws.once('close', () => resolve()));
    ws.close();
    await Promise.race([closed, wait(1500)]);
}

describe('room B-slot release after the reconnect grace period', () => {
    it('keeps the room full until the grace period elapses, then lets a new player join', async () => {
        const host = await openClient();
        const createdPromise = waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'room_created' }> => msg.type === 'room_created');
        host.send(JSON.stringify({ type: 'create_room', bestOf: 1, tool: 'rps' }));
        const created = await createdPromise;

        const guest = await openClient();
        const joinedPromise = waitForMessage(guest, (msg): msg is Extract<ServerMessage, { type: 'joined' }> => msg.type === 'joined');
        const gameStartPromise = waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'game_start' }> => msg.type === 'game_start');
        guest.send(JSON.stringify({ type: 'join_room', roomId: created.roomId }));
        await Promise.all([joinedPromise, gameStartPromise]);

        // B leaves for good and never reconnects.
        const opponentLeftPromise = waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'opponent_left' }> => msg.type === 'opponent_left');
        await closeClient(guest);
        await opponentLeftPromise;

        // Immediately after: the slot hasn't been released yet, room is still "full".
        const tooSoon = await openClient();
        const fullErrorPromise = waitForMessage(
            tooSoon,
            (msg): msg is Extract<ServerMessage, { type: 'error' }> => msg.type === 'error' && msg.code === 'room_full',
        );
        tooSoon.send(JSON.stringify({ type: 'join_room', roomId: created.roomId }));
        const fullError = await fullErrorPromise;
        expect(fullError.code).toBe('room_full');
        await closeClient(tooSoon);

        // Wait past the (test-shortened) grace period for the slot to release.
        await wait(500);

        const newGuest = await openClient();
        const newJoinedPromise = waitForMessage(newGuest, (msg): msg is Extract<ServerMessage, { type: 'joined' }> => msg.type === 'joined');
        newGuest.send(JSON.stringify({ type: 'join_room', roomId: created.roomId }));
        const newJoined = await newJoinedPromise;
        expect(newJoined.roomId).toBe(created.roomId);

        // A never left; the room and A's connection are untouched by the release.
        expect(host.readyState).toBe(WebSocket.OPEN);

        await closeClient(host);
        await closeClient(newGuest);
    }, 10000);

    it('never matches a null reconnectToken against a released slot', async () => {
        const host = await openClient();
        const createdPromise = waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'room_created' }> => msg.type === 'room_created');
        host.send(JSON.stringify({ type: 'create_room', bestOf: 1, tool: 'rps' }));
        const created = await createdPromise;

        const guest = await openClient();
        const joinedPromise = waitForMessage(guest, (msg): msg is Extract<ServerMessage, { type: 'joined' }> => msg.type === 'joined');
        guest.send(JSON.stringify({ type: 'join_room', roomId: created.roomId }));
        await joinedPromise;

        const opponentLeftPromise = waitForMessage(host, (msg): msg is Extract<ServerMessage, { type: 'opponent_left' }> => msg.type === 'opponent_left');
        await closeClient(guest);
        await opponentLeftPromise;

        // Wait past the grace period so tokens.b becomes null on the server.
        await wait(500);

        // A null reconnectToken must not be treated as an authenticated reconnect
        // into the now-empty B slot.
        const client = await openClient();
        const authFailedPromise = waitForMessage(
            client,
            (msg): msg is Extract<ServerMessage, { type: 'error' }> => msg.type === 'error' && msg.code === 'reconnect_auth_failed',
        );
        client.send(JSON.stringify({ type: 'reconnect', roomId: created.roomId, reconnectToken: null }));
        const authFailed = await authFailedPromise;
        expect(authFailed.code).toBe('reconnect_auth_failed');

        await closeClient(client);
        await closeClient(host);
    }, 10000);
});
