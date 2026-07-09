# REQ-028: Preload bridge for keybindings

**UR:** UR-006
**Status:** done
**Created:** 2026-07-09
**Layer:** preload
**Entry point:**
**Terminal state:**
**Parent:** REQ-026
**Closure proof:** checkpoint_log:passed commit:4183f85
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** S
**Files:** src/preload/**tests**/index.test.ts, src/preload/index.d.ts, src/preload/index.ts
**Depends on:** REQ-024, REQ-027

## Task

Expose the keybindings setter on the `window.api` contextBridge surface:

1. In `src/preload/index.ts`, add `setKeybindings: (kb: Keybindings) => ipcRenderer.invoke('settings:set-keybindings', kb)` following the existing `setApiKey` pattern.
2. In `src/preload/index.d.ts`, add `setKeybindings(kb: Keybindings): Promise<Settings>` to the `Window['api']` declaration and import the `Keybindings` type from `../shared/types`.

No change is needed for reading — `getSettings()` already returns the full `Settings` object, which includes `keybindings` once REQ-024/REQ-027 land.

## Context

Brief: the keyboard combination must be editable in settings. The renderer cannot touch `ipcRenderer` directly; every settings mutation goes through the contextBridge surface defined in `src/preload/index.ts` (e.g. `setApiKey` at line 5). This REQ extends that surface with the one new method the recorder UI (REQ-029) needs.

## Acceptance Criteria

- [x] `window.api.setKeybindings` exists on the exposed bridge and invokes the `settings:set-keybindings` channel with the passed `Keybindings` object
- [x] `src/preload/index.d.ts` declares `setKeybindings(kb: Keybindings): Promise<Settings>` and the project typechecks — renderer code calling `window.api.setKeybindings` compiles without casts
- [x] Channel name matches the handler registered in `src/main/ipc.ts` exactly (`settings:set-keybindings`)

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `grep -n "settings:set-keybindings" src/preload/index.ts src/main/ipc.ts`
   - Expected: both files reference the identical channel string (handoff: preload invoke → main handler)
2. **build** `npm run build`
   - Expected: clean build; preload bundle compiles with the new method and type declaration
3. **test** `npx vitest run`
   - Expected: full suite green

## Integration

**Reachability:** Consumed by the renderer as `window.api.setKeybindings` — the same `window.api` surface SettingsView already uses (`src/renderer/src/views/SettingsView.vue:5`); type contract lives in `src/preload/index.d.ts:6`.

**Data dependencies:** None of its own — passes the `Keybindings` payload through to main; return value is the persisted `Settings` from `src/main/settings.ts`.

**Service dependencies:** Invokes the `settings:set-keybindings` IPC channel registered in `src/main/ipc.ts` (REQ-027), via `ipcRenderer.invoke` exactly like `setApiKey` (`src/preload/index.ts:5`).

## Outputs

- src/preload/index.ts — Added setKeybindings bridge method invoking settings:set-keybindings with the provided Keybindings payload.
- src/preload/index.d.ts — Added Keybindings import and typed Window api setKeybindings(kb) as Promise<Settings>.
- src/preload/**tests**/index.test.ts — Added focused Vitest coverage proving the preload API exposes setKeybindings on the correct IPC channel.
