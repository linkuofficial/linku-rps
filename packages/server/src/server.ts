import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import {
  type ClientMessage,
  type Choice,
  type PlayerSlot,
  type RoundResult,
  type ServerMessage,
  BEATS,
  VALID_CHOICES,
} from '@rps/shared';

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:5173,http://127.0.0.1:5173,https://rps.linku.tech'
).split(',').map((s) => s.trim());

const wss = new WebSocketServer({
  server,
  verifyClient: ({ origin }, done) => {
    if (!origin) return done(true);
    if (ALLOWED_ORIGINS.includes(origin)) return done(true);
    console.warn('Rejected origin:', origin);
    done(false, 403, 'Forbidden origin');
  },
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: Object.keys(rooms).length });
});

interface Room {
  a: WebSocket;
  b: WebSocket | null;
  choices: { a?: Choice; b?: Choice };
  score: { a: number; b: number };
  bestOf: number;
  round: number;
  cheatEnabled: boolean;
  chatTimestamps: { a: number[]; b: number[] };
}

const rooms: Record<string, Room> = {};

function getResult(a: Choice, b: Choice): RoundResult {
  if (a === b) return 'draw';
  return BEATS[a] === b ? 'a_wins' : 'b_wins';
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(room: Room, msg: ServerMessage) {
  send(room.a, msg);
  if (room.b) send(room.b, msg);
}

function isRateLimited(timestamps: number[], maxPerSecond = 3): boolean {
  const now = Date.now();
  const recent = timestamps.filter((t) => now - t < 1000);
  timestamps.length = 0;
  timestamps.push(...recent);
  return recent.length >= maxPerSecond;
}

wss.on('connection', (ws) => {
  let roomId: string | null = null;
  let playerSlot: PlayerSlot | null = null;

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case 'create_room': {
        const bestOf = [1, 3, 5, 7].includes(msg.bestOf) ? msg.bestOf : 3;
        roomId = uuidv4().slice(0, 6).toUpperCase();
        rooms[roomId] = {
          a: ws, b: null, choices: {}, score: { a: 0, b: 0 },
          bestOf, round: 1, cheatEnabled: false,
          chatTimestamps: { a: [], b: [] },
        };
        playerSlot = 'a';
        send(ws, { type: 'room_created', roomId, bestOf });
        break;
      }

      case 'join_room': {
        const id = msg.roomId.toUpperCase();
        const room = rooms[id];
        if (!room) { send(ws, { type: 'error', message: '找不到房間' }); return; }
        if (room.b) { send(ws, { type: 'error', message: '房間已滿' }); return; }
        room.b = ws;
        roomId = id;
        playerSlot = 'b';
        send(ws, { type: 'joined', roomId: id, bestOf: room.bestOf });
        send(room.a, { type: 'game_start', you: 'a', bestOf: room.bestOf });
        send(room.b, { type: 'game_start', you: 'b', bestOf: room.bestOf });
        break;
      }

      case 'choice': {
        if (!roomId || !playerSlot) return;
        const room = rooms[roomId];
        if (!room || !room.b) return;
        if (!VALID_CHOICES.includes(msg.choice)) return;

        room.choices[playerSlot] = msg.choice;
        const isCheat = msg.cheat === true && playerSlot === 'a';
        if (isCheat) room.cheatEnabled = true;

        if (room.choices.a && room.choices.b) {
          let choiceA = room.choices.a;
          const choiceB = room.choices.b;

          if (room.cheatEnabled) {
            choiceA = Object.keys(BEATS).find(
              (k) => BEATS[k as Choice] === choiceB
            ) as Choice;
            room.cheatEnabled = false;
          }

          const result = getResult(choiceA, choiceB);
          if (result === 'a_wins') room.score.a++;
          else if (result === 'b_wins') room.score.b++;

          broadcast(room, {
            type: 'round_result',
            choices: { a: choiceA, b: choiceB },
            result, score: room.score, round: room.round,
          });

          room.round++;
          room.choices = {};

          const winsNeeded = Math.ceil(room.bestOf / 2);
          if (room.score.a >= winsNeeded || room.score.b >= winsNeeded) {
            const winner: PlayerSlot = room.score.a >= winsNeeded ? 'a' : 'b';
            broadcast(room, { type: 'game_over', winner, finalScore: room.score });
          }
        } else {
          const other = playerSlot === 'a' ? room.b : room.a;
          if (other) send(other, { type: 'opponent_ready' });
        }
        break;
      }

      case 'chat': {
        if (!roomId || !playerSlot) return;
        const room = rooms[roomId];
        if (!room || !room.b) return;
        const text = String(msg.text || '').trim().slice(0, 100);
        if (!text) return;
        if (isRateLimited(room.chatTimestamps[playerSlot])) return;
        room.chatTimestamps[playerSlot].push(Date.now());
        broadcast(room, { type: 'chat_broadcast', from: playerSlot, text, timestamp: Date.now() });
        break;
      }

      case 'emoji': {
        if (!roomId || !playerSlot) return;
        const room = rooms[roomId];
        if (!room || !room.b) return;
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
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];
    const other = playerSlot === 'a' ? room.b : room.a;
    if (other) { try { send(other, { type: 'opponent_left' }); } catch {} }
    delete rooms[roomId];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(Number(PORT), '0.0.0.0', () => console.log(`Server running on :${PORT}`));