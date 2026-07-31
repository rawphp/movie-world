# REQ-045: Hydrate Persist Completed Art

<!-- claimed-start -->
**Claimed by:** Toms-MacBook-Pro.local.23552
**Claimed at:** 2026-07-31T03:43:50Z
**Heartbeat:** 2026-07-31T03:45:51Z
<!-- claimed-end -->

**UR:** UR-011
**Status:** in-progress
**Created:** 2026-07-31
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:** REQ-041
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** S
**Files:** src/main/library/manager.ts, src/main/library/cache.ts, src/main/library/__tests__/manager.test.ts, src/main/library/__tests__/cache.test.ts
**Depends on:**

## Task

Keep `completeCachedArtworkPaths` as a hydrate migration; after filling missing `cachedPosterPath`/`cachedFanartPath` from on-disk app-owned sidecars, persist the completed records so the next launch is a no-op for those fields. Still never probe Drive source paths during completion.

## Context

Brief item 4. REQ-040 already fills fields in memory on hydrate but does not write back — incomplete JSON stays incomplete forever if no other commit triggers persist.

## Acceptance Criteria

- [x] After hydrate completes artwork fields from disk, library cache JSON is written when any record changed.
- [x] Completion still only `exists` under appData/cache (no Drive poster/fanart probes).
- [x] Unit test: partial JSON + on-disk cache files → load fills fields AND a subsequent cache read (or written file parse) contains non-null cached paths.

## Verification Steps

1. **test** `npx vitest run src/main/library/__tests__/manager.test.ts src/main/library/__tests__/cache.test.ts`
   - Expected: hydrate completeness + persist assertions pass.
2. **build** `npm run typecheck`
   - Expected: clean.

## Integration

**Reachability:** `createLibraryManager().loadLibrary()` → `hydrateFromCache`.

**Data dependencies:** `createLibraryCache`, `completeCachedArtworkPaths`, settings folders filter.

**Service dependencies:** Existing cache write path (`persistCache` / `cache.write`).

## Assets

- (none)
