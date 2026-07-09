# REQ-033: Cached-First Startup

**UR:** UR-008
**Status:** done
**Created:** 2026-07-10
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** checkpoint_log:passed commit:39d7487
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/main/library/manager.ts, src/main/library/__tests__/manager.test.ts, src/main/index.ts
**Depends on:** REQ-031, REQ-032

## Task

Change library startup so `loadLibrary()` returns cached records immediately and performs folder discovery/sidecar reconciliation in the background instead of blocking the renderer until every Google Drive folder has been scanned.

## Context

`LibraryView.vue` awaits `store.load()`, and `store.load()` awaits `window.api.loadLibrary()`. Today `loadLibrary()` scans each registered folder before returning, so a Google Drive folder that hydrates files on demand can freeze the whole first screen. The manager already emits updates and progress, so the free fix is to make scanning asynchronous after cached records are returned.

## Acceptance Criteria

- [x] `loadLibrary()` returns cached records before any slow folder scan has to complete.
- [x] Background scans still emit `movie:updated` and `scan:progress` events through the existing IPC path.
- [x] If a registered folder is missing or offline, cached movies from that folder remain visible and are not marked missing during the initial cached-first load.
- [x] Manual rescan still performs an explicit scan and can mark vanished files missing after the user requests it.

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/main/library/__tests__/manager.test.ts`
   - Expected: manager tests prove cached-first return, background scan updates, offline-folder preservation, and explicit rescan behavior.
2. **build** `npm run typecheck`
   - Expected: manager changes compile cleanly.

## Manual checks (advisory)

- [ ] Launch Movie World while a Google Drive movie folder is offline - Observable outcome: the library screen paints from cache quickly and scan progress appears only if/when background discovery can proceed.

## Outputs

- src/main/library/manager.ts - Loads cached records first, schedules non-blocking startup scans, persists cache, and reserves missing-file marking for explicit rescans.
- src/main/library/__tests__/manager.test.ts - Covers cached-first load, background scan events, offline-folder preservation, and explicit rescan behavior.
- src/main/index.ts - Passes Electron userData path into the library manager so production startup uses the app-owned cache.
