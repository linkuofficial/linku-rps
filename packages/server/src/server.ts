import express, { type Request } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import {
    getInvalidGameStateMessage,
    getMessageRateBucket,
    getMessageRateLimitPerSecond,
    type MessageRateBucket,
} from './messagePolicy.js';
import { isRateLimited } from './rateLimit.js';
import { validateClientPayload } from './payloadGuard.js';
import {
    type Choice,
    type CoinFace,
    type DrawMode,
    type ErrorCode,
    type InvalidGameStateReason,
    type PlayerSlot,
    type ReactionMode,
    type ReactionPhase,
    type RoundResult,
    type ServerMessage,
    type ToolId,
    type WheelOption,
    BEATS,
    VALID_CHOICES,
    createRoomCode,
} from '@rps/shared';

export const app = express();
export const server = http.createServer(app);

const ALLOWED_ORIGINS = (
    process.env.ALLOWED_ORIGINS ||
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,https://rps.linku.tech'
)
    .split(',')
    .map((s) => s.trim());

// Overridable via env for tests only; production always falls back to 30000.
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS) || 30000;
const WS_HEARTBEAT_INTERVAL_MS = 25000;
const WS_MAX_PAYLOAD_BYTES = 16 * 1024;
const EXPORT_ADMIN_KEY = process.env.EXPORT_ADMIN_KEY?.trim() || null;
const F1_LIGHT_STEP_MS = 1000;
const F1_LIGHT_COUNT = 5;
const F1_FULL_LIGHT_HOLD_MIN_MS = 200;
const F1_FULL_LIGHT_HOLD_MAX_MS = 2000;
const TARGET_COUNTDOWN_MIN_MS = 1200;
const TARGET_COUNTDOWN_SPAN_MS = 2600;
const TOOL_IDS: ToolId[] = ['rps', 'coin', 'dice', 'wheel', 'draw', 'reaction'];
const PROCESS_STARTED_AT = Date.now();

export const wss = new WebSocketServer({
    server,
    maxPayload: WS_MAX_PAYLOAD_BYTES,
    verifyClient: ({ origin }, done) => {
        if (!origin) return done(true);
        if (ALLOWED_ORIGINS.includes(origin)) return done(true);
        logStructured('warn', 'ws.origin_rejected', { origin });
        done(false, 403, 'Forbidden origin');
    },
});

interface RoomHistoryEvent {
    timestamp: number;
    roomId: string;
    tool: ToolId;
    event: string;
    round: number;
    actor: PlayerSlot | 'system';
    result: string;
    scoreA: number | null;
    scoreB: number | null;
    details: string;
}

interface Room {
    a: WebSocket | null;
    b: WebSocket | null;
    tokens: { a: string; b: string | null };
    disconnectedAt: { a: number | null; b: number | null };
    choices: { a?: Choice; b?: Choice };
    score: { a: number; b: number };
    bestOf: number;
    round: number;
    chatTimestamps: { a: number[]; b: number[] };
    emojiTimestamps: { a: number[]; b: number[] };
    winner: PlayerSlot | null;
    tool: ToolId;
    rematchRequested: { a: boolean; b: boolean };
    reactionSession: {
        phase: ReactionPhase;
        mode: ReactionMode;
        targetCentis: number | null;
        ready: Record<PlayerSlot, boolean>;
        greenAt: number | null;
        countdownMs: number | null;
        presses: Partial<Record<PlayerSlot, number>>;
        falseStartBy: PlayerSlot | null;
        timer: ReturnType<typeof setTimeout> | null;
    } | null;
    drawSession: { sourceKey: string; remaining: string[] } | null;
    pendingDiceRoll: { slot: PlayerSlot; values: number[]; total: number; count: number; sides: number } | null;
    lastResultMsg: ServerMessage | null;
    history: RoomHistoryEvent[];
    cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const rooms: Record<string, Room> = {};

interface RuntimeMetrics {
    wsConnectionsOpened: number;
    wsConnectionsClosed: number;
    wsMessagesReceived: number;
    wsRateLimitedCloses: number;
    wsRateLimitedRejected: number;
    wsInvalidJsonMessages: number;
    wsInvalidShapeMessages: number;
    wsErrorEvents: number;
    roomCreated: number;
    roomJoined: number;
    reconnectOk: number;
    exportCsvSuccess: number;
    exportCsvForbidden: number;
    totalErrorsSent: number;
}

const runtimeMetrics: RuntimeMetrics = {
    wsConnectionsOpened: 0,
    wsConnectionsClosed: 0,
    wsMessagesReceived: 0,
    wsRateLimitedCloses: 0,
    wsRateLimitedRejected: 0,
    wsInvalidJsonMessages: 0,
    wsInvalidShapeMessages: 0,
    wsErrorEvents: 0,
    roomCreated: 0,
    roomJoined: 0,
    reconnectOk: 0,
    exportCsvSuccess: 0,
    exportCsvForbidden: 0,
    totalErrorsSent: 0,
};

function logStructured(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) {
    const payload = {
        ts: new Date().toISOString(),
        level,
        event,
        ...data,
    };
    const line = JSON.stringify(payload);
    if (level === 'error') {
        console.error(line);
        return;
    }
    if (level === 'warn') {
        console.warn(line);
        return;
    }
    console.log(line);
}

function countActiveRooms(): number {
    return Object.values(rooms).filter((room) => !!room.a || !!room.b).length;
}

function sendError(
    ws: WebSocket,
    code: ErrorCode,
    message: string,
    context: Record<string, unknown> = {},
    reason?: InvalidGameStateReason,
) {
    runtimeMetrics.totalErrorsSent += 1;
    logStructured('warn', 'ws.error_sent', { code, message, ...context });
    send(ws, { type: 'error', code, message, reason });
}

function getResult(a: Choice, b: Choice): RoundResult {
    if (a === b) return 'draw';
    return BEATS[a] === b ? 'a_wins' : 'b_wins';
}

function send(ws: WebSocket | null, msg: ServerMessage) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}

function broadcast(room: Room, msg: ServerMessage) {
    send(room.a, msg);
    send(room.b, msg);
}

function getPhase(room: Room): 'waiting' | 'playing' | 'finished' {
    if (room.winner) return 'finished';
    if (!room.a) return 'waiting';
    if (room.tool === 'rps' && !room.b) return 'waiting';
    return 'playing';
}

