# REQ-046: Startup Cache Art Backfill

**UR:** UR-011
**Status:** backlog
**Created:** 2026-07-31
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:** REQ-041
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** M
**Files:** src/main/library/manager.ts, src/main/library/scanner.ts, src/main/library/__tests__/manager.test.ts
**Depends on:** REQ-044

## Task

On startup scan, re-touch records that are already known but missing cache art fields (or missing on-disk cache files): asynchronously mirror from Drive source when needed with **concurrency 2**, update records via commit, never block `loadLibrary` return. Brand-new files still ingest as today. Placeholders remain until backfill completes.

## Context

Brief item 5 + clarifications: may mirror from Drive; pool size 2; never blocks first paint. Today `scanOne` skips `ingestFile` for every existing filePath — incomplete cache never heals. Code review blocker.

Prefer explicit “needs cache art” detection over full re-ingest of metadata when only art is missing. Must not mark missing on startup.

## Acceptance Criteria

- [ ] Startup path identifies existing movies missing usable `cachedPosterPath`/`cachedFanartPath` (null or cache file absent) and schedules backfill work.
- [ ] Backfill uses max 2 concurrent source→cache mirror/resolve operations.
- [ ] `loadLibrary` still returns cached movies before backfill finishes.
- [ ] Successful backfill commits updated cache art fields and persists library cache.
- [ ] Unit test: cached record with Drive posterPath, null cachedPosterPath, source art present in temp FS → after idle, movie has non-null cachedPosterPath under appData; loadLibrary returned before that work finished.

## Verification Steps

1. **test** `npx vitest run src/main/library/__tests__/manager.test.ts`
   - Expected: backfill + non-blocking loadLibrary assertions pass.
2. **build** `npm run typecheck`
   - Expected: clean.

## Integration

**Reachability:** Background `scheduleStartupScan` after `loadLibrary` (`src/main/library/manager.ts`).

**Data dependencies:** In-memory movies map, `cachedSidecarPathsFor`, source `sidecarPathsFor`.

**Service dependencies:** `ingestFile` / artwork resolve helpers; `commit` + `persistCache`; scan progress IPC optional.

## Assets

- (none)
