# REQ-019: Fix dev startup hang

**UR:** UR-003
**Status:** done
**Created:** 2026-07-09
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** checkpoint_log:passed commit:75172ef
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** M
**Files:** src/main/**tests**/window-lifecycle.test.ts, src/main/index.ts, src/main/window-lifecycle.ts
**Depends on:**

## Task

Diagnose and fix the dev startup hang: `npm run dev` currently hangs during startup and never reaches an open app window. Find the root cause (do not patch around it) and fix it so dev mode starts reliably. Document the root cause and the evidence (log output, stack trace, or bisected commit) in the closure notes.

## Context

Reported in UR-003's question session: while investigating the packaged-app trailer bug, the user found dev mode "hangs during startup", so dev behavior for the trailer is unknown. The user chose to include this in UR-003 because a broken dev mode blocks runtime diagnosis and verification of the trailer fix (REQ-020). The `Files:` list is a best guess at the likely surface (Vite/electron-vite config, main-process bootstrap) — the actual footprint follows the diagnosis.

## Acceptance Criteria

- [x] Root cause of the hang is identified and documented in the worker's closure notes with concrete evidence (log line, stack trace, or config diff), not just "it works now"
- [x] `npm run dev` reaches an open, interactive app window (main window created and renderer loaded) within 60 seconds on a clean checkout
- [x] The full test suite (`npx vitest run`) passes with zero failures after the fix

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **runtime** Run `npm run dev` (with a 60s timeout guard) and watch stdout/stderr until the main window is created.
   - Expected: startup completes — electron-vite reports the dev server ready and the Electron main process logs window creation; the command does not hang indefinitely. Handoff: dev server ready → BrowserWindow load.
2. **test** `npx vitest run`
   - Expected: all tests pass, zero failures — confirms the fix didn't regress main/renderer units.

## Outputs

- src/main/index.ts — Wires deterministic startup lifecycle logging and window reveal behavior into BrowserWindow creation.
- src/main/window-lifecycle.ts — Adds idempotent BrowserWindow startup lifecycle helper with did-finish-load fallback and load-failure logging.
- src/main/**tests**/window-lifecycle.test.ts — Covers renderer-load window reveal and idempotent ready-to-show handling.
