# REQ-040: Cache Art Completeness On Load

<!-- claimed-start -->
**Claimed by:** Toms-MacBook-Pro.local.14770
**Claimed at:** 2026-07-31T01:08:56Z
**Heartbeat:** 2026-07-31T01:08:56Z
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
**Priority:** 1
**Size:** S
**Files:** src/main/library/manager.ts, src/main/library/cache.ts, src/main/library/__tests__/manager.test.ts, src/main/library/__tests__/cache.test.ts
**Depends on:** REQ-038

## Task

Ensure library records returned from local cache always expose usable app-owned artwork path fields when the cache files exist on disk, so the renderer never falls back to Drive `posterPath`/`fanartPath` for first paint after a warm start.

## Context

`artSrc` prefers `cachedPosterPath` only when set; older or partially written `library-records.json` entries may store Drive `posterPath` with null `cachedPosterPath` even if sidecars were later mirrored under userData (`cache/sidecars/...`). User sees titles (metadata cache works) but almost no posters — consistent with missing cache fields. On hydrate, resolve/fill `cachedPosterPath`/`cachedFanartPath` from `cachedSidecarPathsFor` when those files exist, without probing Drive.

## Acceptance Criteria

- [ ] `hydrateFromCache` (or a post-read normalizer) sets `cachedPosterPath` / `cachedFanartPath` when the corresponding app-owned sidecar cache files exist, even if the stored JSON omitted those fields.
- [ ] Normalization does not call `existsSync`/`stat` on Google Drive source paths — only on paths under the app data cache directory.
- [ ] Unit test covers a cache file with Drive-only `posterPath` and on-disk cached poster → load result includes non-null `cachedPosterPath` pointing under appData.

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/main/library/__tests__/manager.test.ts src/main/library/__tests__/cache.test.ts`
   - Expected: hydrate completeness test passes.
2. **build** `npm run typecheck`
   - Expected: cache normalization typechecks.

## Manual checks (advisory)

- [ ] After one successful prior launch that populated cache, quit and relaunch with cloud-only Drive posters — Observable outcome: most/all posters appear from cache without freeze.

## Assets

- (none)
