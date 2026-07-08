# REQ-009: Player — launch & watch-state stamping

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** commit:dc510a5 tests:passed
**Criteria approved:** agent-drafted
**Priority:** 1
**Size:** S
**Files:** src/main/player.ts, src/main/__tests__/player.test.ts
**Depends on:** REQ-005

## Task

Implement `playMovie(movie, deps?): Promise<MovieRecord>` in `src/main/player.ts` — verify the file still exists, launch the OS default player via `shell.openPath` (injectable), then increment `<playcount>`, set `<lastplayed>` to now, rewrite the NFO, and return the updated record. If the file is gone, set `fileMissing: true` and do NOT launch. TDD with injected `openPath` and `now`.

## Context

From the plan (Task 8): default `openPath` is Electron's `shell.openPath`; `now` is injectable for deterministic tests. Watch state is stamped on Play (playcount++ and lastplayed=now) and persisted via `writeSidecarNfo` (REQ-005) — never in a separate store. Design decision: "clicked Play" counts as watched (the app cannot know if the user finished the movie).

## Acceptance Criteria

- [ ] For an existing file, `playMovie` calls the injected `openPath` with the movie's file path.
- [ ] After a successful launch, the returned record has `playCount` incremented by 1 and `lastPlayedAt` set to the injected `now()` (ISO 8601), and `writeSidecarNfo` was called with the updated record.
- [ ] For a missing file, `playMovie` returns a record with `fileMissing: true` and does NOT call `openPath`.
- [ ] The player test passes under `npx vitest run` using injected `openPath`/`now`.

## Verification Steps

1. **test** `npx vitest run src/main/__tests__/player.test.ts` — Expected: launch+stamp path, no-launch-when-missing path, and NFO rewrite all pass with injected deps.
2. **build** `npx tsc --noEmit` — Expected: exit 0.
3. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.

## Integration

**Reachability:** `playMovie` is called by the library manager's `play(id)` (REQ-010), which is reached from the renderer's Play button (MovieCard / MovieDetailView) via `window.api.play` (REQ-011/012).

**Data dependencies:** Reads the movie's `filePath`; rewrites the NFO's `<playcount>`/`<lastplayed>` (REQ-005). Operates on `MovieRecord` (`@shared/types`, REQ-002).

**Service dependencies:** Electron `shell.openPath` (injected, default) to launch the external player; `writeSidecarNfo` (REQ-005).
