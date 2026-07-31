# REQ-039: Nonblocking Background Drive Scan

<!-- claimed-start -->
**Claimed by:** Toms-MacBook-Pro.local.90875
**Claimed at:** 2026-07-31T01:03:46Z
**Heartbeat:** 2026-07-31T01:03:46Z
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
**Files:** src/main/library/manager.ts, src/main/library/scanner.ts, src/main/library/__tests__/manager.test.ts, src/main/library/__tests__/scanner.test.ts
**Depends on:** REQ-037

## Task

Make the post-`loadLibrary` background folder scan safe against Google Drive cloud-only hydration so discovery and sidecar reconciliation cannot freeze the Electron main process (and thus the UI) after the cached library grid has painted.

## Context

`loadLibrary()` already returns cache first and schedules `scanOne` via `scheduleStartupScan` (REQ-033). That background work still walks folders with `readdir`, `stat`, and sync `existsSync`/`copyFileSync` on Drive sidecars (`scanner.ts`). Clarifications: freeze is post-grid with loading cursor — consistent with main-process event-loop stall during background scan. Honor UR-008 decision: free app-owned cache + background rescan; do not mark cached movies missing on startup when Drive is slow/offline. REQ-037 diagnosis must confirm scan involvement; implement non-blocking / yield / async / skip-source-probe behavior accordingly.

## Acceptance Criteria

- [ ] Cached-first `loadLibrary()` still returns before any folder walk completes (existing REQ-033 contract preserved).
- [ ] Background startup scan does not perform synchronous Drive-source probes (`existsSync`/`copyFileSync` on movie-folder sidecars) on the critical path when app-owned cache already supplies NFO/artwork for that file — or equivalent proven strategy from REQ-037 that keeps the main process responsive under a slow-FS test double.
- [ ] Under a unit test that makes folder `readdir`/`stat`/sidecar probes artificially slow, the manager still returns cached movies immediately and the slow work does not run inside the `loadLibrary` await (and, where measurable, yields or avoids sync main-thread stalls in the simulated path).
- [ ] Startup scan still emits `scan:progress` / `movie:updated` when it can proceed; missing/offline folders do not wipe cached titles on the initial cached-first load (`markMissing: false` for startup).
- [ ] Explicit `rescanFolder` may still fully reconcile and mark missing files (existing manual-rescan contract).

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/main/library/__tests__/manager.test.ts src/main/library/__tests__/scanner.test.ts`
   - Expected: cached-first, offline/slow-folder, and nonblocking-scan assertions pass.
2. **build** `npm run typecheck`
   - Expected: manager/scanner changes compile cleanly.

## Manual checks (advisory)

- [ ] Launch Movie World with a large Google Drive library while files are cloud-only — Observable outcome: UI stays interactive (scroll/click) after grid paint while any background scan runs; titles remain visible from cache.

## Assets

- (none)
