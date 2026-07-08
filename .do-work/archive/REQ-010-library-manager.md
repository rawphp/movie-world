# REQ-010: Library manager — orchestration

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** commit:adbf0aa tests:passed
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** L
**Files:** src/main/library/manager.ts, src/main/library/__tests__/manager.test.ts
**Depends on:** REQ-003, REQ-007, REQ-008, REQ-009

## Task

Implement `createLibraryManager(opts)` in `src/main/library/manager.ts` — the in-memory library orchestrator. Provide `loadLibrary()`, `rescanFolder(folder)`, `fixMatch(id, tmdbId)`, `retryFetch(id)`, `play(id)`, and `getMovies()`. Every state change routes through a private `commit(movie)` that updates the in-memory Map AND calls `emit('movie:updated', movie)`. TDD with injected settings, `makeClient`, `emit`, `downloadImage`, and `playDeps`.

## Context

From the plan (Task 9): `loadLibrary` scans every registered folder, ingests all files, returns the full list immediately, and enqueues TMDB fetches for `pending` files only when an API key is set. `rescanFolder` adds new files, flags vanished ones `fileMissing`, and never deletes records mid-session or touches user files (only sidecars). `fixMatch` re-fetches against the given tmdbId and emits; `retryFetch` re-enqueues a `fetchFailed` movie; `play` delegates to `playMovie` (REQ-009). Per ideate (Connector): the `commit(movie)` invariant is the single choke point keeping disk ↔ memory ↔ renderer in sync — no module may emit directly. `fixMatch`'s raw-ID path must route through `applyDetails`/`fetchAndApply` so the rewritten NFO is identical to the auto-match path.

## Acceptance Criteria

- [ ] `loadLibrary()` scans all registered folders, returns the complete `MovieRecord[]` immediately, and enqueues TMDB fetches for `pending` movies only when `settings.read().tmdbApiKey` is non-null.
- [ ] `rescanFolder(folder)` adds newly discovered files and flags files that vanished from disk as `fileMissing`, without deleting existing records mid-session.
- [ ] `fixMatch(id, tmdbId)` re-fetches details for the given TMDB id through the shared `fetchAndApply`/`applyDetails` pipeline (REQ-006/008) and emits the updated record.
- [ ] `retryFetch(id)` re-enqueues a movie whose `fetchFailed` is true.
- [ ] `play(id)` delegates to `playMovie` (REQ-009) and emits the updated record.
- [ ] Every mutation (scan ingest, fetch update, play, fixMatch, retry) results in exactly one `emit('movie:updated', movie)` per changed record, routed through the private `commit`; `getMovies()` reflects the committed state.
- [ ] A `writeSidecarNfo` failure surfaces as `sidecarWriteFailed: true` on the committed record (session still shows the movie), never an unhandled throw.
- [ ] The manager test passes under `npx vitest run` with all deps injected.

## Verification Steps

1. **test** `npx vitest run src/main/library/__tests__/manager.test.ts` — Expected: load/rescan/fixMatch/retry/play paths pass; asserts fetches enqueue only when an API key is set, `fileMissing` flagging on rescan, and that every mutation emits exactly once via `commit`.
2. **build** `npx tsc --noEmit` — Expected: exit 0.
3. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.

## Integration

**Reachability:** Instantiated once in `src/main/index.ts` (REQ-011); its methods are the delegation targets for every `ipcMain.handle` in `src/main/ipc.ts` (REQ-011), which the renderer reaches via `window.api` (REQ-012).

**Data dependencies:** Reads settings (folders + API key, REQ-003); scans/ingests files (REQ-007); writes NFO/artwork sidecars via the fetch queue (REQ-008) and player (REQ-009). Holds the authoritative in-memory `Map<id, MovieRecord>`.

**Service dependencies:** `SettingsStore` (REQ-003), scanner (REQ-007), fetch queue (REQ-008), player (REQ-009), TMDB client factory (REQ-006, via `makeClient`). `emit` is injected so the IPC layer wires it to `webContents.send`.
