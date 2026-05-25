import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import {
    type ClientMessage,
    type Choice,
    type CoinFace,
    type DrawMode,
    type PlayerSlot,
    type RoundResult,
    type ServerMessage,
    type ToolId,
    type WheelOption,
    BEATS,
    VALID_CHOICES,
} from '@rps/shared';

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = (
    process.env.ALLOWED_ORIGINS ||
    'http://localhost:5173,http://127.0.0.1:5173,https://rps.linku.tech'
)
    .split(',')
    .map((s) => s.trim());

const RECONNECT_GRACE_MS = 30000;
const TOOL_IDS: ToolId[] = ['rps', 'coin', 'dice', 'wheel', 'draw', 'vote'];

const wss = new WebSocketServer({
    server,
    verifyClient: ({ origin }, done) => {
        if (!origin) return done(true);
        if (ALLOWED_ORIGINS.includes(origin)) return done(true);
        console.warn('Rejected origin:', origin);
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
    cheatEnabled: boolean;
    chatTimestamps: { a: number[]; b: number[] };
    winner: PlayerSlot | null;
    tool: ToolId;
    rematchRequested: { a: boolean; b: boolean };
    voteSession: { options: string[]; ballots: Partial<Record<PlayerSlot, number>> } | null;
    voteHost: PlayerSlot | null;
    drawSession: { sourceKey: string; remaining: string[] } | null;
    history: RoomHistoryEvent[];
    cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const rooms: Record<string, Room> = {};

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

function isRateLimited(timestamps: number[], maxPerSecond = 3): boolean {
    const now = Date.now();
    const recent = timestamps.filter((t) => now - t < 1000);
    timestamps.length = 0;
    timestamps.push(...recent);
    return recent.length >= maxPerSecond;
}

function getPhase(room: Room): 'waiting' | 'playing' | 'finished' {
    if (room.winner) return 'finished';
    if (!room.b) return 'waiting';
    return 'playing';
}

function createRoomId(): string {
    let roomId = uuidv4().slice(0, 6).toUpperCase();
    while (rooms[roomId]) {
        roomId = uuidv4().slice(0, 6).toUpperCase();
    }
    return roomId;
}

function scheduleCleanup(roomId: string, room: Room) {
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
    room.cleanupTimer = setTimeout(() => {
        const current = rooms[roomId];
        if (!current) return;
        if (current.a || current.b) return;
        delete rooms[roomId];
    }, RECONNECT_GRACE_MS);
}

function clearCleanup(room: Room) {
    if (!room.cleanupTimer) return;
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
}

function csvEscape(value: string | number | null): string {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/"/g, '""');
    return `"${text}"`;
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

function sanitizeVoteOptions(options: string[]): string[] {
    return options
        .slice(0, 20)
        .map((opt) => String(opt || '').trim().slice(0, 60))
        .filter((opt) => opt.length > 0);
}

function shuffled<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function buildVoteSummary(counts: number[]): { finalized: boolean; winnerIndexes: number[] } {
    const maxVotes = Math.max(...counts, 0);
    if (maxVotes <= 0) return { finalized: false, winnerIndexes: [] };
    const winnerIndexes = counts
        .map((count, index) => ({ count, index }))
        .filter((entry) => entry.count === maxVotes)
        .map((entry) => entry.index);
    return { finalized: true, winnerIndexes };
}

app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: Object.keys(rooms).length });
});

app.get('/export/:roomId.csv', (req, res) => {
    const roomId = String(req.params.roomId || '').toUpperCase();
    const room = rooms[roomId];
    if (!room) {
        res.status(404).json({ ok: false, message: 'room not found' });
        return;
    }

    const csv = toCsv(room.history);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${roomId}-history.csv"`);
    res.send(csv);
});

