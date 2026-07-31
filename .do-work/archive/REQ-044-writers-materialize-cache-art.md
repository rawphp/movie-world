# REQ-044: Writers Materialize Cache Art


**UR:** UR-011
**Status:** done
**Created:** 2026-07-31
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:** REQ-041
**Closure proof:** checkpoint:.do-work/runs latest REQ-044 commit:60495a7
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** M
**Files:** src/main/tmdb/fetcher.ts, src/main/tmdb/__tests__/fetcher.test.ts, src/main/library/manager.ts
**Depends on:**

## Task

Ensure `fetchAndApply` and `ingestFile` always materialize poster/fanart (and NFO as already) under `cachedSidecarPathsFor` when appDataPath is available. Optionally still write Drive/movie-folder sidecars for Kodi compatibility as best-effort — match/paint success requires cache materialize only. Set `cachedPosterPath`/`cachedFanartPath` from app-owned paths.

## Context

Brief item 2 + clarification: cache required; Drive best-effort (failures → `sidecarWriteFailed` / swallow art write, not failed match for cache-success). Today `fetchAndApply` writes only `sidecarPathsFor` and never sets cache fields — root of permanent 404 after protocol fail-fast.

Reuse `cachedSidecarPathsFor`, existing `mirrorArtwork` / write helpers; invert priority so cache is primary write target.

## Acceptance Criteria

- [x] `fetchAndApply` with appDataPath downloads/writes poster and fanart under userData cache and sets `cachedPosterPath`/`cachedFanartPath` to those paths when download succeeds.
- [x] Drive/source sidecar art writes (if still performed) are best-effort: failure does not clear successful cache fields or prevent matched status solely due to Drive write failure.
- [x] Failed cache write (download or fs write under userData cache) does not set non-null `cachedPosterPath`/`cachedFanartPath` for that asset.
- [x] `ingestFile` continues to resolve cache-first and sets cache fields when cache files exist or after successful mirror into cache.
- [x] Unit tests prove TMDB apply sets cache paths under a temp appDataPath without requiring Drive paths to be readable for display fields.

## Verification Steps

1. **test** `npx vitest run src/main/tmdb/__tests__/fetcher.test.ts src/main/library/__tests__/scanner.test.ts`
   - Expected: pass; cache materialize assertions green.
2. **build** `npm run typecheck`
   - Expected: clean.

## Integration

**Reachability:** Match queue / fix-match / startup ingest (`createFetchQueue`, `fetchAndApply`, `ingestFile` via `createLibraryManager`).

**Data dependencies:** `MovieRecord`, `sidecarPathsFor`, `cachedSidecarPathsFor` (`src/main/library/nfo.ts`).

**Service dependencies:** TMDB client image URLs; downloadImage injectable; library manager commit path.

## Assets

- (none)

## Outputs

- src/main/tmdb/fetcher.ts — Cache-primary art/NFO materialize in fetchAndApply; appDataPath on queue
- src/main/tmdb/__tests__/fetcher.test.ts — REQ-044 unit tests for cache materialize and Drive best-effort
- src/main/library/manager.ts — Pass appDataPath into createFetchQueue and fixMatch fetchAndApply
