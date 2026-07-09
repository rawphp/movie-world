# REQ-035: Drive Cache Status UX

**UR:** UR-008
**Status:** backlog
**Created:** 2026-07-10
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 1
**Size:** M
**Files:** src/shared/types.ts, src/preload/index.ts, src/preload/index.d.ts, src/renderer/src/stores/library.ts, src/renderer/src/views/LibraryView.vue, src/renderer/src/stores/__tests__/library.test.ts
**Depends on:** REQ-033

## Task

Expose cached-first/offline scan status to the renderer so users can see that Movie World is using cached local data while Google Drive folders are unavailable or scanning in the background.

## Context

The requested problem is partly technical freeze and partly user trust: if launch becomes fast but the app silently shows stale cached data, users will not know whether Drive is still syncing or Movie World is broken. The existing `scan:progress` subscription is a good path to extend with cached/offline status without adding paid services.

## Acceptance Criteria

- [ ] The library store records whether the first view came from cache and whether a background scan is still running.
- [ ] The library view shows a concise cached/offline status message when cached data is visible while source folders are unavailable or still scanning.
- [ ] Existing empty-library behavior still appears only when there are no cached or scanned records.
- [ ] Existing scan progress updates continue to render in Settings.

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/renderer/src/stores/__tests__/library.test.ts src/renderer/src/views/__tests__/SettingsView.test.ts`
   - Expected: renderer tests cover cached-first status state and preserve scan progress behavior.
2. **test** `npx vitest run src/preload/__tests__/index.test.ts`
   - Expected: preload API typings/events expose any new status channel or payload shape safely.
3. **build** `npm run typecheck`
   - Expected: shared, preload, and renderer status changes compile cleanly.

## Manual checks (advisory)

- [ ] Launch Movie World with Google Drive disconnected after a prior successful scan - Observable outcome: user sees movies quickly plus a clear cached/offline status message rather than an apparent freeze or empty library.
