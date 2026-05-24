const express = require('express');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

// 允許的來源（前端網域）。多個用逗號分隔，本機開發 fallback。
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'http://localhost:3000,http://127.0.0.1:3000,https://rps.linku.tech')
  .split(',').map(s => s.trim());

const wss = new WebSocketServer({
  server,
  verifyClient: ({ origin }, done) => {
    // 沒帶 origin（例如 wscat 或同源請求）也放行
    if (!origin) return done(true);
    if (ALLOWED_ORIGINS.includes(origin)) return done(true);
    console.warn('Rejected origin:', origin);
    done(false, 403, 'Forbidden origin');
  },
});

// 健康檢查（Fly.io 用）
app.get('/health', (_req, res) => res.json({ ok: true, rooms: Object.keys(rooms).length }));

// 也保留本機開發用的靜態檔（部屬時前端在 Vercel，不會走這邊）
app.use(express.static(path.join(__dirname, 'public')));

// 房間資料
const rooms = {};
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

function getResult(a, b) {
  if (a === b) return 'draw';
  return BEATS[a] === b ? 'a_wins' : 'b_wins';
}

wss.on('connection', (ws) => {
  let roomId = null;
  let playerSlot = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'create_room') {
      roomId = uuidv4().slice(0, 6).toUpperCase();
      rooms[roomId] = { a: ws, b: null, choices: {}, score: { a: 0, b: 0 } };
      playerSlot = 'a';
      ws.send(JSON.stringify({ type: 'room_created', roomId }));
    }

    if (msg.type === 'join_room') {
      roomId = msg.roomId.toUpperCase();
      const room = rooms[roomId];
      if (!room) return ws.send(JSON.stringify({ type: 'error', message: '找不到房間' }));
      if (room.b) return ws.send(JSON.stringify({ type: 'error', message: '房間已滿' }));
      room.b = ws;
      playerSlot = 'b';
      ws.send(JSON.stringify({ type: 'joined', roomId }));
      room.a.send(JSON.stringify({ type: 'game_start', you: 'a' }));
      room.b.send(JSON.stringify({ type: 'game_start', you: 'b' }));
    }

    if (msg.type === 'choice') {
      const room = rooms[roomId];
      if (!room) return;

      room.choices[playerSlot] = { choice: msg.choice, cheat: msg.cheat && playerSlot === 'a' };

      if (room.choices.a && room.choices.b) {
        let choiceA = room.choices.a.choice;
        let choiceB = room.choices.b.choice;

        if (room.choices.a.cheat) {
          choiceA = Object.keys(BEATS).find(k => BEATS[k] === choiceB);
        }

        const result = getResult(choiceA, choiceB);
        if (result === 'a_wins') room.score.a++;
        else if (result === 'b_wins') room.score.b++;

        const payload = {
          type: 'round_result',
          choices: { a: choiceA, b: choiceB },
          result,
          score: room.score,
        };
        room.a.send(JSON.stringify(payload));
        room.b.send(JSON.stringify(payload));
        room.choices = {};
      } else {
        const other = playerSlot === 'a' ? room.b : room.a;
        if (other) other.send(JSON.stringify({ type: 'opponent_ready' }));
      }
    }
  });

  // 簡易 keepalive — Fly.io 的 proxy 對閒置連線會斷
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.ping();
  }, 25000);

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];
    const other = playerSlot === 'a' ? room.b : room.a;
    if (other) {
      try { other.send(JSON.stringify({ type: 'opponent_left' })); } catch {}
    }
    delete rooms[roomId];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`🎮 Running on :${PORT}`));
