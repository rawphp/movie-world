# REQ-023: Detail-view keyboard navigation path

**UR:** UR-006
**Status:** done
**Created:** 2026-07-09
**Layer:** none
**Entry point:** User is on `/movie/:id` (MovieDetailView) and presses the bound previous/next keyboard combination (default Cmd/Ctrl+← / Cmd/Ctrl+→)
**Terminal state:** The detail view shows the adjacent movie in the displayed library order (active filters + current sort, i.e. `store.list`), wrapping from first→last and last→first
**Parent:**
**Closure proof:** upgrade: pending/ removal — human validation moved outside the system
**Criteria approved:** agent-drafted
**Priority:** 1
**Size:** S
**Files:**
**Depends on:** REQ-024, REQ-025, REQ-027

## Task

Path-unit REQ: owns closure of the keyboard-navigation journey. No new code of its own — verify that the pieces built by REQ-024 (shared keybinding types/util), REQ-027 (main serves keybinding defaults in settings) and REQ-025 (detail-view keydown handling) integrate into a working end-to-end path.

## Context

Brief: "when I'm in a movie detail view, if I press a keyboard combination, it should navigate to the previous or next movie in the library (filtered or not)". Clarified: order follows the displayed list (filters + sort applied, same as the library grid); edges wrap around; defaults are Cmd/Ctrl+← (previous) and Cmd/Ctrl+→ (next).

## Acceptance Criteria

- [x] With the app's default settings (no keybindings ever edited), a keydown of the default next combo on the detail view triggers a router navigation to the next movie id in `store.list` order
- [x] With a genre filter active in the library store, keydown navigation steps only through movies passing that filter, in the current sort order
- [x] On the first movie of the list, the previous combo navigates to the last movie; on the last, the next combo navigates to the first (wrap-around)
- [x] Full test suite (`npx vitest run`) passes with all three child REQs merged

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run`
   - Expected: entire suite green, including the new keybindings, settings and MovieDetailView navigation tests from REQ-024/025/027
2. **build** `npm run build`
   - Expected: clean build, no TypeScript errors across shared/main/preload/renderer

## Manual checks (advisory)

- [ ] Action: launch the app (`npm run dev`), open any movie's detail view and press Cmd+→ (macOS) — Observable outcome: the detail view switches to the next movie of the library grid order without losing scroll/window state
- [ ] Action: apply a genre filter in the library, open a movie from the filtered grid, press Cmd+→ repeatedly — Observable outcome: only movies matching the filter appear, and after the last one it wraps to the first
- [ ] Action: open the Fix match dialog and type a title containing arrow-key edits, then close it — Observable outcome: navigation never fires while the dialog is open or while typing in an input

## Outputs

- Automated verification — `npx vitest run` passed 23 files / 119 tests.
- Automated verification — `npm run build` completed node/web typecheck and electron-vite build.
