# REQ-031: Local Library Cache

<!-- claimed-start -->
**Claimed by:** Toms-MacBook-Pro.local.20260709204505
**Claimed at:** 2026-07-09T20:46:10Z
**Heartbeat:** 2026-07-09T20:46:10Z
<!-- claimed-end -->

**UR:** UR-008
**Status:** in-progress
**Created:** 2026-07-10
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** M
**Files:** src/main/library/cache.ts, src/main/library/__tests__/cache.test.ts, src/shared/types.ts
**Depends on:**

## Task

Create an app-owned local library cache that persists `MovieRecord` data outside the Google Drive movie directory, using only local disk storage under the Electron app data/cache area.

## Context

The request says launch freezes because `.nfo` and artwork live in a Google Drive-backed movie directory that may be offline. The free solution starts by giving Movie World a local source for previously known library records so startup no longer depends on Drive hydration.

## Acceptance Criteria

- [ ] A cache module can write and read a list of `MovieRecord` objects from an app-owned path that is not inside a registered movie folder.
- [ ] Cache reads tolerate a missing cache file by returning an empty list without throwing.
- [ ] Cache reads tolerate corrupt JSON by returning an empty list and preserving the app startup path.
- [ ] Cached records preserve file paths, metadata, match status, play state, and artwork path fields.

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/main/library/__tests__/cache.test.ts`
   - Expected: cache read/write, missing-file, corrupt-file, and record preservation tests pass.
2. **build** `npm run typecheck`
   - Expected: TypeScript accepts the new cache module and shared type usage without errors.

## Manual checks (advisory)

- [ ] Launch Movie World after a previous library scan with Google Drive disconnected - Observable outcome: the app can use app-owned cached records without requiring Drive files to hydrate first.
