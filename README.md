# Linku Toolbox

linku.tech 旗下的輕量決策工具組。六個工具，協助單人或多人快速做決定。

## 專案定位

- 極簡、快速、不囉唆
- 點擊工具 → 選擇建房或輸入房號加入 → 立即可用
- 單人可直接使用；房號可分享給第二人即時加入

## 六工具規格

| 工具 | ID | 房間碼前綴 | 人數 | 多人模式 | 判定 |
|------|----|-----------|------|---------|------|
| 猜拳 | `rps` | 1 | 2 人必須 | 各出拳 | 石頭剪刀布勝負 |
| 硬幣 | `coin` | 2 | 1-2 人 | 一人翻，雙方同步看 | 無勝負（共同決策） |
| 轉盤 | `wheel` | 3 | 1-2 人 | 任一方可轉，結果同步 | 無勝負（共同決策） |
| 骰子 | `dice` | 4 | 1-2 人 | 各擲一次，比大小 | 點數高者勝 |
| 抽籤 | `draw` | 5 | 1-2 人 | 任一方可抽，結果同步 | 無勝負（共同決策） |
| 反應 | `reaction` | 6 | 1-2 人 | 比反應時間 | 更快/更接近目標者勝 |

**分類**：
- 有勝負：RPS、Dice、Reaction
- 共享決策（無勝負）：Coin、Wheel、Draw

## 狀態機

```
tool_select ──[SELECT_TOOL]──→ lobby
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
            [create_room]   [create_room]    [join_room]
              (RPS)         (其他5工具)
                 │               │               │
                 ▼               ▼               ▼
              waiting        playing          waiting
                 │                               │
            [game_start]                    [game_start]
                 │                               │
                 ▼                               ▼
              playing                         playing
                 │
            [game_over]
                 │
                 ▼
              finished ──[rematch]──→ playing
                       ──[back]────→ tool_select
```

合法轉換：
- `tool_select → lobby`（SELECT_TOOL）
- `lobby → waiting`（ROOM_CREATED，僅 RPS）
- `lobby → playing`（GAME_START，非 RPS 工具建房後直接進入）
- `waiting → playing`（GAME_START）
- `playing → finished`（GAME_OVER）
- `finished → playing`（REMATCH）
- `任何 → tool_select`（BACK_TO_TOOL_SELECT）

## 核心流程

### 流程 A：非 RPS 工具（單人即玩）

```
點擊工具卡 → Lobby（顯示「開始」按鈕 + 房號輸入）
→ 點「開始」→ create_room → server 建房 + 立即 game_start
→ 直接進入 playing（不經過 Waiting 頁）
→ 房號顯示於遊戲畫面，可隨時分享讓對方加入
```

### 流程 B：RPS（必須雙人）

```
點擊工具卡 → Lobby（選 bestOf + 建房/加入）
→ 點「建房」→ create_room → room_created → Waiting（顯示房號）
→ 對手加入 → game_start → playing
```

### 流程 C：加入房間

```
入口 1：ToolSelector 底部輸入房號 → join_room（跳過工具選擇）
入口 2：URL /join/:code → 自動 join_room
→ server 回 joined → game_start → playing
```

### 流程 D：Rematch

```
game_over → Finished → 任一方發 rematch_request
→ 對方 accept → rematch_started → playing（重置分數）
```

## 架構

```
packages/
  shared/    — 共用型別與常數（ToolId、Message types、BEATS）
  server/    — Node.js + ws，房間管理、遊戲邏輯、結構化日誌
  client/    — Vite + React + Tailwind，狀態機在 useGameState.ts
```

前後端透過 WebSocket JSON 通訊。Client 訊息定義在 `ClientMessage`，Server 訊息在 `ServerMessage`。

## 開發

需求：Node.js 20+、pnpm

```bash
corepack enable
pnpm install
pnpm dev:server   # 啟動後端
pnpm dev:client   # 啟動前端
pnpm build        # 建置全部
pnpm typecheck    # 型別檢查
pnpm test         # 執行測試
pnpm smoke:server # 後端 smoke 驗證
```

## 部署

- 前端：Vercel → https://rps.linku.tech
- 後端：Railway → production URL

## 環境變數

| 變數 | 用途 |
|------|------|
| `VITE_WS_URL` | 前端 WebSocket 連線 URL |
| `PORT` | 後端埠號 |
| `ALLOWED_ORIGINS` | 允許的前端來源（逗號分隔） |

## 觀測性

- `GET /health` — 健康檢查
- `GET /metrics` — 連線數、房間數、錯誤率

後端日誌為 JSON 結構化輸出。