function supportsSoloPlay(tool: ToolId): boolean {
    return tool !== 'rps';
}

function isGameplayReady(room: Room | undefined): room is Room {
    if (!room || !room.a) return false;
    return supportsSoloPlay(room.tool) || !!room.b;
}

function createRoomId(tool: ToolId): string {
    let roomId = createRoomCode(tool);
    while (rooms[roomId]) {
        roomId = createRoomCode(tool);
    }
    return roomId;
}

function scheduleCleanup(roomId: string, room: Room) {
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
    room.cleanupTimer = setTimeout(() => {
        const current = rooms[roomId];
        if (!current) return;
        if (!current.a && !current.b) {
            delete rooms[roomId];
            return;
        }
        // A is still around but B never reconnected within the grace window: release
        // B's slot instead of leaving the room "full" forever for a guest who isn't
        // coming back. A and the room's game state are untouched; a new player can
        // join_room this same code. (Symmetric A-gone-B-present case is unchanged —
        // there's no "become A" path, so nothing to release there.)
        if (current.a && !current.b && current.tokens.b) {
            current.tokens.b = null;
            current.disconnectedAt.b = null;
        }
        current.cleanupTimer = null;
    }, RECONNECT_GRACE_MS);
}

function clearCleanup(room: Room) {
    if (!room.cleanupTimer) return;
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
}

function csvEscape(value: string | number | null): string {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/\r\n|\r|\n/g, ' ').replace(/"/g, '""');
    // Prevent spreadsheet formula injection (OWASP CSV injection)
    const safe = /^[=+\-@|\t]/.test(text) ? `\t${text}` : text;
    return `"${safe}"`;
}

function toCsv(history: RoomHistoryEvent[]): string {
    const headers = [
        'timestamp_iso',
        'room_id',
        'tool',
        'event',
        'round',
        'actor',
        'result',
        'score_a',
        'score_b',
        'details',
    ];

    const rows = history.map((entry) => [
        new Date(entry.timestamp).toISOString(),
        entry.roomId,
        entry.tool,
        entry.event,
        entry.round,
        entry.actor,
        entry.result,
        entry.scoreA,
        entry.scoreB,
        entry.details,
    ]);

    return [headers, ...rows]
        .map((row) => row.map((value) => csvEscape(value as string | number | null)).join(','))
        .join('\n');
}

function logEvent(roomId: string, room: Room, partial: Omit<RoomHistoryEvent, 'timestamp' | 'roomId' | 'tool'>) {
    room.history.push({
        timestamp: Date.now(),
        roomId,
        tool: room.tool,
        ...partial,
    });
}

function sanitizeWheelOptions(options: WheelOption[]): WheelOption[] {
    return options
        .slice(0, 24)
        .map((opt, i) => ({
            id: String(opt.id || `opt_${i + 1}`),
            label: String(opt.label || '').trim().slice(0, 40),
            color: /^#[0-9a-fA-F]{6}$/.test(String(opt.color || '')) ? String(opt.color) : '#64748b',
            imageUrl:
                /^https?:\/\//.test(String(opt.imageUrl || '')) && String(opt.imageUrl || '').length <= 512
                    ? String(opt.imageUrl)
                    : undefined,
        }))
        .filter((opt) => opt.label.length > 0);
}

function sanitizeNames(names: string[]): string[] {
    const normalized = names
        .slice(0, 200)
        .map((name) => String(name || '').trim().slice(0, 40))
        .filter((name) => name.length > 0);

    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const name of normalized) {
        if (seen.has(name)) continue;
        seen.add(name);
        deduped.push(name);
    }
    return deduped;
}

function shuffled<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function oppositeSlot(slot: PlayerSlot): PlayerSlot {
    return slot === 'a' ? 'b' : 'a';
}

function normalizeReactionMode(value: unknown): ReactionMode {
    return value === 'target' ? 'target' : 'f1';
}

function pickReactionTargetCentis(): number {
    return 80 + Math.floor(Math.random() * 420);
}

function clearReactionTimer(room: Room) {
    if (!room.reactionSession?.timer) return;
    clearTimeout(room.reactionSession.timer);
    room.reactionSession.timer = null;
}

function ensureReactionSession(room: Room) {
    if (room.reactionSession) return room.reactionSession;
    room.reactionSession = {
        phase: 'idle',
        mode: 'f1',
        targetCentis: null,
        ready: { a: false, b: false },
        greenAt: null,
        countdownMs: null,
        presses: {},
        falseStartBy: null,
        timer: null,
    };
    return room.reactionSession;
}

function broadcastReactionState(roomId: string, room: Room, by: PlayerSlot | 'system') {
    const reaction = room.reactionSession;
    if (!reaction) return;
    const readyBy = (['a', 'b'] as PlayerSlot[]).filter((slot) => reaction.ready[slot]);
    const pressedBy = reaction.phase === 'green'
        ? (['a', 'b'] as PlayerSlot[]).filter((slot) => !!reaction.presses[slot])
        : [];
    broadcast(room, {
        type: 'reaction_state',
        phase: reaction.phase,
        mode: reaction.mode,
        targetCentis: reaction.targetCentis,
        readyBy,
        pressedBy,
        countdownMs: reaction.countdownMs,
        greenAt: reaction.greenAt,
        by,
        round: room.round,
        timestamp: Date.now(),
    });
    logEvent(roomId, room, {
        event: 'reaction_state',
        round: room.round,
        actor: by === 'system' ? 'system' : by,
        result: reaction.phase,
        scoreA: room.score.a,
        scoreB: room.score.b,
        details: `mode=${reaction.mode}; target=${reaction.targetCentis ?? 'na'}; ready=${readyBy.join('|') || 'none'}`,
    });
}

