# 猜拳對戰 · linku.tech

線上即時猜拳，建房間 → 分享連結 → 兩人對戰。
含「作弊模式」（鍵盤輸入 `cheat` 開啟，只有房主能用 😈）。

## 架構

- **前端**：純靜態 HTML，部屬於 Vercel（`rps.linku.tech`）
- **後端**：Node.js + WebSocket，部屬於 Fly.io（`linku-rps.fly.dev`）

```
┌──────────────────────┐         WebSocket           ┌─────────────────────────┐
│  rps.linku.tech      │  ─────── wss:// ─────────▶  │  linku-rps.fly.dev      │
│  (Vercel · 靜態)     │                              │  (Fly.io · Node.js)    │
└──────────────────────┘                              └─────────────────────────┘
```

## 本機開發

```bash
npm install
node server.js
# http://localhost:3000
```

`public/index.html` 裡的 `BACKEND_HOST` 留空時就會連到當前頁面的 host（同源），本機開發無需設定。

## 部屬

### 1. 後端 → Fly.io

```bash
# 第一次：登入
fly auth login

# 建立 + 部屬（會讀取 fly.toml）
fly launch --no-deploy --copy-config --name linku-rps
fly deploy

# 看 logs
fly logs
```

> 如果 `linku-rps` 這個名字被搶走，編輯 `fly.toml` 的 `app` 欄位換個名字。

### 2. 前端 → Vercel

部屬前**先**編輯 `public/index.html`，把這行：

```js
const BACKEND_HOST = '';
```

改成你 Fly app 的網域（不要加 `https://`，不要加結尾 `/`）：

```js
const BACKEND_HOST = 'linku-rps.fly.dev';
```

然後：

```bash
vercel login
vercel --prod
```

### 3. 綁定 rps.linku.tech

在 Vercel dashboard 的 project → Settings → Domains 加上 `rps.linku.tech`，
按照 Vercel 顯示的 DNS 設定（通常是 CNAME 到 `cname.vercel-dns.com`）去 linku.tech 的 DNS 後台加紀錄。

### 4.（可選）後端用自家網域

預設 Fly 給你的就是 `linku-rps.fly.dev`，能用。
想用 `api.rps.linku.tech` 的話：

```bash
fly certs add api.rps.linku.tech
# 然後在 DNS 加 CNAME api.rps.linku.tech → linku-rps.fly.dev
```

再回去把 `index.html` 的 `BACKEND_HOST` 改成 `api.rps.linku.tech`，重新 `vercel --prod`。

## 作弊模式

遊戲畫面下，鍵盤連續輸入 `c`、`h`、`e`、`a`、`t`（5 鍵）→ 右上角會出現 `CHEAT MODE ACTIVE` 綠色 pill。
此後**房主**送出的每一拳都會在伺服器端被改成必勝拳，朋友完全看不出差別。
再輸入一次 `cheat` 可關閉。

## 環境變數（Fly.io）

| 變數 | 預設 | 說明 |
|---|---|---|
| `PORT` | `8080` | 伺服器埠 |
| `ALLOWED_ORIGINS` | `https://rps.linku.tech,http://localhost:3000` | 允許的前端 Origin（逗號分隔） |
