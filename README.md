# linku-rps

最小開發與部署說明（僅保留目前有效流程）。

## 目前架構

- 前端：Vite + React（packages/client）
- 後端：Node.js + WebSocket（packages/server）
- 共用型別：packages/shared

## 本機開發

需求：Node.js 20+、pnpm

```bash
corepack enable
pnpm install
pnpm dev:server
pnpm dev:client
pnpm build
```

## 架設網頁必要設定

以 .env.example 為基準：

- VITE_WS_URL：前端連線用 WebSocket URL
- PORT：後端埠號
- ALLOWED_ORIGINS：允許前端來源（逗號分隔）

## 安全原則

- 不提交 .env
- 不在文件中放 API key、token 或其他敏感資訊
- 部署前先執行 pnpm build 確認可用

## 已移除的舊版入口

- server.js
- public/index.html
- fly.toml
