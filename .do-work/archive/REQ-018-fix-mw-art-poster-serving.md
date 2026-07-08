# REQ-018: Fix mw-art poster serving so library artwork renders

**UR:** UR-002
**Status:** done
**Created:** 2026-07-08
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** commit:HEAD tests:82-passed runtime:141x200-0csp-violations (dev, instrumented `npm run dev`)
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/renderer/index.html, src/main/art-protocol.ts, src/main/index.ts, src/main/**tests**/art-protocol.test.ts
**Depends on:**

## Task

Matched movies have valid poster/fanart files on disk and a populated `posterPath`, but their `<img src="mw-art://…">` rendered as a broken-image icon in the library grid (and detail view). Fix it so the on-disk bytes actually reach the sandboxed renderer, and add regression coverage.

## Root cause (found by reproduction, not hypothesis)

The **actual** cause was a **conflicting Content-Security-Policy**, not the serving code.

`src/renderer/index.html` shipped the electron-vite boilerplate meta tag:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
/>
```

Browsers enforce the **intersection** of every CSP source. This static meta policy (`img-src 'self' data:`, no `mw-art:`) intersected with — and, being stricter, overrode — the correct header policy from `buildCsp()` (which _does_ allow `mw-art:`). Every poster was blocked **in the renderer, before the request ever reached the main process**.

Proven by instrumenting a real `npm run dev` run:

- Before: renderer logged `Loading the image 'mw-art://…' violates … "img-src 'self' data:". The action has been blocked.` for all 141 posters; the `protocol.handle` callback fired **0 times**.
- After removing the meta tag: **141/141** handler invocations returned **200**, **0** CSP violations, **0** 404s.

This is why the initial serving-layer hypothesis (recorded in the earlier version of this REQ) was wrong: the request was never reaching `serveArtFile`/`net.fetch` at all.

## Fix

1. **Primary (the actual fix):** removed the conflicting `<meta http-equiv="Content-Security-Policy">` from `src/renderer/index.html`, leaving `buildCsp()` (applied at runtime via `session.onHeadersReceived` in `index.ts`) as the single source of truth. A comment documents why the meta must not be reintroduced. This also un-blocks the YouTube trailer frame, which the meta likewise omitted.
2. **Robustness (kept from the prior worker attempt):** the byte-serving was extracted from the inline `protocol.handle` closure into `serveArtFile()` in `art-protocol.ts`, reading bytes directly via `fs` with a correct image `Content-Type` instead of `net.fetch(pathToFileURL(...))`. Not required for this bug, but removes a latent `file://`-over-`net.fetch` risk and closes the serving-layer test-coverage gap.

## Acceptance Criteria

- [x] The conflicting meta CSP is removed from `index.html`; `buildCsp()` is the sole CSP authority. mw-art: image requests are no longer blocked by CSP.
- [x] Byte-serving is extracted into `serveArtFile()` in `art-protocol.ts` with no compile-time Electron `net`/`protocol` dependency, reading bytes directly and setting a correct image `Content-Type`.
- [x] A missing/undecodable path returns `404`; an existing file returns `200` with the exact bytes (unit-tested).
- [x] In the running dev app, matched-movie posters serve successfully (141× 200, 0 CSP violations) instead of being blocked.
- [x] Unmatched (`NEEDS MATCH`) cards still show the centered title fallback — the `posterPath === null` path is untouched.
- [x] A regression test asserts `index.html` carries no meta CSP that omits `mw-art:` from `img-src`.

## Verification Steps

1. **test** `npx vitest run` — Expected: full suite green. **Result: 82 passed (17 files)**, including new `serveArtFile` and index.html-CSP regression tests.
2. **build** `npm run build` — Expected: typecheck (node + web) + electron-vite build clean. **Result: passed, 0 type errors.**
3. **runtime** Instrumented `npm run dev`, count `mw-art` handler statuses and CSP violations — Expected: 200s, no violations. **Result: 141× 200, 0 violations, 0 404s.**

## Post-merge validation

- [x] Dev app (`npm run dev`): posters serve (verified via main-process instrumentation — 141× 200, 0 CSP violations). Pixel-level confirmation is visible in the user's open window.
- [ ] Packaged build (`npm run build:mac` / preview): confirm posters render there too, and confirm `session.onHeadersReceived` applies `buildCsp` over the `file://` origin so production retains a CSP (if it does not, production runs with no CSP after the meta removal — acceptable for a local app, but worth confirming). — Observable outcome: posters visible in the packaged app; a CSP header present on the document response.
