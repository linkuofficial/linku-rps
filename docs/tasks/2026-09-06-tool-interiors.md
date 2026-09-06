# TASK: tool-interiors

狀態: done

## 目標

Refine all six existing tool interiors for desktop and mobile while preserving the approved home page. Riku explicitly authorized desktop interior changes, superseding the earlier desktop-interior preservation constraint.

## 驗收條件

- [x] Shared interior navigation, title, result, settings and action hierarchy.
- [x] Wide dice, draw and wheel workspaces; focused coin, RPS and reaction workspaces.
- [x] Single-column mobile layout, usable controls and scrollable content.
- [x] Existing tool behavior and home-page layouts preserved.
- [x] Local lint, typecheck, tests, build and browser verification pass.

## 邊界（不要動的東西）

No home-page redesign, new tools, dependencies, server/shared implementation, persistence, domain or deployment changes. Riku authorized commit and push on 2026-09-06 after accepting the candidate.

## Questions（Codex 填）

None.

## Review

- Independent Codex pre-review found two issues: obsolete desktop interior overrides contradicted the accepted wide interior, and an edited wheel could retain its previous result options in the preview. Both were fixed; the wheel regression is now covered by the browser script.
- The packet-only Claude cross-family review was attempted with the required brief, commit diff and repo `AGENTS.md`, but the CLI returned no output for five minutes and was terminated. No cross-family verdict is claimed.

## HANDOFF（Codex 完成或卡住後填）

- Branch: `codex/tool-polish`; worktree `D:\LINKU\rps\.worktrees\tool-polish`.
- Summary: Added an interior-only stylesheet, moved shared tool rules out of the compact-only stylesheet, and introduced a 960px desktop workspace with two columns for dice/draw/wheel. Coin/RPS/reaction remain centered at 640px. Navigation, headings, controls, panel spacing, dialog limits and mobile scrolling are consistent. Invitation-based game pages use the same shell. Home-page rules and markup are unchanged.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; responsive browser suite (59 checks, no page errors); functional browser suite covering five solo tools, input limits, CSV, wheel dialog/animation, reaction retries and languages. Two local browser clients verified RPS invitation, choice locking and opposite results. Temporary backend stopped afterward.
- Evidence: Local screenshots and reports were generated from the committed verification scripts, visually inspected, and intentionally omitted from Git. Desktop dice/wheel/draw/coin/RPS and mobile reaction/RPS were covered.
- Remaining risks: Browser viewport simulation does not replace physical iOS/Android checks. No production deployment or acceptance is claimed.
