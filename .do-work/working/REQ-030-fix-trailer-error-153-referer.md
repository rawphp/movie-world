# REQ-030: Fix YouTube trailer Error 153 via referer/origin injection

<!-- claimed-start -->
**Claimed by:** Toms-MacBook-Pro.local.14601
**Claimed at:** 2026-07-09T12:24:16Z
**Heartbeat:** 2026-07-09T12:24:16Z
<!-- claimed-end -->

**UR:** UR-007
**Status:** in-progress
**Created:** 2026-07-09
**Layer:** none
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/main/index.ts, src/main/art-protocol.ts, src/main/__tests__/art-protocol.test.ts
**Depends on:**

## Task

Fix the YouTube trailer embed showing **"Error 153 — Video player configuration error"** on every movie detail page in the **packaged build**. The iframe now loads (this is YouTube's own branded error page, not a blank box or a CSP block), but YouTube's embedded player refuses to initialise because the packaged renderer serves from a `file://` origin, so the embed request carries no HTTP `Referer`/`Origin` that YouTube's player will accept.

**Diagnose first, then fix the confirmed cause.** Capture evidence (packaged-app devtools console / network request to `www.youtube.com/embed/...` and its request headers) confirming the missing/invalid referer is the cause of 153 before applying the fix. Then implement a **host-scoped** header injection in the main-process session:

1. Add a testable helper to `src/main/art-protocol.ts` (mirroring the existing `shouldApplyRendererCsp` style) — e.g. `shouldSetYoutubeReferer(requestUrl: string): boolean` — that returns `true` only for YouTube embed hosts (`www.youtube.com`, and `www.youtube-nocookie.com` if used) and `false` for everything else (`mw-art:`, `file:`, `http://localhost`, `https://api.themoviedb.org`, `*.googlevideo.com` is acceptable to leave untouched as it is a subframe resource — confirm during diagnosis). Export a referer constant (e.g. `YOUTUBE_EMBED_REFERER = 'https://www.youtube.com/'`).
2. Register a `session.defaultSession.webRequest.onBeforeSendHeaders` handler in `src/main/index.ts` (beside the existing `onHeadersReceived` CSP block) that, for matched requests only, sets `Referer` (and a matching `Origin: https://www.youtube.com`) so YouTube's player accepts the embed configuration. Requests that do not match are passed through with headers unchanged.

Do NOT broaden the fix to inject a referer onto non-YouTube requests, and do NOT change the iframe `src` host or the CSP directives unless diagnosis proves it necessary (the frame already loads, so CSP is not the blocker).

## Context

UR-007 verbatim brief: "movie detail pages show preview error 'error 153'" (screenshot: `user-requests/UR-007/assets/error-153-screenshot.png`). Clarified with the user: (1) inline in-app playback is required — an "open in external browser" fallback is NOT acceptable; (2) the bug reproduces in the **packaged / `file://` build**, so the fix must handle the `file://` origin and closure requires a packaged-build visual check.

**Direct relationship to REQ-020 (`.do-work/pending/`, UR-003, pending-validation).** REQ-020 fixed the *earlier* symptom — a blank/black trailer box in the packaged build — by adding `shouldApplyRendererCsp` to scope the renderer CSP away from YouTube subframes. REQ-020's own task listed two candidate causes; it fixed candidate #2 (CSP delivery) but left candidate #1 (the `file://` origin / missing referer) unaddressed. This REQ addresses candidate #1. The blank box becoming a rendered "Error 153" page is evidence REQ-020's CSP fix worked and merely uncovered the next layer. REQ-020's merged code (`shouldApplyRendererCsp`, `buildCsp`) is already in the base tree; reuse the same host-matching pattern and same wiring site (`src/main/index.ts:73-85`). The trailer data pipeline (TMDB matcher `src/main/tmdb/matcher.ts:76`) is working and out of scope — the frame reaches the correct video, YouTube just rejects the config.

> ⚠️ The `Referer`/`Origin` injection is a security-relevant change. It MUST be host-scoped to YouTube embed hosts. Injecting a spoofed referer onto TMDB (`api.themoviedb.org`), `mw-art:`, or any other host would leak the app's identity and is a regression — the unit test must assert non-YouTube requests are left untouched.

## Acceptance Criteria

- [ ] Root cause is confirmed and recorded in the worker's closure notes with concrete evidence (packaged-app devtools console error and/or the outbound `www.youtube.com/embed/...` request headers showing the missing/invalid referer) before any fix is applied
- [ ] `shouldSetYoutubeReferer('https://www.youtube.com/embed/abc')` returns `true`; the same helper returns `false` for `mw-art://x`, `file:///…/index.html`, `http://localhost:5173/`, and `https://api.themoviedb.org/3/movie/1` (asserted by unit test)
- [ ] The main process registers an `onBeforeSendHeaders` handler that sets `Referer: https://www.youtube.com/` (and `Origin: https://www.youtube.com`) only on requests matched by the helper, and leaves headers unchanged for all other requests
- [ ] No spoofed `Referer`/`Origin` is added to non-YouTube requests (TMDB, `mw-art:`, localhost, file) — asserted by a unit test that fails if the host scoping is removed
- [ ] `npx vitest run` passes, including the new regression test and the existing REQ-018/REQ-020 `art-protocol` CSP-scoping tests unchanged
- [ ] `npm run build` completes with zero errors

## Verification Steps

> Execute these after implementation to confirm the fix works at runtime. Each must pass before committing.

1. **test** Reproduce-and-fix mechanism: run the new unit test for `shouldSetYoutubeReferer` and the header-injection logic (`npx vitest run src/main/__tests__/art-protocol.test.ts`). The test must fail against the pre-fix code (no referer injected for YouTube) and pass after the fix. Handoff: helper match → header set.
   - Expected: helper matches only YouTube embed hosts; the referer/origin is injected for a YouTube request and NOT for TMDB / `mw-art:` / `file:` / localhost requests.
2. **test** `npx vitest run`
   - Expected: all tests pass, including the new regression test and the existing `art-protocol` CSP-scoping tests (REQ-018/REQ-020) unchanged.
3. **build** `npm run build`
   - Expected: production build completes with zero errors.

## Post-merge validation

> Human/device checks that cannot run in a worker's isolated worktree. Consumed after merge by `/do-work approve`.

- [ ] Action: package the app (`npm run build` + electron-builder) and open a movie detail page for a movie with a `trailerYoutubeKey` (e.g. "Leo") — Observable outcome: the Trailer section shows the working YouTube player (play control / thumbnail visible) with **no "Error 153"**, and the trailer plays (video + audio start on click), confirmed for at least two different movies.
