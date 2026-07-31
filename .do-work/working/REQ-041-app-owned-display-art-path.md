# REQ-041: App-Owned Display Art Path

<!-- claimed-start -->
**Claimed by:** Toms-MacBook-Pro.local.92898
**Claimed at:** 2026-07-31T04:01:24Z
**Heartbeat:** 2026-07-31T04:01:24Z
<!-- claimed-end -->

**UR:** UR-011
**Status:** in-progress
**Created:** 2026-07-31
**Layer:** none
**Entry point:** User launches Movie World with a warm `library-records.json` (and/or incomplete cache fields) against a Google Drive movie folder (cloud-only posters).
**Terminal state:** Library grid paints titles immediately; every poster/fanart `img` `src` is either empty (placeholder) or an `mw-art://` URL under app `userData/cache`; no Drive source paths are requested for paint; records missing cache art recover via async backfill (concurrency 2) without freezing first paint.
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** L
**Files:** src/shared/types.ts, src/renderer/src/lib/art.ts, src/main/tmdb/fetcher.ts, src/main/library/scanner.ts, src/main/library/manager.ts, src/main/library/cache.ts, src/main/art-protocol.ts, src/main/startup-timings.ts, src/main/index.ts
**Depends on:** REQ-042, REQ-043, REQ-044, REQ-045, REQ-046, REQ-047, REQ-048

## Task

Close the end-to-end path that makes app-owned artwork the only paint path for Movie World: display contract, writers, hydrate+persist, startup backfill, strict protocol, and explicit scan mode / timing hygiene. This path-unit owns the user-visible closure criteria; child REQs implement the layers.

## Context

UR-010 made `serveArtFile` fail-fast for non-cache paths while writers (`fetchAndApply`) still materialize Drive-only `posterPath`s and startup scan skips re-ingest of existing records — permanent blank posters. Code review + brief: one display contract, writers always fill cache, optional Drive best-effort, backfill may mirror Drive async (pool 2), keep field names `cachedPosterPath`/`cachedFanartPath`.

Reuse `cachedSidecarPathsFor`, `completeCachedArtworkPaths`, `isAppOwnedCachePath` — do not invent a second cache tree (UR-008/010 decisions).

## Acceptance Criteria

- [ ] On warm start, renderer never builds `mw-art` URLs from Drive `posterPath`/`fanartPath` for grid or detail paint.
- [ ] After TMDB match and after ingest, records that successfully cache art expose non-null `cachedPosterPath` and/or `cachedFanartPath` under userData cache.
- [ ] Incomplete records (null cache fields but source/cache recoverable) receive backfill updates without blocking `loadLibrary` return.
- [ ] Production `serveArtFile` only opens paths under `{userData}/cache` and does not full-copy image buffers.
- [ ] Startup vs rescan use an explicit mode (not `preferCache = !markMissing`).

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/main/library/__tests__/manager.test.ts src/main/library/__tests__/scanner.test.ts src/main/tmdb/__tests__/fetcher.test.ts src/main/__tests__/art-protocol.test.ts src/renderer/src/components/__tests__/MovieCard.test.ts src/renderer/src/views/__tests__/MovieDetailView.test.ts`
   - Expected: all pass; contracts for cache-only display, writers, backfill, protocol covered.
2. **build** `npm run typecheck`
   - Expected: clean.

## Manual checks (advisory)

- [ ] Launch packaged or dev app with Google Drive library after one prior cache populate — Observable outcome: posters appear from cache without mouse loading freeze; if some posters missing, they fill in after background backfill without UI stall.
- [ ] Force incomplete cache (null `cachedPosterPath` in JSON but mirror file present or Drive source available) — Observable outcome: hydrate or backfill restores paint without requiring full rescan.

## Assets

- (none)
