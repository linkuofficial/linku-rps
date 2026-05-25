# linku-rps

最小開發與部署說明（僅保留目前有效流程）。

## 目前架構

- 前端：Vite + React（packages/client）
- 後端：Node.js + WebSocket（packages/server）
- 共用型別：packages/shared

## 專案與部署

`linku-rps` 是由 Linku Tech（linku.tech）維護的獨立猜拳遊戲服務，不掛在公司主網站頁面上，而是以子網域對外提供服務。

- 前端：Vercel，https://rps.linku.tech
- 後端：Railway，https://railway-up-production-6b47.up.railway.app

對外描述可直接寫成：`linku-rps` 是 Linku Tech 的獨立小遊戲服務，前端部署於 rps.linku.tech（Vercel），後端部署於 Railway。

## 本機開發

需求：Node.js 20+、pnpm

```bash
corepack enable
pnpm install
pnpm dev:server
pnpm dev:client
pnpm build
```

## 後端執行模式（P2）

- 開發模式：`pnpm --filter @rps/server dev`
- 生產建置：`pnpm --filter @rps/server build`
- 生產啟動：`pnpm --filter @rps/server start`
- Smoke 驗證：`pnpm smoke:server`

說明：後端 production 已改為執行編譯產物 `dist/server.js`，不再依賴 `tsx` runtime。

## 架設網頁必要設定

以 .env.example 為基準：

- VITE_WS_URL：前端連線用 WebSocket URL
- VITE_GESTURE_MODE：手勢策略（`minimal` 只保留聊天滑動，`off` 完全停用手勢）
- PORT：後端埠號
- ALLOWED_ORIGINS：允許前端來源（逗號分隔）

## 安全原則

- 不提交 .env
- 不在文件中放 API key、token 或其他敏感資訊
- 部署前先執行 pnpm build 確認可用

## 觀測性（P4）

- `/health`：健康檢查
- `/metrics`：執行期指標（連線數、房間數、錯誤率與計數器）

後端日誌採 JSON 結構化輸出，方便在平台（Railway / log pipeline）追蹤事件。

## 已移除的舊版入口

- server.js
- public/index.html
- fly.toml
