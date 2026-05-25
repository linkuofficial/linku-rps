# 專案現況快照

更新日期：2026-05-25

## 專案定位

`linku-rps` 是 Linku Tech（linku.tech）維護的獨立猜拳遊戲專案，
不掛在公司主網站頁面上，而是以子網域對外提供服務。

## 正式部署

- 前端：Vercel，https://rps.linku.tech
- 後端：Railway，https://railway-up-production-6b47.up.railway.app

## 主要腳本

根目錄 `package.json` 目前提供的主要流程：

- `pnpm dev:server`：啟動後端
- `pnpm dev:client`：啟動前端
- `pnpm build`：建置前端
- `pnpm start`：啟動後端正式流程
- `pnpm lint`：工作區 lint/type 檢查流程
- `pnpm typecheck`：工作區 TypeScript 型別檢查
- `pnpm test`：工作區測試流程（shared/client/server）

## 本輪已完成（P1 + P2 + P3 + P4）

- P1（工程化）
  - 已補齊 monorepo 腳本：`lint` / `typecheck` / `test`
  - 已新增 CI：`.github/workflows/ci.yml`
  - shared/client/server 皆可執行測試，不再是純 placeholder
- P3（功能改版）
  - 工具已由 `vote` 切換為 `reaction`
  - 協定與前後端訊息流程已改為 `reaction_ready` / `reaction_press`
  - 已完成型別與建置驗證（可通過 `pnpm typecheck` 與 `pnpm build`）
- P2（部署與執行優化）
  - 後端改為 build 後執行 `dist/server.js`
  - Dockerfile 改為 multi-stage（build/runtime 分離）
  - runtime 僅安裝 production 依賴，且啟動不依賴 `tsx`
- P4（觀測性與營運）
  - 後端新增結構化日誌（JSON）
  - 新增 `/metrics` 指標端點（連線數、房間數、錯誤率、計數器）
  - 關鍵事件新增指標累計：連線、rate-limit、reconnect、export 成功/拒絕
  - 已補 server smoke 驗證（檢查 `/health` 與 `/metrics` 回應）

## 目前工作樹狀態

目前倉庫不是乾淨狀態，已有一批未提交修改，集中在前端、後端與共用型別：

- `packages/client/src/App.tsx`
- `packages/client/src/components/Arena.tsx`
- `packages/client/src/components/Chat.tsx`
- `packages/client/src/components/ScoreBoard.tsx`
- `packages/client/src/hooks/useGameState.ts`
- `packages/client/src/main.tsx`
- `packages/client/src/pages/Finished.tsx`
- `packages/client/src/pages/Game.tsx`
- `packages/client/src/pages/JoinPage.tsx`
- `packages/client/src/pages/Lobby.tsx`
- `packages/client/src/pages/ToolSelector.tsx`
- `packages/client/src/pages/Waiting.tsx`
- `packages/server/src/server.ts`
- `packages/shared/src/index.ts`
- `README.md`

另外還有新增但尚未納入版本控制的檔案：

- `packages/client/src/components/LanguageSwitcher.tsx`
- `packages/client/src/i18n.tsx`

## 已整理的文件

- `README.md`：簡化後的專案與開發說明
- `DEPLOYMENT_NOTE.md`：對外部署與母公司描述補充

## 當前判讀

從工作樹內容看起來，專案正在進行前端體驗與國際化相關整理，同時也已把正式部署資訊從舊版 Fly.io 說明切換到目前的 Railway / Vercel 組合。

## 建議下一步

1. 增加 server 反應測試流程的整合測試（WebSocket 往返）。
2. 增加 client 頁面層互動測試（例如 reaction UI 及 F1 快捷鍵）。
3. 整理本輪改動為可追蹤 commit（建議拆為 P2/P4 與既有功能調整兩組 commit）。
