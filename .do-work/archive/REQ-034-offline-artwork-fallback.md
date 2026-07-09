# REQ-034: Offline Artwork Fallback

**UR:** UR-008
**Status:** done
**Created:** 2026-07-10
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** checkpoint_log:passed commit:7e989e7
**Criteria approved:** agent-drafted
**Priority:** 1
**Size:** S
**Files:** src/main/art-protocol.ts, src/main/__tests__/art-protocol.test.ts, src/main/library/scanner.ts, src/shared/types.ts, src/renderer/src/lib/art.ts, src/renderer/src/components/MovieCard.vue, src/renderer/src/components/__tests__/MovieCard.test.ts, src/renderer/src/views/MovieDetailView.vue, src/renderer/src/views/__tests__/MovieDetailView.test.ts
**Depends on:** REQ-032

## Task

Make artwork serving avoid blocking on offline Google Drive source files by preferring cached artwork URLs where available and returning a fast missing-art response when neither source nor cache can be read.

## Context

`serveArtFile()` currently decodes an absolute path and synchronously reads it. Against cloud-backed artwork paths, that can trigger Drive hydration from the main process. The app should use app-owned cached artwork paths for rendered posters/fanart and treat unavailable source files as a fast fallback state.

## Acceptance Criteria

- [x] Renderer artwork URLs point at cached artwork paths for cached records rather than Google Drive source sidecar paths.
- [x] `serveArtFile()` returns a 404-style response for missing/unavailable artwork without throwing.
- [x] Existing `mw-art://` URL encoding and CSP behavior remain compatible with current poster and fanart rendering.

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/main/__tests__/art-protocol.test.ts`
   - Expected: protocol tests prove encoded path support, fast missing artwork response, and existing CSP behavior.
2. **test** `npx vitest run src/renderer/src/components/__tests__/MovieCard.test.ts src/renderer/src/views/__tests__/MovieDetailView.test.ts`
   - Expected: renderer artwork helpers continue producing usable `mw-art://` poster/fanart URLs.
3. **build** `npm run typecheck`
   - Expected: main and renderer artwork changes compile cleanly.

## Manual checks (advisory)

- [ ] Open the movie grid with source artwork evicted by Google Drive - Observable outcome: cached posters render where available, and unavailable artwork shows the existing fallback surface instead of freezing the app.

## Outputs

- src/main/art-protocol.ts - Returns 404 for missing or unreadable mw-art artwork instead of throwing.
- src/main/__tests__/art-protocol.test.ts - Adds unreadable artwork fallback coverage while preserving encoding and CSP tests.
- src/main/library/scanner.ts - Carries app-owned cached poster/fanart paths on ingested movie records.
- src/shared/types.ts - Adds optional cached poster and fanart fields to MovieRecord.
- src/renderer/src/lib/art.ts - Prefers cached artwork paths when building mw-art URLs.
- src/renderer/src/components/MovieCard.vue - Uses cached poster paths for grid artwork when available.
- src/renderer/src/components/__tests__/MovieCard.test.ts - Covers cached poster URL preference.
- src/renderer/src/views/MovieDetailView.vue - Uses cached fanart and poster paths for detail artwork when available.
- src/renderer/src/views/__tests__/MovieDetailView.test.ts - Covers cached fanart URL preference.
