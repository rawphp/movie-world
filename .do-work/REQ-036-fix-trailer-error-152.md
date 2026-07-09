# REQ-036: Fix trailer unavailable Error 152-4

**UR:** UR-009
**Status:** backlog
**Created:** 2026-07-10
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/main/art-protocol.ts, src/main/index.ts, src/main/__tests__/art-protocol.test.ts, src/renderer/src/views/MovieDetailView.vue, src/renderer/src/views/__tests__/MovieDetailView.test.ts
**Depends on:**

## Task

Diagnose and fix the movie detail trailer embed showing YouTube's **"This video is unavailable / Error code: 152 - 4"** for video key `0CYVGN98ZLA`.

Start by proving whether `152 - 4` is an app-wide embed configuration failure or a video-specific/unembeddable trailer failure. Preserve the prior `REQ-030` fix for packaged `Error 153`: valid YouTube embeds must still load inline with the existing host-scoped `Referer`/`Origin` injection. If diagnosis shows YouTube is rejecting this specific embed even with valid app headers, add a first-class detail-page fallback outside the iframe so the user can open the trailer on YouTube instead of being trapped in the failed player.

## Context

UR-009 brief reports the detail page trailer player showing:

> This video is unavailable
> Error code: 152 - 4

The supplied player URL points at `https://www.youtube.com/watch?v=0CYVGN98ZLA&embeds_referring_euri=https%3A%2F%2Fwww.youtube.com%2F&source_ve_path=MTc4NDI0`.

Relevant prior work: `REQ-030` already fixed packaged `Error 153` by adding YouTube-only `Referer`/`Origin` header injection in `src/main/art-protocol.ts` and wiring it through `session.defaultSession.webRequest.onBeforeSendHeaders` in `src/main/index.ts`. Do not broaden those headers to non-YouTube hosts. `MovieDetailView.vue` currently renders a raw `https://www.youtube.com/embed/${movie.trailerYoutubeKey}` iframe whenever `movie.trailerYoutubeKey` exists, with no app-owned fallback for an embed that YouTube refuses.

## Acceptance Criteria

- [ ] Diagnosis evidence records whether `0CYVGN98ZLA` fails because of app embed configuration or because YouTube rejects that specific video/embed, including the observed build mode and at least one comparison against a known-good trailer key.
- [ ] The existing `REQ-030` header behavior remains host-scoped: YouTube embed requests receive `Referer: https://www.youtube.com/` and `Origin: https://www.youtube.com`, while TMDB, `mw-art:`, `file:`, localhost, and non-YouTube requests remain unchanged.
- [ ] The movie detail page still renders valid trailer keys as inline YouTube embeds using the existing `detail-trailer-frame` path.
- [ ] When a trailer key is present, the detail page exposes an app-owned "Watch on YouTube" fallback link outside the iframe that opens `https://www.youtube.com/watch?v=<key>`.
- [ ] The fallback link does not replace inline playback for valid trailers; it only gives users a recovery path when YouTube refuses the embed.
- [ ] Regression tests cover both the preserved header scoping and the detail-page YouTube fallback link.

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/main/__tests__/art-protocol.test.ts`
   - Expected: YouTube referer/origin tests still pass, including positive coverage for YouTube embed hosts and negative coverage for TMDB, `mw-art:`, `file:`, localhost, and non-YouTube hosts. Handoff: request URL classification -> outbound headers.
2. **ui** `npx vitest run src/renderer/src/views/__tests__/MovieDetailView.test.ts`
   - Expected: the detail view still renders the inline trailer iframe for a movie with `trailerYoutubeKey`, and also renders an external YouTube fallback link whose `href` is `https://www.youtube.com/watch?v=0CYVGN98ZLA` for that key. Handoff: movie record trailer key -> iframe plus fallback link.
3. **test** `npx vitest run`
   - Expected: all unit/component tests pass with the trailer regression coverage included.
4. **build** `npm run build`
   - Expected: production build completes with zero errors.

## Manual checks (advisory)

- [ ] Action: launch the app in the build mode where `152 - 4` was observed and open a movie whose trailer key is `0CYVGN98ZLA` — Observable outcome: the Trailer section gives a clear app-owned "Watch on YouTube" recovery link outside the iframe, and clicking it opens the corresponding YouTube watch page in the external browser.
- [ ] Action: open a movie with a known-good embeddable trailer key — Observable outcome: the inline trailer player still loads and can play in the detail page, with no regression to the prior `Error 153` path.
