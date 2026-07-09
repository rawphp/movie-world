# REQ-034: Offline Artwork Fallback

<!-- claimed-start -->
**Claimed by:** Toms-MacBook-Pro.local.20260709204505
**Claimed at:** 2026-07-09T21:04:19Z
**Heartbeat:** 2026-07-09T21:04:19Z
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
**Priority:** 1
**Size:** S
**Files:** src/main/art-protocol.ts, src/main/__tests__/art-protocol.test.ts, src/renderer/src/lib/art.ts
**Depends on:** REQ-032

## Task

Make artwork serving avoid blocking on offline Google Drive source files by preferring cached artwork URLs where available and returning a fast missing-art response when neither source nor cache can be read.

## Context

`serveArtFile()` currently decodes an absolute path and synchronously reads it. Against cloud-backed artwork paths, that can trigger Drive hydration from the main process. The app should use app-owned cached artwork paths for rendered posters/fanart and treat unavailable source files as a fast fallback state.

## Acceptance Criteria

- [ ] Renderer artwork URLs point at cached artwork paths for cached records rather than Google Drive source sidecar paths.
- [ ] `serveArtFile()` returns a 404-style response for missing/unavailable artwork without throwing.
- [ ] Existing `mw-art://` URL encoding and CSP behavior remain compatible with current poster and fanart rendering.

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
