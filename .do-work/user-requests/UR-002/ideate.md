# Ideate — UR-002

**Reviewed:** 2026-07-08

## Explorer — Assumptions & Perspectives

- The brief says "not loading" but doesn't say what the user *sees*. There are two visually distinct failure modes: (1) the card shows the fallback **title text** (`MovieCard.vue:43-48`, `v-else` when `poster` is falsy) → `posterPath` is null/empty in the record; (2) the card shows a **broken-image icon** → `posterPath` is set and the `mw-art://` URL is built, but the main-process protocol handler or CSP refuses to serve/render it. These point at completely different code, so which one it is decides the whole fix.
- Assumes movies have actually been *matched*. `posterPath` is only ever set after a successful TMDB match+download (`fetcher.ts:44-46`) or a rescan that finds an existing `*-poster.jpg` sidecar (`scanner.ts:78`). An unmatched/pending/fetch-failed library legitimately shows no artwork — that would be a matching problem, not an artwork-loading problem. Need to confirm the `*-poster.jpg` files exist on disk next to the movies.
- "Library items" scopes this to `MovieCard.vue` in `LibraryView`. `MovieDetailView.vue` uses the same `artSrc`/`mw-art:` path, so if it's a serving bug the detail view is broken too; if only the cards are blank, the fault is narrower. Worth checking both to localize.

## Challenger — Risks & Edge Cases

- **The serving stack has zero integration coverage.** Only `decodeArtUrl` and `buildCsp` are unit-tested as pure functions (`art-protocol.test.ts`). The parts that actually make an image appear — `protocol.registerSchemesAsPrivileged`, `protocol.handle` + `net.fetch(pathToFileURL(...))`, and the `onHeadersReceived` CSP injection — all live in `src/main/index.ts`, which has **no test at all**. A green suite here proves nothing about whether posters render. This is precisely the class of bug unit tests miss and the reason the global directive says to *visually verify UI*.
- **Scheme privileges are a prime suspect.** `mw-art` is registered `{ standard: false, stream: true, supportFetchAPI: true }` (`index.ts:14-19`) with no `secure: true`. A non-standard, non-secure custom scheme is a well-known source of "custom-protocol `<img>` won't render" in Electron; `net.fetch` on a `file://` URL can also fail silently and return a non-ok Response that surfaces as a broken image. The URL scheme is *internally consistent* (encode-whole-path in `art.ts` ↔ decode in `art-protocol.ts`), so a fix that flips to `standard: true` would also have to change the URL construction on both sides — a coupled change, not a one-liner.
- **CSP is injected on `defaultSession` for every response** (`index.ts:73-80`), unconditionally replacing `Content-Security-Policy`. If the real cause is CSP, the failure would also silently kill the YouTube trailer iframe — a second observable symptom worth checking to confirm/deny the CSP hypothesis.
- This cannot be reproduced or verified by `vitest` alone — it needs the packaged/dev app actually running (`npm run dev` or a headless Electron/Playwright driver). Any fix that claims "done" on a passing unit suite without the app showing a poster is unverified.

## Connector — Links & Reuse

- Root cause almost certainly sits at the **REQ-011 seam** (`6ed6ce1 feat(REQ-011): ipc handlers, main wiring, art protocol & csp`) — the composition root that wires protocol + CSP + manager together. Every upstream piece (REQ-006 matcher, REQ-008 fetch queue, REQ-013/014 renderer) has its own unit tests and looks correct in isolation; the failure is in how they're glued in `index.ts`.
- The fix should add the missing **integration/e2e guard** (drive the real app, assert a poster `<img>` actually loads a non-broken image) so this can't regress and so "done" is provably done — there's currently no Playwright/Electron e2e harness in the repo.
- Reuse existing helpers as-is where possible: if the fix is scheme privileges, keep `decodeArtUrl`/`artSrc` symmetric; if it's data, the fix is upstream in matcher/scanner, not in the artwork layer at all.

## Summary

The data path (parse → match → download → `posterPath`) is internally sound and unit-tested; the fault is almost certainly in the **untested composition-root wiring** in `src/main/index.ts` — most likely the `mw-art` scheme privileges (`standard:false`, no `secure:true`) or `net.fetch(file://)` serving, with CSP a secondary suspect. Before writing any fix this must be **reproduced in the running app** (systematic-debugging: is the card showing title-text or a broken-image icon? do `*-poster.jpg` sidecars exist?), because those two observations bisect the problem into "matching/data" vs "serving" and pick entirely different fixes. The fix must be **visually verified in the real Electron app**, not on a green unit suite, and should leave behind an integration test that actually renders a poster.