function resolveTargetWinner(
    reaction: Room['reactionSession'],
    roomHasOpponent: boolean,
): { winner: PlayerSlot | 'draw'; deltaCentis: { a: number | null; b: number | null } } {
    if (!reaction || !reaction.greenAt || reaction.targetCentis === null) {
        return { winner: 'draw', deltaCentis: { a: null, b: null } };
    }
    const greenAt = reaction.greenAt;
    const targetCentis = reaction.targetCentis;

    const toDelta = (slot: PlayerSlot) => {
        const pressedAt = reaction.presses[slot];
        if (!pressedAt) return null;
        const elapsedCentis = Math.round((pressedAt - greenAt) / 10);
        return Math.abs(elapsedCentis - targetCentis);
    };

    const deltaCentis = { a: toDelta('a'), b: toDelta('b') };

    if (!roomHasOpponent) {
        return { winner: deltaCentis.a === null ? 'draw' : 'a', deltaCentis };
    }
    if (deltaCentis.a === null && deltaCentis.b === null) {
        return { winner: 'draw', deltaCentis };
    }
    if (deltaCentis.a === null) {
        return { winner: 'b', deltaCentis };
    }
    if (deltaCentis.b === null) {
        return { winner: 'a', deltaCentis };
    }
    if (deltaCentis.a === deltaCentis.b) {
        return { winner: 'draw', deltaCentis };
    }
    return { winner: deltaCentis.a < deltaCentis.b ? 'a' : 'b', deltaCentis };
}

function finalizeReactionRound(roomId: string, room: Room, by: PlayerSlot | 'system', winner: PlayerSlot | 'draw', falseStartBy: PlayerSlot | null) {
    const reaction = room.reactionSession;
    if (!reaction) return;
    const greenAt = reaction.greenAt;

    const reactionMs = {
        a: greenAt && reaction.presses.a ? Math.max(0, reaction.presses.a - greenAt) : null,
        b: greenAt && reaction.presses.b ? Math.max(0, reaction.presses.b - greenAt) : null,
    };
    const deltaCentis = reaction.mode === 'target'
        ? {
            a: reactionMs.a === null || reaction.targetCentis === null ? null : Math.abs(Math.round(reactionMs.a / 10) - reaction.targetCentis),
            b: reactionMs.b === null || reaction.targetCentis === null ? null : Math.abs(Math.round(reactionMs.b / 10) - reaction.targetCentis),
        }
        : { a: null, b: null };

    if (winner === 'a') room.score.a += 1;
    if (winner === 'b') room.score.b += 1;

    reaction.phase = 'result';
    reaction.ready = { a: false, b: false };
    reaction.countdownMs = null;
    reaction.greenAt = null;
    clearReactionTimer(room);

    const reactionResultMsg: ServerMessage = {
        type: 'reaction_result',
        mode: reaction.mode,
        targetCentis: reaction.targetCentis,
        deltaCentis,
        winner,
        falseStartBy,
        reactionMs,
        by,
        round: room.round,
        timestamp: Date.now(),
    };
    room.lastResultMsg = reactionResultMsg;
    broadcast(room, reactionResultMsg);

    logEvent(roomId, room, {
        event: 'reaction_result',
        round: room.round,
        actor: by,
        result: winner,
        scoreA: room.score.a,
        scoreB: room.score.b,
        details: `mode=${reaction.mode}; target=${reaction.targetCentis ?? 'na'}; false_start=${falseStartBy ?? 'none'}; a=${reactionMs.a ?? 'na'}; b=${reactionMs.b ?? 'na'}; da=${deltaCentis.a ?? 'na'}; db=${deltaCentis.b ?? 'na'}`,
    });

    reaction.targetCentis = null;
    room.round += 1;
}

function canExportRoomHistory(req: Request, room: Room): boolean {
    const token = String(req.query.token || '').trim();
    if (token && (token === room.tokens.a || token === room.tokens.b)) {
        return true;
    }

    const adminKey = String(req.query.key || '').trim();
    if (EXPORT_ADMIN_KEY && adminKey === EXPORT_ADMIN_KEY) {
        return true;
    }

    return false;
}

app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: Object.keys(rooms).length });
});

app.get('/metrics', (_req, res) => {
    const uptimeSec = Math.max(1, Math.floor((Date.now() - PROCESS_STARTED_AT) / 1000));
    const errorsPerMinute = Number(((runtimeMetrics.totalErrorsSent / uptimeSec) * 60).toFixed(4));

    res.json({
        ok: true,
        uptimeSec,
        wsActiveConnections: wss.clients.size,
        roomsTotal: Object.keys(rooms).length,
        roomsActive: countActiveRooms(),
        errorsPerMinute,
        counters: runtimeMetrics,
    });
});

app.get('/export/:roomId.csv', (req, res) => {
    const roomId = String(req.params.roomId || '').toUpperCase();
    const room = rooms[roomId];
    if (!room) {
        res.status(404).json({ ok: false, message: 'room not found' });
        return;
    }

    if (!canExportRoomHistory(req, room)) {
        runtimeMetrics.exportCsvForbidden += 1;
        logStructured('warn', 'http.export_csv_forbidden', { roomId });
        res.status(403).json({ ok: false, message: 'forbidden' });
        return;
    }

    runtimeMetrics.exportCsvSuccess += 1;
    logStructured('info', 'http.export_csv_success', { roomId, rows: room.history.length });
    const csv = toCsv(room.history);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${roomId}-history.csv"`);
    res.send(csv);
});

