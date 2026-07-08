# REQ-012: Preload bridge (window.api)

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** preload
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** commit:864b8af tests:passed
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/preload/index.ts, src/preload/index.d.ts
**Depends on:** REQ-011

## Task

Implement the preload contextBridge in `src/preload/index.ts` exposing the typed `window.api` — the renderer's ONLY door to the system — plus the `src/preload/index.d.ts` type augmentation. Every method maps to an IPC invoke/handler (REQ-011); the two `on*` subscription methods bridge `movie:updated` and `scan:progress` events to renderer callbacks.

## Context

From the plan (Task 10): with `contextIsolation: true`, the renderer has no Node/fs access — everything goes through the preload-exposed `window.api`. The exact `WindowApi` interface is specified: `getSettings`, `setApiKey`, `addFolder` (returns `Settings | null`), `removeFolder`, `loadLibrary`, `rescanFolder`, `play`, `retryFetch`, `fixMatch`, `searchTmdb`, `revealFile`, `onMovieUpdated(cb)`, `onScanProgress(cb)`. Renderer tasks (REQ-013–016) depend on every name and signature here, so match them exactly.

## Acceptance Criteria

- [ ] `window.api` exposes all 13 members of the `WindowApi` interface with the exact names and signatures from the plan.
- [ ] Each request method calls `ipcRenderer.invoke` on the channel handled in REQ-011 and returns the typed result (`addFolder` resolves `Settings | null`).
- [ ] `onMovieUpdated(cb)` and `onScanProgress(cb)` register `ipcRenderer.on` listeners that invoke `cb` with the `MovieRecord` / `ScanProgress` payload.
- [ ] `src/preload/index.d.ts` augments `Window` so `window.api` is typed in the renderer (`npx tsc --noEmit` sees the type).
- [ ] `npx tsc --noEmit` and `npx eslint . --max-warnings 0` pass.

## Verification Steps

1. **build** `npx tsc --noEmit` — Expected: exit 0; `window.api` is typed via `index.d.ts` and matches the `WindowApi` contract consumed by the renderer.
2. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.
3. **build** `npm run build` — Expected: the preload bundle builds; no errors.

## Post-merge validation

- [ ] In `npm run dev` devtools console, evaluate `Object.keys(window.api)` — Observable outcome: all 13 API members are present and callable (contextBridge exposed them; no `window.api is undefined`).

## Integration

**Reachability:** The preload script is loaded by the `BrowserWindow` `webPreferences.preload` set in `src/main/index.ts` (REQ-011). `window.api` is imported/called by the Pinia store (REQ-013) and every renderer view/component (REQ-014–016).

**Data dependencies:** Carries `Settings`, `MovieRecord`, `ScanProgress`, and `TmdbSearchResult` payloads (`@shared/types`, REQ-002) across the IPC boundary. Holds no state itself.

**Service dependencies:** Electron `contextBridge` + `ipcRenderer`; the main-process IPC handlers (REQ-011) on the other end of every channel.