wss.on('connection', (ws) => {
    let roomId: string | null = null;
    let playerSlot: PlayerSlot | null = null;

    ws.on('message', (raw) => {
        let msg: ClientMessage;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return;
        }

        switch (msg.type) {
            case 'create_room': {
                const bestOf = [1, 3, 5, 7].includes(msg.bestOf) ? msg.bestOf : 3;
                const tool = TOOL_IDS.includes(msg.tool) ? msg.tool : 'rps';
                const newRoomId = createRoomId();
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
                    cheatEnabled: false,
                    chatTimestamps: { a: [], b: [] },
                    winner: null,
                    tool,
                    rematchRequested: { a: false, b: false },
                    voteSession: null,
                    voteHost: null,
                    drawSession: null,
                    history: [],
                    cleanupTimer: null,
                };
                logEvent(newRoomId, rooms[newRoomId], {
                    event: 'room_created',
                    round: 0,
                    actor: 'a',
                    result: 'ok',
                    scoreA: 0,
                    scoreB: 0,
                    details: `bestOf=${bestOf}`,
                });
                roomId = newRoomId;
                playerSlot = 'a';
                send(ws, {
                    type: 'room_created',
                    roomId: newRoomId,
                    bestOf,
                    tool,
                    reconnectToken,
                });
                break;
            }

            case 'join_room': {
                const id = msg.roomId.toUpperCase();
                const room = rooms[id];
                if (!room) {
                    send(ws, { type: 'error', message: '找不到房間' });
                    return;
                }
                if (room.tokens.b) {
                    send(ws, { type: 'error', message: '房間已滿' });
                    return;
                }

                const reconnectToken = uuidv4();
                room.b = ws;
                room.tokens.b = reconnectToken;
                room.disconnectedAt.b = null;
                clearCleanup(room);

                roomId = id;
                playerSlot = 'b';

                send(ws, {
                    type: 'joined',
                    roomId: id,
                    bestOf: room.bestOf,
                    tool: room.tool,
                    reconnectToken,
                });
                send(room.a, {
                    type: 'game_start',
                    you: 'a',
                    bestOf: room.bestOf,
                    tool: room.tool,
                });
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
                    send(ws, { type: 'error', message: '房間已不存在' });
                    return;
                }

                let slot: PlayerSlot | null = null;
                if (room.tokens.a === msg.reconnectToken) slot = 'a';
                if (room.tokens.b === msg.reconnectToken) slot = 'b';
                if (!slot) {
                    send(ws, { type: 'error', message: '重連驗證失敗' });
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
                if (!roomId || !playerSlot) return;
                const room = rooms[roomId];
                if (!room || !room.a || !room.b) return;
                if (room.winner) return;
                if (room.tool !== 'rps') return;
                if (!VALID_CHOICES.includes(msg.choice)) return;

                room.choices[playerSlot] = msg.choice;
                const isCheat = msg.cheat === true && playerSlot === 'a';
                if (isCheat) room.cheatEnabled = true;

                if (room.choices.a && room.choices.b) {
                    let choiceA = room.choices.a;
                    const choiceB = room.choices.b;

                    if (room.cheatEnabled) {
                        choiceA = Object.keys(BEATS).find((k) => BEATS[k as Choice] === choiceB) as Choice;
                        room.cheatEnabled = false;
                    }

                    const result = getResult(choiceA, choiceB);
                    if (result === 'a_wins') room.score.a++;
                    else if (result === 'b_wins') room.score.b++;

                    broadcast(room, {
                        type: 'round_result',
                        choices: { a: choiceA, b: choiceB },
                        result,
                        score: { ...room.score },
                        round: room.round,
                    });
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
                if (!roomId || !playerSlot) return;
                const room = rooms[roomId];
                if (!room || !room.a || !room.b) return;
                if (room.tool !== 'coin') return;

                const result: CoinFace = Math.random() < 0.5 ? 'heads' : 'tails';
                broadcast(room, {
                    type: 'coin_result',
                    result,
                    by: playerSlot,
                    round: room.round,
                    timestamp: Date.now(),
                });
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
                if (!roomId || !playerSlot) return;
                const room = rooms[roomId];
                if (!room || !room.a || !room.b) return;
                if (room.tool !== 'dice') return;

                const count = Number.isInteger(msg.count) ? msg.count : 1;
                const sides = Number.isInteger(msg.sides) ? msg.sides : 6;
                if (count < 1 || count > 20) return;
                if (sides < 2 || sides > 1000) return;

                const values = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
                const total = values.reduce((acc, n) => acc + n, 0);

                broadcast(room, {
                    type: 'dice_result',
                    values,
                    total,
                    count,
                    sides,
                    by: playerSlot,
                    round: room.round,
                    timestamp: Date.now(),
                });
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

            case 'wheel_spin': {
                if (!roomId || !playerSlot) return;
                const room = rooms[roomId];
                if (!room || !room.a || !room.b) return;
                if (room.tool !== 'wheel') return;

                const options = sanitizeWheelOptions(msg.options);
                if (options.length < 2) return;

                const selectedIndex = Math.floor(Math.random() * options.length);
                broadcast(room, {
                    type: 'wheel_result',
                    options,
                    selectedIndex,
                    by: playerSlot,
                    round: room.round,
                    timestamp: Date.now(),
                });
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
                if (!roomId || !playerSlot) return;
                const room = rooms[roomId];
                if (!room || !room.a || !room.b) return;
                if (room.tool !== 'draw') return;

                const names = sanitizeNames(msg.names);
                if (names.length < 1) return;

                const mode: DrawMode = msg.mode === 'shuffle' ? 'shuffle' : 'pick';
                const noRepeat = msg.noRepeat === true;
                let sourceNames = names;
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

                broadcast(room, {
                    type: 'draw_result',
                    mode,
                    noRepeat,
                    sourceNames,
                    orderedNames,
                    pickedName,
                    remainingNames,
                    by: playerSlot,
                    round: room.round,
                    timestamp: Date.now(),
                });
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

            case 'vote_start': {
                if (!roomId || !playerSlot) return;
                const room = rooms[roomId];
                if (!room || !room.a || !room.b) return;
                if (room.tool !== 'vote') return;

                if (room.voteHost && room.voteHost !== playerSlot) {
                    send(room[playerSlot], { type: 'error', message: '只有主持人可以重新開票' });
                    return;
                }

                const options = sanitizeVoteOptions(msg.options);
                if (options.length < 2) return;

                if (!room.voteHost) {
                    room.voteHost = playerSlot;
                }
                room.voteSession = { options, ballots: {} };
                const counts = options.map(() => 0);
                broadcast(room, {
                    type: 'vote_update',
                    options,
                    counts,
                    votedBy: [],
                    host: room.voteHost,
                    finalized: false,
                    winnerIndexes: [],
                    by: playerSlot,
                    round: room.round,
                    timestamp: Date.now(),
                });
                logEvent(roomId, room, {
                    event: 'vote_start',
                    round: room.round,
                    actor: playerSlot,
                    result: 'ok',
                    scoreA: null,
                    scoreB: null,
                    details: options.join('|'),
                });
                break;
            }

            case 'vote_cast': {
                if (!roomId || !playerSlot) return;
                const room = rooms[roomId];
                if (!room || !room.a || !room.b) return;
                if (room.tool !== 'vote') return;
                if (!room.voteSession) return;

                const index = Number(msg.index);
                if (!Number.isInteger(index)) return;
                if (index < 0 || index >= room.voteSession.options.length) return;

                room.voteSession.ballots[playerSlot] = index;
                const counts = room.voteSession.options.map((_, i) =>
                    (['a', 'b'] as PlayerSlot[]).reduce(
                        (sum, slot) => sum + (room.voteSession?.ballots[slot] === i ? 1 : 0),
                        0
                    )
                );
                const votedBy = (['a', 'b'] as PlayerSlot[]).filter((slot) => room.voteSession?.ballots[slot] !== undefined);
                const autoFinalize = votedBy.length === 2;
                const summary = autoFinalize ? buildVoteSummary(counts) : { finalized: false, winnerIndexes: [] };

                broadcast(room, {
                    type: 'vote_update',
                    options: room.voteSession.options,
                    counts,
                    votedBy,
                    host: room.voteHost ?? playerSlot,
                    finalized: summary.finalized,
                    winnerIndexes: summary.winnerIndexes,
                    by: playerSlot,
                    round: room.round,
                    timestamp: Date.now(),
                });
                logEvent(roomId, room, {
                    event: 'vote_cast',
                    round: room.round,
                    actor: playerSlot,
                    result: room.voteSession.options[index],
                    scoreA: null,
                    scoreB: null,
                    details: `index=${index}; counts=${counts.join('|')}`,
                });

                if (autoFinalize) {
                    const resultLabel = summary.winnerIndexes.length > 1 ? 'tie' : room.voteSession.options[summary.winnerIndexes[0]];
                    logEvent(roomId, room, {
                        event: 'vote_end',
                        round: room.round,
                        actor: 'system',
                        result: resultLabel ?? 'none',
                        scoreA: null,
                        scoreB: null,
                        details: `winners=${summary.winnerIndexes.join('|')}`,
                    });
                    room.round++;
                }
                break;
            }

            case 'vote_end': {
                if (!roomId || !playerSlot) return;
                const room = rooms[roomId];
                if (!room || !room.a || !room.b) return;
                if (room.tool !== 'vote') return;
                if (!room.voteSession || !room.voteHost) return;
                if (room.voteHost !== playerSlot) {
                    send(room[playerSlot], { type: 'error', message: '只有主持人可以結束投票' });
                    return;
                }

                const counts = room.voteSession.options.map((_, i) =>
                    (['a', 'b'] as PlayerSlot[]).reduce(
                        (sum, slot) => sum + (room.voteSession?.ballots[slot] === i ? 1 : 0),
                        0
                    )
                );
                const votedBy = (['a', 'b'] as PlayerSlot[]).filter((slot) => room.voteSession?.ballots[slot] !== undefined);
                const summary = buildVoteSummary(counts);

                broadcast(room, {
                    type: 'vote_update',
                    options: room.voteSession.options,
                    counts,
                    votedBy,
                    host: room.voteHost,
                    finalized: true,
                    winnerIndexes: summary.winnerIndexes,
                    by: playerSlot,
                    round: room.round,
                    timestamp: Date.now(),
                });

                logEvent(roomId, room, {
                    event: 'vote_end',
                    round: room.round,
                    actor: playerSlot,
                    result: summary.winnerIndexes.length > 1 ? 'tie' : room.voteSession.options[summary.winnerIndexes[0]] ?? 'none',
                    scoreA: null,
                    scoreB: null,
                    details: `manual; winners=${summary.winnerIndexes.join('|')}`,
                });
                room.round++;
                break;
            }

            case 'rematch_request': {
                if (!roomId || !playerSlot) return;
                const room = rooms[roomId];
                if (!room || !room.winner || !room.a || !room.b) return;

                room.rematchRequested[playerSlot] = true;
                send(playerSlot === 'a' ? room.b : room.a, { type: 'rematch_requested', from: playerSlot });

                const requestedBy = (['a', 'b'] as PlayerSlot[]).filter((slot) => room.rematchRequested[slot]);
                broadcast(room, { type: 'rematch_status', requestedBy });

                if (room.rematchRequested.a && room.rematchRequested.b) {
                    room.choices = {};
                    room.score = { a: 0, b: 0 };
                    room.round = 1;
                    room.winner = null;
                    room.cheatEnabled = false;
                    room.rematchRequested = { a: false, b: false };
                    room.voteSession = null;
                    room.voteHost = null;
                    room.drawSession = null;
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
                if (!roomId || !playerSlot) return;
                const room = rooms[roomId];
                if (!room || !room.winner || !room.a || !room.b) return;

                if (msg.accept) {
                    room.rematchRequested[playerSlot] = true;
                } else {
                    room.rematchRequested = { a: false, b: false };
                }

                const requestedBy = (['a', 'b'] as PlayerSlot[]).filter((slot) => room.rematchRequested[slot]);
                broadcast(room, { type: 'rematch_status', requestedBy });

                if (room.rematchRequested.a && room.rematchRequested.b) {
                    room.choices = {};
                    room.score = { a: 0, b: 0 };
                    room.round = 1;
                    room.winner = null;
                    room.cheatEnabled = false;
                    room.rematchRequested = { a: false, b: false };
                    room.voteSession = null;
                    room.voteHost = null;
                    room.drawSession = null;
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
                if (!roomId || !playerSlot) return;
                const room = rooms[roomId];
                if (!room || !room.a || !room.b) return;
                const text = String(msg.text || '').trim().slice(0, 100);
                if (!text) return;
                if (isRateLimited(room.chatTimestamps[playerSlot])) return;
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
                if (!roomId || !playerSlot) return;
                const room = rooms[roomId];
                if (!room || !room.a || !room.b) return;
                const emoji = String(msg.emoji || '');
                if (!emoji || emoji.length > 4) return;
                if (isRateLimited(room.chatTimestamps[playerSlot])) return;
                room.chatTimestamps[playerSlot].push(Date.now());
                broadcast(room, { type: 'emoji_broadcast', from: playerSlot, emoji });
                break;
            }
        }
    });

    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 25000);

    ws.on('close', () => {
        clearInterval(pingInterval);
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
server.listen(Number(PORT), '0.0.0.0', () => console.log(`Server running on :${PORT}`));
