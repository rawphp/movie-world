# REQ-020: Fix packaged-app trailer blank embed

**UR:** UR-003
**Status:** pending-validation
**Created:** 2026-07-09
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 1
**Size:** M
**Files:** src/renderer/src/views/MovieDetailView.vue, src/main/art-protocol.ts, src/main/index.ts, src/main/__tests__/art-protocol.test.ts
**Depends on:** REQ-019

## Task

Diagnose and fix the trailer embed showing a blank/black box on every movie's detail page in the **packaged build**. The `v-if="movie.trailerYoutubeKey"` branch renders (keys are populated), but the YouTube iframe displays nothing. Diagnose first — capture devtools console and network evidence from the packaged app to identify which candidate cause is real — then fix only the confirmed cause. Candidate causes, in likelihood order:

1. **`file://` renderer origin**: the packaged renderer loads from `file://`, so the YouTube embed receives no valid origin/referer and refuses to initialize (classic Electron embed failure; dev works because the origin is `http://localhost`). Typical fixes: `youtube-nocookie.com` embed host, an explicit `referrerpolicy`/origin strategy, or serving the renderer from a custom privileged scheme.
2. **CSP delivery in production**: `buildCsp(is.dev)` is injected via `session.defaultSession.webRequest.onHeadersReceived` (`src/main/index.ts:63-75`) — verify how this interacts with `file://` responses in the packaged app and that no residual/duplicate policy blocks `frame-src https://www.youtube.com` (same class of bug as REQ-018's conflicting meta CSP).

## Context

UR-003 verbatim brief: "movie detail trailer not working. Just a placeholder in the UI?" Clarified: the symptom is a blank/black rectangle (not the "No trailer found" text), observed in the packaged build, for **every** movie — which points at CSP/embed/origin rather than per-video YouTube restrictions or the data pipeline. The trailer data pipeline (TMDB matcher `src/main/tmdb/matcher.ts:51-53`, NFO round-trip) is working and out of scope. REQ-018 (archived) fixed the sibling bug — a conflicting meta CSP blocking `mw-art:` posters — and its debugging pattern (inspect the served CSP + devtools console) applies verbatim here. Depends on REQ-019 because a working dev mode is needed to run the app for runtime diagnosis and verification.

## Acceptance Criteria

- [x] Root cause is identified and documented in the worker's closure notes with concrete evidence (devtools console error, CSP violation report, or network log from the packaged app), before any fix is applied
- [x] In dev mode, navigating to a movie detail page with a `trailerYoutubeKey` loads the YouTube player inside the Trailer section iframe (player chrome visible, no blank/black box) with zero CSP violations in the devtools console
- [x] `npm run build` completes with zero errors
- [x] A unit test covers the fixed behavior (e.g. the CSP string in `buildCsp`, or the embed-URL builder if one is introduced) and fails if the fix is reverted
- [x] The `mw-art:` poster serving fixed in REQ-018 still works: existing `art-protocol` tests pass unchanged

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **runtime** Reproduce the original bug path: build the app (`npm run build`) and inspect the production CSP / embed configuration that ships in the bundle (e.g. run the packaged main process headlessly or assert on `buildCsp(false)` output and the rendered iframe `src`).
   - Expected: the pre-fix failure mode is demonstrated (evidence recorded), and post-fix the same inspection shows the corrected configuration. Handoff: main-process CSP → renderer iframe load.
2. **test** `npx vitest run`
   - Expected: all tests pass, including the new regression test for the fix and the existing REQ-018 art-protocol tests.
3. **build** `npm run build`
   - Expected: production build completes with zero errors.
4. **ui** Run `npm run dev`, navigate to a movie detail page whose movie has a non-null `trailerYoutubeKey`, and snapshot the Trailer section.
   - Expected: the iframe displays the YouTube player (thumbnail + play control visible), not a blank/black rectangle; devtools console shows zero CSP violations for `youtube.com`. Handoff: iframe request → YouTube player render.

## Post-merge validation

> Optional. Human, device, or environment checks that cannot run in a worker's isolated worktree.

- [ ] Action: package the app (`npm run build` + electron-builder) and open a movie detail page for a movie with a trailer — Observable outcome: the trailer plays inside the app (video and audio start when clicking play), for at least two different movies

## Outputs

- src/main/art-protocol.ts — Adds shouldApplyRendererCsp to scope renderer CSP injection away from remote subframes.
- src/main/index.ts — Uses shouldApplyRendererCsp before setting the Content-Security-Policy header.
- src/main/__tests__/art-protocol.test.ts — Covers packaged and dev CSP scoping so YouTube iframe responses are not rewritten.
