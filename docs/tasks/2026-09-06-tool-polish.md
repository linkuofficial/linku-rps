# TASK: tool-polish
狀態: done（local implementation and verification; delivery authorized）

## 目標

Polish the six existing tools on local main `3423c6b`, under Riku's 2026-09-06 authorization to decide ordinary improvements autonomously.

## 驗收條件
- [x] Dice inputs support clearing and retyping; invalid requests cannot be submitted. The roll button is available outside the collapsed settings, whose hidden fields cannot receive keyboard focus.
- [x] Wheel options, displayed segments and selected outcome agree; editing is keyboard accessible and respects existing limits. Result geometry uses the returned option snapshot; a browser assertion checks the pointer angle against the selected label.
- [x] Draw clearly reports effective entries and rejects oversized input rather than silently dropping names.
- [x] Coin results include a readable recent history and counts, explicitly scoped to the retained 300 events.
- [x] Reaction results support starting another round; active modes cannot be switched; solo UI has no fictional opponent. F1 ignores key repeats and text editing.
- [x] RPS selection/status is accessible; all offline tools omit multiplayer-only controls. Local status appears in the header instead of a floating reconnect banner.
- [x] Lint, typecheck, tests, build and local browser checks pass, including narrow viewports and a local two-player RPS round.
- [x] Repair direct invitation links: initialize JoinPage's inferred tool before sending the join request, preserving the existing joined/game_start acceptance guards.

## 邊界（不要動的東西）

No new tools, dependencies, server/shared changes, persistence or protocol changes, authentication, deployment or domain migration. Riku authorized commit and push on 2026-09-06 after accepting the candidate. The original checkout and its pending SEO changes remain intact. This isolated worktree is the only active implementation for this task; older audit briefs are historical handoffs, not concurrent agents.

## Questions（Codex 填）

None for the bounded client improvements. Hosting multiplayer remains an owner decision.

## HANDOFF（Codex 完成或卡住後填）
- Branch: `codex/tool-polish`
- Worktree: `D:\LINKU\rps\.worktrees\tool-polish`
- Base: `3423c6b` (local main and local origin/main matched; no fetch).
- Summary: Client-only polish across all six tools, a shared room-only social panel, existing input limits enforced visibly, seven-language copy, accessible controls and native wheel dialog. The invitation fix was discovered by running two actual browser clients: the host entered the game but the joiner ignored both joined and game_start because its tool was still null. The repaired invitation flow passed the same test.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test` (43 shared + 59 client + 30 server = 132), `pnpm build`, and `git diff --check` all exited 0. Dependencies were installed offline with the existing lockfile; no package changes. Server source was unchanged; the existing server was built and started temporarily for the two-client RPS check, then stopped.
- Browser: Microsoft Edge through the bundled Playwright runtime (agent-browser CLI unavailable). Five solo tools completed real clicks and state transitions with no backend, including an actual CSV download; direct RPS invitation, locked selection and opposite win/loss results verified with a local backend. Checked 320, 390 and 1280px viewport widths; seven-language switching, Arabic RTL, dark mode, wheel focus containment/Escape and pointer alignment. No page errors. Representative screenshots were visually inspected; finite CSS transitions are disabled for screenshot capture so images show settled colors.
- Evidence: Local JSON reports, logs and PNG captures were generated from `scripts/verify-tool-polish.cjs`, visually inspected, and intentionally omitted from Git.
- Reproduction: Start `pnpm dev:client --host 127.0.0.1 --port 5173 --strictPort`. Set `PLAYWRIGHT_MODULE` to the available Playwright module directory if it is not installed normally. Run `node scripts/verify-tool-polish.cjs` with port 3001 stopped for offline checks. Then start `node packages/server/dist/server.js` and run `node scripts/verify-tool-polish.cjs --rps` for two-client verification. No production dependency is required by this optional verification script.
- Remaining risks: This is local evidence only. Public multiplayer availability still depends on a working backend. No hosting, protocol, security policy, persistence or domain migration changed. The original checkout's pending SEO/domain changes remain intact; this branch is based on current local main and does not include that batch.
