# TASK: minimal-responsive-ui
狀態: done（local implementation and browser verification; delivery authorized）

## 目標

Improve the small-screen interface while preserving the original desktop design. Continue on `codex/tool-polish` without disturbing the earlier functional work or original checkout's SEO changes.

Owner correction (2026-09-06): Riku explicitly approved the ORIGINAL desktop appearance and rejected the desktop redesign. The large clock, horizontal tool strip, footer preferences and narrow centered tool pages are the desktop baseline. Do not redesign them as part of responsive work. New layout rules apply only below 900px.

## 驗收條件
- [x] Below 900px, all six hub tools appear in a two-column grid. At desktop widths, restore the original horizontal strip and its existing scroll behavior.
- [x] Consistent navigation, typography, focus indicators and comfortable touch targets.
- [x] Desktop tool pages preserve their original narrow single-column composition. Small-screen changes preserve action order and do not affect desktop CSS.
- [x] Results, settings, dialogs and exports remain reachable in short landscape and phone viewports.
- [x] Light/dark and RTL layouts remain legible.
- [x] Lint, typecheck, tests, build, functional regression and visual/geometry checks pass at 320–1920px, including landscape and a 200% CSS content-zoom check.

## 邊界（不要動的東西）

No tools, dependencies, server/shared behavior, protocols, persistence, domains or deployment settings added or changed. Riku authorized commit and push on 2026-09-06 after accepting the candidate.

## Questions（Codex 填）

None. Riku authorized local design and responsive implementation.

## HANDOFF（Codex 完成或卡住後填）
- Branch: `codex/tool-polish`
- Worktree: `D:\LINKU\rps\.worktrees\tool-polish`.
- Summary: Restored the original desktop hub markup, clock typography, horizontal cards, footer controls, background tokens, language control and narrow centered tool pages. The redesigned grid/header and page layout are confined to `@media (max-width: 899px)`; `desktop.css` maps the tool shell to its original desktop geometry. Restored colorful wheel defaults and the original coin faces. The hub keeps common state when switching desktop/mobile render branches, so partially typed room codes survive resizing. All previous functional fixes remain. The earlier desktop redesign is superseded and rejected.
- Theme: App owns the hub/tool theme state, eliminating stale toggle labels after navigating from a dark hub into a tool and back. Existing storage key and behavior are unchanged.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test` (132 total), `pnpm build`, and `git diff --check` passed. The prior functional browser regression passed for five offline tools, CSV, wheel alignment, reaction retries, and seven languages. Two real local browser clients completed RPS invitation/join/selection/result verification using the existing backend, which was stopped afterward.
- Responsive evidence: After the owner correction, `scripts/verify-responsive-ui.cjs` passed 59 checks using local Microsoft Edge/Playwright: 320×568, 390×844, 768×1024, 844×390, 1280×720, 1440×900 and 1920×1080; two-column compact grid versus original single-row desktop strip; no redesigned desktop heading; original narrow desktop tool width; room-code inputs and dice results survive crossing the breakpoint; export controls scroll into view; dark tools; six additional hub languages; 200% CSS content zoom; theme round-trip; native wheel dialog at 320×568 and 844×390. No page errors. Desktop and mobile screenshots were visually inspected.
- Artifacts: Local screenshots, logs and reports were generated from `scripts/verify-responsive-ui.cjs`, visually inspected, and intentionally omitted from Git. Earlier redesign screenshots or descriptions are not accepted desktop references.
- Reproduction: With the local Vite server running on port 5173 and no backend on port 3001, set `PLAYWRIGHT_MODULE` to the available bundled Playwright module and run `node scripts/verify-responsive-ui.cjs`. The script is optional verification infrastructure and adds no dependency to the product.
- Remaining risks: These are desktop-browser viewport simulations, not physical iOS/Android device tests. The zoom check uses CSS zoom, not native browser zoom. No deployment or public-site acceptance is claimed. No server/shared, protocol, persistence, domain or deployment configuration changed. Earlier functional improvements remain in the same working branch.

Owner detail (2026-09-06): Removed the compact tool cards' decorative numbers and diagonal arrows; the compact page heading is now the literal brand TOOLBOX in every locale. Desktop layout remains unchanged. Verified at 390px in the browser; lint and typecheck passed.

Compact spacing refinement (2026-09-06): Reduced excessive card whitespace below 900px. At 600–899px, icons and labels share a row in 100px cards; smaller phones retain two columns with closely grouped icons and labels in 108px cards. Reduced the introduction spacing and placed the room label above its full-width input row. Desktop styles and markup remain unchanged. Lint, typecheck, tests and all 59 responsive browser checks passed with no page errors. Visually inspected dark screenshots at 390px and 728px; these are simulated viewports, not physical device tests.
