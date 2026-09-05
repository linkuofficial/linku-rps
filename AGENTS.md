# AGENTS.md — rps（rps.linku.tech）

> 免費開放工具站。Linku Tech 的**次要資產**：目標是「完成、維護」，不擴張範圍；可由 AI 完整生成程式碼。
> 本機工作區容器脈絡：`D:\LINKU\AGENTS.md`（AI 協作協議、跨 repo 規則）；全域規則：Codex 讀 `~/.codex/AGENTS.md`、Claude 讀 `~/.claude/CLAUDE.md`。雲端/其他環境讀不到上述檔案時，以本檔自足。

## 結構

pnpm monorepo，三個 packages：

- `packages/client/` — React 19 + wouter（路由）+ Vite 6，部署至 Vercel（見 `vercel.json`）。
- `packages/server/` — Express 5 + ws（WebSocket），部署至 Railway（見 `railway.toml`、`Dockerfile`）。
- `packages/shared/` — 共用型別與邏輯。

## Commands

```bash
pnpm install
pnpm dev:client        # 前端 dev（Vite）
pnpm dev:server        # 後端 dev（tsx watch）
pnpm build             # Build all
pnpm start             # Start server
pnpm lint              # Lint all packages
pnpm typecheck         # Type-check all packages
pnpm test              # Run all tests（vitest）
pnpm smoke:server      # Server smoke test
```

## 驗證門檻（宣稱完成前）

1. `pnpm lint && pnpm typecheck && pnpm test` 全過。
2. 動到 server：加跑 `pnpm smoke:server`。
3. UI 改動：`pnpm dev:client` 瀏覽器實看。

## 已知技術債（台帳；「暫不處理」的決定不重開，除非前提改變）

- 根 `package.json` 仍用 ESLint 8 + `@typescript-eslint` 7（現行為 ESLint 9 flat config + typescript-eslint 8）；升級需遷移成 `eslint.config.js`，會動到 CI。**（2026-06-10）複查：對次要資產無功能收益、有 CI 風險，決定暫不處理。**

## 任務簡報

放 `docs/tasks/YYYY-MM-DD-slug.md`（目錄不存在就建）。模板見 `D:\LINKU\docs\tasks\TEMPLATE.md` 或 `~/.codex/AGENTS.md` §13。
