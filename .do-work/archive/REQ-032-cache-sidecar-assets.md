# REQ-032: Cache Sidecar Assets

**UR:** UR-008
**Status:** done
**Created:** 2026-07-10
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** checkpoint_log:passed commit:19ea4a7
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** M
**Files:** src/main/library/nfo.ts, src/main/library/scanner.ts, src/main/library/__tests__/nfo.test.ts, src/main/library/__tests__/scanner.test.ts
**Depends on:** REQ-031

## Task

Teach metadata/artwork ingestion to mirror useful `.nfo`, poster, and fanart data into app-owned cache paths and prefer cached copies when Google Drive sidecars are unavailable.

## Context

The current `sidecarPathsFor()` design stores `.nfo`, poster, and fanart next to the movie file. That keeps data portable, but it makes Google Drive availability part of the launch path. The app should keep the sidecars as an import/export source while maintaining local cached copies for startup and display.

## Acceptance Criteria

- [x] Ingestion can read previously cached metadata when the source `.nfo` next to the movie file is absent or unavailable.
- [x] Ingestion can map poster and fanart to app-owned cached paths when cached artwork exists.
- [x] Source sidecars remain supported so existing movie folders keep working and can refresh the cache when available.
- [x] Missing source artwork does not clear a valid cached artwork path during startup.

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/main/library/__tests__/nfo.test.ts src/main/library/__tests__/scanner.test.ts`
   - Expected: sidecar read/write tests still pass, and scanner tests cover source-missing/cache-present metadata and artwork behavior.
2. **build** `npm run typecheck`
   - Expected: metadata and scanner changes compile cleanly.

## Manual checks (advisory)

- [ ] Open a library whose Google Drive artwork files are not hydrated - Observable outcome: cached poster/fanart still appears when the app has a local cached copy.

## Outputs

- src/main/library/nfo.ts - Adds deterministic app-owned cached sidecar paths and cached NFO fallback/refresh support.
- src/main/library/scanner.ts - Adds ingest options for app data cache paths plus artwork cache refresh and fallback behavior.
- src/main/library/__tests__/nfo.test.ts - Covers cached sidecar path mapping, cached NFO fallback, and cache refresh from source NFO.
- src/main/library/__tests__/scanner.test.ts - Covers cached metadata/artwork ingestion, source sidecar cache refresh, and preserving cached artwork when source art is missing.
