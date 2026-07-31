# REQ-038: Nonblocking Artwork Paths

<!-- claimed-start -->
**Claimed by:** Toms-MacBook-Pro.local.68555
**Claimed at:** 2026-07-31T00:58:31Z
**Heartbeat:** 2026-07-31T00:58:31Z
<!-- claimed-end -->

**UR:** UR-010
**Status:** in-progress
**Created:** 2026-07-31
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/main/art-protocol.ts, src/main/__tests__/art-protocol.test.ts, src/main/library/scanner.ts, src/main/library/__tests__/scanner.test.ts, src/renderer/src/lib/art.ts, src/renderer/src/components/MovieCard.vue, src/renderer/src/views/MovieDetailView.vue, src/shared/types.ts
**Depends on:** REQ-037

## Task

Eliminate main-process freezes caused by serving or resolving Google Drive artwork during first paint: ensure grid/detail artwork never sync-reads cloud-backed source sidecars when app-owned cache paths exist, and make `serveArtFile` fail fast for unavailable/cloud paths so one missing poster cannot stall the entire UI.

## Context

User symptoms (titles visible, almost no posters, loading cursor after grid paint) match many concurrent `mw-art://` requests hitting Drive `posterPath` values while `cachedPosterPath` is null/missing, or `serveArtFile` blocking on `existsSync`/`readFileSync` for cloud-only files. REQ-034 already prefers cache in `artSrc`, but `resolveArtworkPath` still probes Drive first and stores Drive paths as `posterPath`. Reuse `cachedSidecarPathsFor` / `artSrc` — harden the path, do not redesign caching. Implement the fix that REQ-037's root-cause evidence points at if diagnosis confirms art-path blocking; if diagnosis points only at scan, keep this REQ's fail-fast art guarantees as defense in depth with tests that prove Drive paths are not read when cache exists.

## Acceptance Criteria

- [ ] When a movie record has an app-owned cached poster (or fanart) path that exists under userData cache, rendered `mw-art` URLs use that path and `serveArtFile` never opens the Drive source sidecar for that request.
- [ ] `resolveArtworkPath` (or equivalent) does not require a successful `existsSync`/`readFileSync` on the Drive source path in order to return a usable cached path when the cache file already exists.
- [ ] `serveArtFile` returns a fast 404-style response for missing or unreadable artwork without throwing and without multi-second blocking in unit tests that simulate slow source FS on non-cache paths.
- [ ] Existing CSP and `mw-art://` encoding behavior remain compatible with MovieCard and MovieDetailView tests.

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/main/__tests__/art-protocol.test.ts src/main/library/__tests__/scanner.test.ts src/renderer/src/components/__tests__/MovieCard.test.ts src/renderer/src/views/__tests__/MovieDetailView.test.ts`
   - Expected: cache preference, fail-fast missing art, and no-Drive-when-cache-exists assertions all pass.
2. **build** `npm run typecheck`
   - Expected: path and protocol changes typecheck cleanly.

## Manual checks (advisory)

- [ ] Launch with cloud-only Drive posters after a prior successful cache populate — Observable outcome: grid paints posters from cache without mouse loading freeze; missing cache shows placeholders, not a multi-second whole-app stall.

## Assets

- (none)
