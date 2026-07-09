# REQ-027: Main-process keybindings persistence and IPC

**UR:** UR-006
**Status:** done
**Created:** 2026-07-09
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:** REQ-026
**Closure proof:** checkpoint_log:passed commit:b2d7ddd
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** M
**Files:** src/main/settings.ts, src/main/ipc.ts, src/main/__tests__/settings.test.ts
**Depends on:** REQ-024

## Task

Persist keybindings in the main-process settings store and expose them over IPC:

1. In `src/main/settings.ts`, extend `DEFAULTS` with `keybindings: DEFAULT_KEYBINDINGS` (imported from `src/shared/keybindings.ts`) and add `setKeybindings(kb: Keybindings): Settings` to the `SettingsStore` interface and factory. Reject invalid input: if either combo fails `isValidCombo`, or `prevMovie === nextMovie`, throw an `Error` without writing.
2. Deep-merge on read: the existing `{ ...DEFAULTS, ...parsed }` spread must also merge `keybindings` field-wise (`{ ...DEFAULTS.keybindings, ...parsed.keybindings }`) so a legacy settings.json without the key — or with only one of the two combos — still yields complete bindings.
3. In `src/main/ipc.ts`, register `ipcMain.handle('settings:set-keybindings', (_e, kb: Keybindings) => settings.setKeybindings(kb))` following the existing `settings:set-api-key` pattern.

## Context

Brief: the keyboard combination must be editable in settings. Settings persistence is main-process-owned: `createSettingsStore` (`src/main/settings.ts`) writes JSON to disk and currently exposes only `setApiKey`/`addFolder`/`removeFolder` — ideate flagged that there is no generic setter, so a dedicated `setKeybindings` follows the established narrow-setter pattern. Validation lives here (server-side of the IPC boundary) so no renderer bug can persist an unusable or duplicate binding.

## Acceptance Criteria

- [x] `read()` on a settings file with no `keybindings` key returns `DEFAULT_KEYBINDINGS`; a file with only `prevMovie` set returns that value plus the default `nextMovie`
- [x] `setKeybindings({ prevMovie: 'Alt+[', nextMovie: 'Alt+]' })` persists to disk and a fresh `read()` returns the new combos
- [x] `setKeybindings` throws and leaves the file unchanged when either combo is invalid per `isValidCombo` or when both combos are identical
- [x] `settings:set-keybindings` is registered in `registerIpc` and delegates to `settings.setKeybindings`
- [x] Existing settings tests still pass; new cases added to `src/main/__tests__/settings.test.ts`

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/main/__tests__/settings.test.ts`
   - Expected: defaults-merge, persistence and rejection cases all pass (handoff: JSON file on disk → typed Settings)
2. **test** `npx vitest run`
   - Expected: full suite green
3. **build** `npm run build`
   - Expected: clean build, no type errors in main

## Integration

**Reachability:** Called via the IPC channel `settings:set-keybindings` registered in `registerIpc` (`src/main/ipc.ts:11`), invoked from the preload bridge (REQ-028); read path already flows through the existing `settings:get` handler (`src/main/ipc.ts:12`).

**Data dependencies:** Reads/writes the JSON settings file managed by `createSettingsStore` (`src/main/settings.ts:14`); extends the `DEFAULTS` constant (`src/main/settings.ts:5`).

**Service dependencies:** Imports `DEFAULT_KEYBINDINGS`, `isValidCombo` and the `Keybindings` type from `src/shared/keybindings.ts` / `src/shared/types.ts` (REQ-024); extends the `SettingsStore` interface (`src/main/settings.ts:7`).

## Outputs

- src/main/settings.ts — Added keybinding deep-merge reads, validated setKeybindings persistence, and invalid/duplicate rejection.
- src/main/ipc.ts — Registered settings:set-keybindings IPC handler delegating to the settings store.
- src/main/__tests__/settings.test.ts — Added settings-store and IPC coverage for keybinding defaults, persistence, rejection, and delegation.