wss.on('connection', (ws) => {
    runtimeMetrics.wsConnectionsOpened += 1;
    logStructured('info', 'ws.connection_opened', {
        activeConnections: wss.clients.size,
        roomsActive: countActiveRooms(),
    });

    let roomId: string | null = null;
    let playerSlot: PlayerSlot | null = null;
    let isAlive = true;
    const messageRateTimestamps: Record<MessageRateBucket, number[]> = {
        system: [],
        chat: [],
        reaction: [],
    };

    ws.on('error', (err) => {
        runtimeMetrics.wsErrorEvents += 1;
        logStructured('error', 'ws.connection_error', {
            roomId,
            playerSlot,
            message: err instanceof Error ? err.message : String(err),
        });
    });

    ws.on('pong', () => {
        isAlive = true;
    });

    ws.on('message', (raw) => {
        runtimeMetrics.wsMessagesReceived += 1;
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw.toString());
        } catch {
            runtimeMetrics.wsInvalidJsonMessages += 1;
            logStructured('warn', 'ws.invalid_json', { roomId, playerSlot });
            sendError(ws, 'invalid_json', 'Invalid JSON payload', { roomId, playerSlot });
            return;
        }

        // Valid JSON is not yet a valid message: it can be null, an array, a bare
        // scalar, or an object with a missing/unknown `type`. This check runs before
        // the handler try/catch below, so the envelope must be rejected here — before
        // the rate bucket / handler — rather than assumed safe downstream.
        const validation = validateClientPayload(parsed);
        if (!validation.ok) {
            runtimeMetrics.wsInvalidShapeMessages += 1;
            logStructured('warn', 'ws.invalid_shape', { roomId, playerSlot });
            sendError(ws, 'invalid_message_type', 'Unsupported message type', { roomId, playerSlot });
            return;
        }
        const msg = validation.message;

        const messageRateBucket = getMessageRateBucket(msg.type);
        const messageRateLimit = getMessageRateLimitPerSecond(messageRateBucket);
        if (isRateLimited(messageRateTimestamps[messageRateBucket], messageRateLimit)) {
            if (messageRateBucket === 'system') {
                runtimeMetrics.wsRateLimitedCloses += 1;
                logStructured('warn', 'ws.rate_limit_exceeded_close', { roomId, playerSlot, messageRateBucket });
                ws.close(1008, 'Rate limit exceeded');
                return;
            }

            runtimeMetrics.wsRateLimitedRejected += 1;
            sendError(ws, 'invalid_game_state', getInvalidGameStateMessage('rate_limit_exceeded'), {
                roomId,
                playerSlot,
                messageRateBucket,
            }, 'rate_limit_exceeded');
            return;
        }
        messageRateTimestamps[messageRateBucket].push(Date.now());

        const invalidGameState = (reason: InvalidGameStateReason) => {
            sendError(ws, 'invalid_game_state', getInvalidGameStateMessage(reason), {
                roomId,
                playerSlot,
                msgType: msg.type,
                reason,
            }, reason);
        };

        // A valid-JSON message can still be malformed in shape (e.g. join_room with no
        // roomId, wheel_spin with no options). Those would throw inside the switch and the
        // exception would escape the ws 'message' listener to uncaughtException, taking the
        // whole server (every active room) down. Contain handler errors per-message instead.
        try {
        switch (msg.type) {
            case 'create_room': {
                // Detach this WebSocket from any previously owned room slot to prevent
                // stale room.a/b references that would never get cleaned up.
                if (roomId !== null && playerSlot !== null) {
                    const prevRoom = rooms[roomId];
                    if (prevRoom?.[playerSlot] === ws) {
                        prevRoom[playerSlot] = null;
                        prevRoom.disconnectedAt[playerSlot] = Date.now();
                        if (!prevRoom.a && !prevRoom.b) scheduleCleanup(roomId, prevRoom);
                    }
                }
                const bestOf = [1, 3, 5, 7].includes(msg.bestOf) ? msg.bestOf : 3;
                const tool = TOOL_IDS.includes(msg.tool) ? msg.tool : 'rps';
                const newRoomId = createRoomId(tool);
                const reconnectToken = uuidv4();
                rooms[newRoomId] = {
                    a: ws,
                    b: null,
                    tokens: { a: reconnectToken, b: null },
                    disconnectedAt: { a: null, b: null },
                    choices: {},
                    score: { a: 0, b: 0 },
                    bestOf,
                    round: 1,
                    chatTimestamps: { a: [], b: [] },
                    emojiTimestamps: { a: [], b: [] },
                    winner: null,
                    tool,
                    rematchRequested: { a: false, b: false },
                    reactionSession: null,
                    drawSession: null,
                    pendingDiceRoll: null,
                    lastResultMsg: null,
                    history: [],
                    cleanupTimer: null,
                };
                logEvent(newRoomId, rooms[newRoomId], {
                    event: 'room_created',
                    round: 1,
                    actor: 'a',
                    result: 'ok',
                    scoreA: 0,
                    scoreB: 0,
                    details: `bestOf=${bestOf}`,
                });
                roomId = newRoomId;
                playerSlot = 'a';
                runtimeMetrics.roomCreated += 1;
                logStructured('info', 'room.created', { roomId: newRoomId, tool, bestOf });
                send(ws, {
                    type: 'room_created',
                    roomId: newRoomId,
                    bestOf,
                    tool,
                    reconnectToken,
                });
                if (supportsSoloPlay(tool)) {
                    send(ws, {
                        type: 'game_start',
                        you: 'a',
                        bestOf,
                        tool,
                    });
                    logEvent(newRoomId, rooms[newRoomId], {
                        event: 'player_joined',
                        round: 1,
                        actor: 'a',
                        result: 'solo_start',
                        scoreA: 0,
                        scoreB: 0,
                        details: 'solo_game_start',
                    });
                }
                break;
            }

            case 'join_room': {
                // Detach from any previously owned room slot.
                if (roomId !== null && playerSlot !== null) {
                    const prevRoom = rooms[roomId];
                    if (prevRoom?.[playerSlot] === ws) {
                        prevRoom[playerSlot] = null;
                        prevRoom.disconnectedAt[playerSlot] = Date.now();
                        if (!prevRoom.a && !prevRoom.b) scheduleCleanup(roomId, prevRoom);
                    }
                }
                const id = msg.roomId.toUpperCase();
                const room = rooms[id];
                if (!room) {
                    sendError(ws, 'room_not_found', 'Room not found', { roomId: id });
                    return;
                }
                if (room.tokens.b) {
                    sendError(ws, 'room_full', 'Room is full', { roomId: id });
                    return;
                }

                const reconnectToken = uuidv4();
                room.b = ws;
                room.tokens.b = reconnectToken;
                room.disconnectedAt.b = null;
                clearCleanup(room);

                roomId = id;
                playerSlot = 'b';
                runtimeMetrics.roomJoined += 1;
                logStructured('info', 'room.joined', { roomId: id, tool: room.tool });

                send(ws, {
                    type: 'joined',
                    roomId: id,
                    bestOf: room.bestOf,
                    tool: room.tool,
                    reconnectToken,
                });
                // For RPS, player A was waiting — send game_start to begin the match.
                // For solo-capable tools, player A already received game_start on room
                // creation; re-sending it would reset an in-progress session.
                if (room.tool === 'rps') {
                    send(room.a, {
                        type: 'game_start',
                        you: 'a',
                        bestOf: room.bestOf,
                        tool: room.tool,
                    });
                }
                send(room.b, {
                    type: 'game_start',
                    you: 'b',
                    bestOf: room.bestOf,
                    tool: room.tool,
                });
                logEvent(id, room, {
                    event: 'player_joined',
                    round: room.round,
                    actor: 'b',
                    result: 'ok',
                    scoreA: room.score.a,
                    scoreB: room.score.b,
                    details: 'game_start',
                });
                break;
            }

            case 'reconnect': {
                const id = msg.roomId.toUpperCase();
                const room = rooms[id];
                if (!room) {
                    sendError(ws, 'room_no_longer_exists', 'Room no longer exists', { roomId: id });
                    return;
                }

                // `tokens.b` can be null after a released slot (see scheduleCleanup); guard
                // both sides with a truthiness check so an empty/absent token is never
                // treated as a match, regardless of what a client sends.
                let slot: PlayerSlot | null = null;
                if (room.tokens.a && room.tokens.a === msg.reconnectToken) slot = 'a';
                if (room.tokens.b && room.tokens.b === msg.reconnectToken) slot = 'b';
                if (!slot) {
                    sendError(ws, 'reconnect_auth_failed', 'Reconnect authentication failed', { roomId: id });
                    return;
                }

                const currentWs = room[slot];
                if (currentWs && currentWs !== ws) {
                    try {
                        currentWs.close();
                    } catch {
                        // ignore
                    }
                }

                room[slot] = ws;
                room.disconnectedAt[slot] = null;
                clearCleanup(room);

                roomId = id;
                playerSlot = slot;
                runtimeMetrics.reconnectOk += 1;
                logStructured('info', 'room.reconnect_ok', { roomId: id, slot });

                const opponentSlot: PlayerSlot = slot === 'a' ? 'b' : 'a';
                send(ws, {
                    type: 'reconnect_ok',
                    roomId: id,
                    bestOf: room.bestOf,
                    tool: room.tool,
                    you: slot,
                    phase: getPhase(room),
                    score: { ...room.score },
                    round: room.round,
                    winner: room.winner,
                    opponentReady: !!room.choices[opponentSlot],
                    myChoiceSubmitted: !!room.choices[slot],
                    reconnectToken: slot === 'a' ? room.tokens.a : room.tokens.b!,
                });

                send(room[opponentSlot], {
                    type: 'rematch_status',
                    requestedBy: (['a', 'b'] as PlayerSlot[]).filter((s) => room.rematchRequested[s]),
                });
                if (room.tool === 'reaction' && room.reactionSession) {
                    broadcastReactionState(id, room, slot);
                }
                // Re-send the last game result so the reconnecting player's screen
                // isn't blank (e.g. after a coin flip, dice roll, wheel spin, etc.).
                if (room.lastResultMsg) {
                    send(ws, room.lastResultMsg);
                }
                logEvent(id, room, {
                    event: 'player_reconnected',
                    round: room.round,
                    actor: slot,
                    result: 'ok',
                    scoreA: room.score.a,
                    scoreB: room.score.b,
                    details: `phase=${getPhase(room)}`,
                });
                break;
            }

            case 'choice': {
                if (!roomId || !playerSlot) {
                    sendError(ws, 'not_authenticated', 'Join or create a room first', { roomId, playerSlot });
                    return;
                }
                const room = rooms[roomId];
                if (!isGameplayReady(room) || !room.b) {
                    invalidGameState('room_not_ready');
                    return;
                }
                if (room.winner) {
                    invalidGameState('game_already_finished');
                    return;
                }
                if (room.tool !== 'rps') {
                    invalidGameState('choice_tool_mismatch');
                    return;
                }
                if (!VALID_CHOICES.includes(msg.choice)) {
                    invalidGameState('choice_invalid_value');
                    return;
                }

                room.choices[playerSlot] = msg.choice;

                if (room.choices.a && room.choices.b) {
                    const choiceA = room.choices.a;
                    const choiceB = room.choices.b;

                    const result = getResult(choiceA, choiceB);
                    if (result === 'a_wins') room.score.a++;
                    else if (result === 'b_wins') room.score.b++;

                    const roundMsg: ServerMessage = { type: 'round_result', choices: { a: choiceA, b: choiceB }, result, score: { ...room.score }, round: room.round };
                    room.lastResultMsg = roundMsg;
                    broadcast(room, roundMsg);
                    logEvent(roomId, room, {
                        event: 'rps_round',
                        round: room.round,
                        actor: playerSlot,
                        result,
                        scoreA: room.score.a,
                        scoreB: room.score.b,
                        details: `${choiceA} vs ${choiceB}`,
                    });

                    room.round++;
                    room.choices = {};

                    const winsNeeded = Math.ceil(room.bestOf / 2);
                    if (room.score.a >= winsNeeded || room.score.b >= winsNeeded) {
                        const winner: PlayerSlot = room.score.a >= winsNeeded ? 'a' : 'b';
                        room.winner = winner;
                        room.rematchRequested = { a: false, b: false };
                        broadcast(room, { type: 'game_over', winner, finalScore: { ...room.score } });
                        logEvent(roomId, room, {
                            event: 'game_over',
                            round: room.round,
                            actor: winner,
                            result: winner,
                            scoreA: room.score.a,
                            scoreB: room.score.b,
                            details: 'rps',
                        });
                    }
                } else {
                    const other = playerSlot === 'a' ? room.b : room.a;
                    send(other, { type: 'opponent_ready' });
                }
                break;
            }

            case 'coin_flip': {
                if (!roomId || !playerSlot) {
                    sendError(ws, 'not_authenticated', 'Join or create a room first', { roomId, playerSlot });
                    return;
                }
                const room = rooms[roomId];
                if (!isGameplayReady(room)) {
                    invalidGameState('room_not_ready');
                    return;
                }
                if (room.tool !== 'coin') {
                    invalidGameState('coin_tool_mismatch');
                    return;
                }

                const result: CoinFace = Math.random() < 0.5 ? 'heads' : 'tails';
                const coinMsg: ServerMessage = { type: 'coin_result', result, by: playerSlot, round: room.round, timestamp: Date.now() };
                room.lastResultMsg = coinMsg;
                broadcast(room, coinMsg);
                logEvent(roomId, room, {
                    event: 'coin_flip',
                    round: room.round,
                    actor: playerSlot,
                    result,
                    scoreA: null,
                    scoreB: null,
                    details: result,
                });
                room.round++;
                break;
            }

            case 'dice_roll': {
                if (!roomId || !playerSlot) {
                    sendError(ws, 'not_authenticated', 'Join or create a room first', { roomId, playerSlot });
                    return;
                }
                const room = rooms[roomId];
                if (!isGameplayReady(room)) {
                    invalidGameState('room_not_ready');
                    return;
                }
                if (room.tool !== 'dice') {
                    invalidGameState('dice_tool_mismatch');
                    return;
                }

                const count = Number.isInteger(msg.count) ? msg.count : 1;
                const sides = Number.isInteger(msg.sides) ? msg.sides : 6;
                if (count < 1 || count > 20) {
                    invalidGameState('dice_count_out_of_range');
                    return;
                }
                if (sides < 2 || sides > 1000) {
                    invalidGameState('dice_sides_out_of_range');
                    return;
                }

                const values = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
                const total = values.reduce((acc, n) => acc + n, 0);

                // Solo mode: broadcast immediately
                if (!room.b) {
                    const diceMsg: ServerMessage = { type: 'dice_result', values, total, count, sides, by: playerSlot, round: room.round, timestamp: Date.now() };
                    room.lastResultMsg = diceMsg;
                    broadcast(room, diceMsg);
                    logEvent(roomId, room, {
                        event: 'dice_roll',
                        round: room.round,
                        actor: playerSlot,
                        result: String(total),
                        scoreA: null,
                        scoreB: null,
                        details: `${count}d${sides} => [${values.join(',')}]`,
                    });
                    room.round++;
                    break;
                }

                // Duel mode: wait for both players to roll
                if (room.pendingDiceRoll && room.pendingDiceRoll.slot === playerSlot) {
                    // Same player re-rolling before opponent: overwrite
                    room.pendingDiceRoll = { slot: playerSlot, values, total, count, sides };
                    break;
                }

                if (!room.pendingDiceRoll) {
                    // First player rolls: store and wait
                    room.pendingDiceRoll = { slot: playerSlot, values, total, count, sides };
                    break;
                }

                // Second player rolled: resolve duel
                const first = room.pendingDiceRoll;
                const second = { slot: playerSlot, values, total, count, sides };
                const aRoll = first.slot === 'a' ? first : second;
                const bRoll = first.slot === 'a' ? second : first;

                const winner: PlayerSlot | 'draw' = aRoll.total > bRoll.total ? 'a' : bRoll.total > aRoll.total ? 'b' : 'draw';
                if (winner === 'a') room.score.a++;
                else if (winner === 'b') room.score.b++;

                const duelMsg: ServerMessage = {
                    type: 'dice_duel_result',
                    a: { values: aRoll.values, total: aRoll.total, count: aRoll.count, sides: aRoll.sides },
                    b: { values: bRoll.values, total: bRoll.total, count: bRoll.count, sides: bRoll.sides },
                    winner,
                    round: room.round,
                    timestamp: Date.now(),
                };
                room.lastResultMsg = duelMsg;
                room.pendingDiceRoll = null;
                broadcast(room, duelMsg);
                logEvent(roomId, room, {
                    event: 'dice_roll',
                    round: room.round,
                    actor: playerSlot,
                    result: winner === 'draw' ? 'draw' : `${winner}_wins`,
                    scoreA: room.score.a,
                    scoreB: room.score.b,
                    details: `A:${aRoll.count}d${aRoll.sides}=${aRoll.total} B:${bRoll.count}d${bRoll.sides}=${bRoll.total}`,
                });
                room.round++;
                break;
            }

            case 'wheel_spin': {
                if (!roomId || !playerSlot) {
                    sendError(ws, 'not_authenticated', 'Join or create a room first', { roomId, playerSlot });
                    return;
                }
                const room = rooms[roomId];
                if (!isGameplayReady(room)) {
                    invalidGameState('room_not_ready');
                    return;
                }
                if (room.tool !== 'wheel') {
                    invalidGameState('wheel_tool_mismatch');
                    return;
                }

                const options = sanitizeWheelOptions(msg.options);
                if (options.length < 2) {
                    invalidGameState('wheel_requires_two_options');
                    return;
                }

                const selectedIndex = Math.floor(Math.random() * options.length);
                const wheelMsg: ServerMessage = { type: 'wheel_result', options, selectedIndex, by: playerSlot, round: room.round, timestamp: Date.now() };
                room.lastResultMsg = wheelMsg;
                broadcast(room, wheelMsg);
                logEvent(roomId, room, {
                    event: 'wheel_spin',
                    round: room.round,
                    actor: playerSlot,
                    result: options[selectedIndex]?.label || 'unknown',
                    scoreA: null,
                    scoreB: null,
                    details: JSON.stringify(options),
                });
                room.round++;
                break;
            }

            case 'draw_run': {
                if (!roomId || !playerSlot) {
                    sendError(ws, 'not_authenticated', 'Join or create a room first', { roomId, playerSlot });
                    return;
                }
                const room = rooms[roomId];
                if (!isGameplayReady(room)) {
                    invalidGameState('room_not_ready');
                    return;
                }
                if (room.tool !== 'draw') {
                    invalidGameState('draw_tool_mismatch');
                    return;
                }

                const names = sanitizeNames(msg.names);
                if (names.length < 1) {
                    invalidGameState('draw_requires_name');
                    return;
                }

                const mode: DrawMode = msg.mode === 'shuffle' ? 'shuffle' : 'pick';
                const noRepeat = msg.noRepeat === true;
                const sourceNames = names;
                let orderedNames = shuffled(names);
                let pickedName: string | null = null;
                let remainingNames: string[] = [];

                if (mode === 'pick') {
                    if (noRepeat) {
                        const sourceKey = names.join('|');
                        if (!room.drawSession || room.drawSession.sourceKey !== sourceKey || room.drawSession.remaining.length === 0) {
                            room.drawSession = {
                                sourceKey,
                                remaining: [...names],
                            };
                        }

                        const pool = room.drawSession.remaining;
                        const pickIndex = Math.floor(Math.random() * pool.length);
                        pickedName = pool[pickIndex] ?? null;
                        if (pickedName) {
                            pool.splice(pickIndex, 1);
                        }
                        remainingNames = [...pool];
                        orderedNames = shuffled(remainingNames);
                    } else {
                        pickedName = orderedNames[0] ?? null;
                        remainingNames = orderedNames.slice(1);
                    }
                } else {
                    room.drawSession = null;
                }

                const drawMsg: ServerMessage = { type: 'draw_result', mode, noRepeat, sourceNames, orderedNames, pickedName, remainingNames, by: playerSlot, round: room.round, timestamp: Date.now() };
                room.lastResultMsg = drawMsg;
                broadcast(room, drawMsg);
                logEvent(roomId, room, {
                    event: mode === 'pick' ? 'draw_pick' : 'draw_shuffle',
                    round: room.round,
                    actor: playerSlot,
                    result: pickedName ?? 'shuffled',
                    scoreA: null,
                    scoreB: null,
                    details: `${noRepeat ? 'unique' : 'normal'} :: ${orderedNames.join('|')}`,
                });
                room.round++;
                break;
            }

            case 'reaction_ready': {
                if (!roomId || !playerSlot) {
                    sendError(ws, 'not_authenticated', 'Join or create a room first', { roomId, playerSlot });
                    return;
                }
                const room = rooms[roomId];
                if (!isGameplayReady(room)) {
                    invalidGameState('room_not_ready');
                    return;
                }
                if (room.tool !== 'reaction') {
                    invalidGameState('reaction_ready_tool_mismatch');
                    return;
                }

                const reaction = ensureReactionSession(room);
                const shouldReady = msg.ready === true;
                const nextMode = msg.mode ? normalizeReactionMode(msg.mode) : reaction.mode;

                if (reaction.phase === 'countdown' || reaction.phase === 'green') {
                    invalidGameState('reaction_ready_locked');
                    return;
                }

                reaction.mode = nextMode;
                reaction.ready[playerSlot] = shouldReady;
                reaction.phase = 'idle';
                reaction.presses = {};
                reaction.greenAt = null;
                reaction.countdownMs = null;
                reaction.falseStartBy = null;
                reaction.targetCentis = null;

                broadcastReactionState(roomId, room, playerSlot);

                if (reaction.ready.a && (room.b ? reaction.ready.b : true)) {
                    const reactionRoomId = roomId;
                    const delay = reaction.mode === 'f1'
                        ? F1_LIGHT_COUNT * F1_LIGHT_STEP_MS + F1_FULL_LIGHT_HOLD_MIN_MS + Math.floor(Math.random() * (F1_FULL_LIGHT_HOLD_MAX_MS - F1_FULL_LIGHT_HOLD_MIN_MS + 1))
                        : TARGET_COUNTDOWN_MIN_MS + Math.floor(Math.random() * TARGET_COUNTDOWN_SPAN_MS);
                    reaction.phase = 'countdown';
                    reaction.targetCentis = reaction.mode === 'target' ? pickReactionTargetCentis() : null;
                    reaction.countdownMs = delay;
                    reaction.greenAt = Date.now() + delay;

                    broadcastReactionState(roomId, room, 'system');

                    clearReactionTimer(room);
                    reaction.timer = setTimeout(() => {
                        const current = rooms[reactionRoomId];
                        if (!current || current.tool !== 'reaction' || !current.reactionSession) return;
                        if (current.reactionSession.phase !== 'countdown') return;

                        current.reactionSession.phase = 'green';
                        current.reactionSession.countdownMs = 0;
                        broadcastReactionState(reactionRoomId, current, 'system');

                        if (current.reactionSession.mode === 'target') {
                            clearReactionTimer(current);
                            current.reactionSession.timer = setTimeout(() => {
                                const latest = rooms[reactionRoomId];
                                if (!latest || latest.tool !== 'reaction' || !latest.reactionSession) return;
                                if (latest.reactionSession.phase !== 'green' || latest.reactionSession.mode !== 'target') return;

                                const resolved = resolveTargetWinner(latest.reactionSession, !!latest.b);
                                finalizeReactionRound(reactionRoomId, latest, 'system', resolved.winner, null);
                            }, 7000);
                        }
                    }, delay);
                }
                break;
            }

            case 'reaction_press': {
                if (!roomId || !playerSlot) {
                    sendError(ws, 'not_authenticated', 'Join or create a room first', { roomId, playerSlot });
                    return;
                }
                const room = rooms[roomId];
                if (!isGameplayReady(room)) {
                    invalidGameState('room_not_ready');
                    return;
                }
                if (room.tool !== 'reaction' || !room.reactionSession) {
                    invalidGameState('reaction_press_tool_mismatch');
                    return;
                }

                const reaction = room.reactionSession;
                if (reaction.phase === 'result') {
                    invalidGameState('reaction_round_ended');
                    return;
                }

                if (reaction.phase === 'countdown') {
                    reaction.falseStartBy = playerSlot;
                    reaction.presses[playerSlot] = Date.now();
                    finalizeReactionRound(roomId, room, playerSlot, room.b ? oppositeSlot(playerSlot) : 'draw', playerSlot);
                    break;
                }

                if (reaction.phase !== 'green') {
                    invalidGameState('reaction_not_green');
                    return;
                }
                if (reaction.presses[playerSlot]) {
                    invalidGameState('reaction_already_pressed');
                    return;
                }

                const now = Date.now();
                reaction.presses[playerSlot] = now;

                if (reaction.mode === 'target') {
                    if (!room.b) {
                        const resolved = resolveTargetWinner(reaction, false);
                        finalizeReactionRound(roomId, room, playerSlot, resolved.winner, null);
                        break;
                    }

                    const other = oppositeSlot(playerSlot);
                    const otherPressed = reaction.presses[other];
                    if (!otherPressed) {
                        broadcastReactionState(roomId, room, playerSlot);
                        break;
                    }

                    const resolved = resolveTargetWinner(reaction, true);
                    finalizeReactionRound(roomId, room, playerSlot, resolved.winner, null);
                    break;
                }

                if (!room.b) {
                    finalizeReactionRound(roomId, room, playerSlot, playerSlot, null);
                    break;
                }

                const other = oppositeSlot(playerSlot);
                const otherPressed = reaction.presses[other];
                if (!otherPressed) {
                    finalizeReactionRound(roomId, room, playerSlot, playerSlot, null);
                    break;
                }

                const winner = now === otherPressed ? 'draw' : now < otherPressed ? playerSlot : other;
                finalizeReactionRound(roomId, room, playerSlot, winner, null);
                break;
            }

            case 'rematch_request': {
                if (!roomId || !playerSlot) {
                    sendError(ws, 'not_authenticated', 'Join or create a room first', { roomId, playerSlot });
                    return;
                }
                const room = rooms[roomId];
                if (!room || !room.winner || !room.tokens.b) {
                    invalidGameState('rematch_request_invalid_state');
                    return;
                }

                room.rematchRequested[playerSlot] = true;
                send(playerSlot === 'a' ? room.b : room.a, { type: 'rematch_requested', from: playerSlot });

                const requestedBy = (['a', 'b'] as PlayerSlot[]).filter((slot) => room.rematchRequested[slot]);
                broadcast(room, { type: 'rematch_status', requestedBy });

                if (room.rematchRequested.a && room.rematchRequested.b) {
                    clearReactionTimer(room);
                    room.choices = {};
                    room.score = { a: 0, b: 0 };
                    room.round = 1;
                    room.winner = null;
                    room.rematchRequested = { a: false, b: false };
                    room.reactionSession = null;
                    room.drawSession = null;
                    room.lastResultMsg = null;
                    broadcast(room, { type: 'rematch_started', bestOf: room.bestOf });
                    logEvent(roomId, room, {
                        event: 'rematch_started',
                        round: room.round,
                        actor: 'system',
                        result: 'ok',
                        scoreA: room.score.a,
                        scoreB: room.score.b,
                        details: `bestOf=${room.bestOf}`,
                    });
                }
                break;
            }

            case 'rematch_response': {
                if (!roomId || !playerSlot) {
                    sendError(ws, 'not_authenticated', 'Join or create a room first', { roomId, playerSlot });
                    return;
                }
                const room = rooms[roomId];
                if (!room || !room.winner || !room.tokens.b) {
                    invalidGameState('rematch_response_invalid_state');
                    return;
                }

                if (msg.accept) {
                    room.rematchRequested[playerSlot] = true;
                } else {
                    room.rematchRequested = { a: false, b: false };
                }

                const requestedBy = (['a', 'b'] as PlayerSlot[]).filter((slot) => room.rematchRequested[slot]);
                broadcast(room, { type: 'rematch_status', requestedBy });

                if (room.rematchRequested.a && room.rematchRequested.b) {
                    clearReactionTimer(room);
                    room.choices = {};
                    room.score = { a: 0, b: 0 };
                    room.round = 1;
                    room.winner = null;
                    room.rematchRequested = { a: false, b: false };
                    room.reactionSession = null;
                    room.drawSession = null;
                    room.lastResultMsg = null;
                    broadcast(room, { type: 'rematch_started', bestOf: room.bestOf });
                    logEvent(roomId, room, {
                        event: 'rematch_started',
                        round: room.round,
                        actor: 'system',
                        result: 'ok',
                        scoreA: room.score.a,
                        scoreB: room.score.b,
                        details: `bestOf=${room.bestOf}`,
                    });
                }
                break;
            }

            case 'chat': {
                if (!roomId || !playerSlot) {
                    sendError(ws, 'not_authenticated', 'Join or create a room first', { roomId, playerSlot });
                    return;
                }
                const room = rooms[roomId];
                if (!room || !room.a) {
                    invalidGameState('chat_room_not_ready');
                    return;
                }
                const text = String(msg.text || '').trim().slice(0, 100);
                if (!text) {
                    invalidGameState('chat_empty');
                    return;
                }
                if (isRateLimited(room.chatTimestamps[playerSlot])) {
                    invalidGameState('chat_rate_limited');
                    return;
                }
                room.chatTimestamps[playerSlot].push(Date.now());
                broadcast(room, {
                    type: 'chat_broadcast',
                    from: playerSlot,
                    text,
                    timestamp: Date.now(),
                });
                break;
            }

            case 'emoji': {
                if (!roomId || !playerSlot) {
                    sendError(ws, 'not_authenticated', 'Join or create a room first', { roomId, playerSlot });
                    return;
                }
                const room = rooms[roomId];
                if (!room || !room.a) {
                    invalidGameState('emoji_room_not_ready');
                    return;
                }
                const emoji = String(msg.emoji || '');
                const emojiGraphemes = typeof Intl !== 'undefined' && 'Segmenter' in Intl
                    ? [...new Intl.Segmenter().segment(emoji)].length
                    : [...emoji].length;
                if (!emoji || emojiGraphemes > 1) {
                    invalidGameState('emoji_invalid_payload');
                    return;
                }
                if (isRateLimited(room.emojiTimestamps[playerSlot])) {
                    invalidGameState('emoji_rate_limited');
                    return;
                }
                room.emojiTimestamps[playerSlot].push(Date.now());
                broadcast(room, { type: 'emoji_broadcast', from: playerSlot, emoji });
                break;
            }

            default: {
                sendError(ws, 'invalid_message_type', 'Unsupported message type', {
                    roomId,
                    playerSlot,
                    msgType: (msg as { type?: unknown }).type,
                });
                return;
            }
        }
        } catch (handlerErr) {
            logStructured('error', 'ws.handler_threw', {
                roomId,
                playerSlot,
                msgType: msg.type,
                error: handlerErr instanceof Error ? handlerErr.message : String(handlerErr),
            });
            sendError(ws, 'invalid_message_type', 'Malformed message', { roomId, playerSlot });
        }
    });

    const pingInterval = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (!isAlive) {
            ws.terminate();
            return;
        }
        isAlive = false;
        ws.ping();
    }, WS_HEARTBEAT_INTERVAL_MS);

    ws.on('close', () => {
        runtimeMetrics.wsConnectionsClosed += 1;
        clearInterval(pingInterval);

        logStructured('info', 'ws.connection_closed', {
            roomId,
            playerSlot,
            activeConnections: wss.clients.size,
            roomsActive: countActiveRooms(),
        });

        if (!roomId || !playerSlot || !rooms[roomId]) return;

        const room = rooms[roomId];
        if (room[playerSlot] !== ws) return;

        room[playerSlot] = null;
        room.disconnectedAt[playerSlot] = Date.now();

        const otherSlot: PlayerSlot = playerSlot === 'a' ? 'b' : 'a';
        send(room[otherSlot], { type: 'opponent_left' });
        logEvent(roomId, room, {
            event: 'player_disconnected',
            round: room.round,
            actor: playerSlot,
            result: 'left',
            scoreA: room.score.a,
            scoreB: room.score.b,
            details: `grace_ms=${RECONNECT_GRACE_MS}`,
        });

        scheduleCleanup(roomId, room);
    });
});

const PORT = process.env.PORT || 3001;
server.on('error', (err) => {
    logStructured('error', 'http.server_error', {
        message: err instanceof Error ? err.message : String(err),
    });
});

if (process.env.NODE_ENV !== 'test') {
    server.listen(Number(PORT), '0.0.0.0', () => {
        logStructured('info', 'server.started', { port: Number(PORT) });
    });
}
