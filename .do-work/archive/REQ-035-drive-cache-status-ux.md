# REQ-035: Drive Cache Status UX

**UR:** UR-008
**Status:** done
**Created:** 2026-07-10
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** checkpoint_log:passed commit:0bbd44b
**Criteria approved:** agent-drafted
**Priority:** 1
**Size:** M
**Files:** src/main/library/__tests__/manager.test.ts, src/main/library/manager.ts, src/preload/__tests__/index.test.ts, src/preload/index.d.ts, src/preload/index.ts, src/renderer/src/stores/__tests__/library.test.ts, src/renderer/src/stores/library.ts, src/renderer/src/views/LibraryView.vue, src/renderer/src/views/__tests__/LibraryView.test.ts, src/shared/types.ts
**Depends on:** REQ-033

## Task

Expose cached-first/offline scan status to the renderer so users can see that Movie World is using cached local data while Google Drive folders are unavailable or scanning in the background.

## Context

The requested problem is partly technical freeze and partly user trust: if launch becomes fast but the app silently shows stale cached data, users will not know whether Drive is still syncing or Movie World is broken. The existing `scan:progress` subscription is a good path to extend with cached/offline status without adding paid services.

## Acceptance Criteria

- [x] The library store records whether the first view came from cache and whether a background scan is still running.
- [x] The library view shows a concise cached/offline status message when cached data is visible while source folders are unavailable or still scanning.
- [x] Existing empty-library behavior still appears only when there are no cached or scanned records.
- [x] Existing scan progress updates continue to render in Settings.

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/renderer/src/stores/__tests__/library.test.ts src/renderer/src/views/__tests__/LibraryView.test.ts src/renderer/src/views/__tests__/SettingsView.test.ts`
   - Expected: renderer tests cover cached-first store state, visible cached/offline status messaging, and preserved scan progress behavior.
2. **test** `npx vitest run src/preload/__tests__/index.test.ts`
   - Expected: preload API typings/events expose any new status channel or payload shape safely.
3. **build** `npm run typecheck`
   - Expected: shared, preload, and renderer status changes compile cleanly.

## Manual checks (advisory)

- [ ] Launch Movie World with Google Drive disconnected after a prior successful scan - Observable outcome: user sees movies quickly plus a clear cached/offline status message rather than an apparent freeze or empty library.

## Outputs

- src/shared/types.ts - Adds LibraryLoadResult/status types and optional scan progress unavailable flag.
- src/main/library/manager.ts - Returns cached-first load status and marks unavailable startup folders in scan progress.
- src/main/library/__tests__/manager.test.ts - Covers cached-first load status and offline startup folder progress.
- src/preload/index.ts - Types loadLibrary bridge as returning the cached-first load result.
- src/preload/index.d.ts - Updates renderer window.api loadLibrary contract.
- src/preload/__tests__/index.test.ts - Covers library load IPC bridge payload.
- src/renderer/src/stores/library.ts - Tracks cached-first, background scan, unavailable folder, and cache status message state.
- src/renderer/src/stores/__tests__/library.test.ts - Covers cached-first store state and scan progress status updates.
- src/renderer/src/views/LibraryView.vue - Shows concise cached/offline status message and keeps empty state scoped to no records.
- src/renderer/src/views/__tests__/LibraryView.test.ts - Covers cached/offline status rendering and empty-library behavior.
