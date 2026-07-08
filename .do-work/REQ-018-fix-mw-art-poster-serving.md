# REQ-018: Fix mw-art poster serving so library artwork renders

**UR:** UR-002
**Status:** backlog
**Created:** 2026-07-08
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/main/index.ts, src/main/art-protocol.ts, src/main/__tests__/art-protocol.test.ts
**Depends on:**

## Task

Matched movies have valid poster/fanart files on disk and a populated `posterPath`, but their `<img src="mw-art://…">` renders as a broken-image icon in the library grid (and detail view). Fix the `mw-art://` serving path in the main process so the on-disk bytes actually reach the sandboxed renderer, and add regression coverage for the handler so this can't silently break again.

The fault is isolated to the **artwork-serving stack** — everything upstream is proven working (see Context). Do not touch the scanner, matcher, fetcher, NFO, or renderer data flow; the bug is in how `src/main/index.ts` registers and serves the `mw-art` scheme.

**Required refactor (also the fix):** extract the byte-serving out of the inline `protocol.handle` closure in `index.ts` into a testable function in `src/main/art-protocol.ts` — e.g.

```ts
// art-protocol.ts — no Electron `net`/`protocol` dependency, so vitest can call it
export function serveArtFile(url: string): Response {
  const filePath = decodeArtUrl(url)
  if (!filePath || !existsSync(filePath)) return new Response(null, { status: 404 })
  const body = readFileSync(filePath)
  return new Response(body, { status: 200, headers: { 'Content-Type': contentTypeFor(filePath) } })
}
```

`index.ts`'s `protocol.handle(MW_ART_SCHEME, (req) => serveArtFile(req.url))` then becomes a thin wrapper. Serving the bytes directly with `fs.readFile` + a Web `Response` (instead of `net.fetch(pathToFileURL(...))`) is the leading fix — it removes the `file://`-over-`net.fetch` failure mode entirely. `contentTypeFor` maps `.jpg`/`.jpeg` → `image/jpeg`, `.png` → `image/png`, `.webp` → `image/webp`, default `application/octet-stream`.

If reproduction (see Verification/Post-merge) shows the request never reaches the handler at all (a scheme-level `net::ERR_*` before any handler log), the secondary cause is the scheme registration — reconsider the `registerSchemesAsPrivileged` privileges (`standard: false` with no `secure: true`). If you change `standard` to `true`, you MUST also change the URL construction in `src/renderer/src/lib/art.ts` and the decode in `art-protocol.ts` together (a standard scheme parses the encoded path as a host and breaks the current whole-path-encoding contract) — keep the three in sync and keep the round-trip test green.

## Context

Original brief: "artwork is not loading into the library items". Grill + filesystem evidence (UR-002 `input.md` clarifications) localized it precisely:

- **Matched cards** (`M` badge) render an `<img>` that fails → broken-image icon. **Unmatched cards** (`NEEDS MATCH`) correctly show the centered title fallback. So `posterPath` IS set — this is a serving bug, not a data/matching bug.
- Poster files exist and are valid: library at `…/GoogleDrive-…/My Drive/8 Photos & Videos/Movies`, 141 `-poster.jpg` + 141 `.nfo`, sample `A Man Called Otto (2022)-poster.jpg` = valid 88 KB / 500×750 progressive JPEG, zero placeholder files.
- Proven-working upstream: `decodeArtUrl` round-trips (tested), `buildCsp` allows `img-src … mw-art:` (tested), `fetcher.ts` downloads before setting `posterPath`, `scanner.ts` only sets `posterPath` when the file `existsSync`.
- The gap: the serving glue in `src/main/index.ts` (scheme privileges `{ standard:false, stream:true, supportFetchAPI:true }`, `protocol.handle` → `net.fetch(pathToFileURL(...))`, and the `onHeadersReceived` CSP injection) has **zero test coverage** — only the two pure helpers are tested. Leading hypothesis: `net.fetch()` fails to serve `file://` URLs in Electron 39; extracting `serveArtFile` to read bytes directly both fixes that and closes the coverage gap.

Environment: macOS, Electron ^39.2.6. This is `bug-fix` class — no Integration block.

## Acceptance Criteria

- [ ] Byte-serving logic is extracted from the `protocol.handle` closure in `index.ts` into a `serveArtFile`-style function in `art-protocol.ts` that has no compile-time dependency on Electron's `net`/`protocol` and returns a Web `Response`.
- [ ] Serving reads the file bytes directly (`fs.readFile`/`readFileSync`) rather than routing through `net.fetch(pathToFileURL(...))`, and sets a correct image `Content-Type` (`image/jpeg` for `.jpg`/`.jpeg`).
- [ ] A missing/undecodable path returns a `404` Response; an existing file returns a `200` Response whose body equals the file's bytes.
- [ ] In the running app, matched-movie cards in the library grid show their real poster images instead of a broken-image icon, and the detail view shows poster + backdrop.
- [ ] Unmatched (`NEEDS MATCH`) cards still show the centered title fallback — no regression to the `posterPath === null` path.

## Verification Steps

> Execute after implementation. Each must pass before committing. Runtime GUI verification that a worker cannot perform in an isolated worktree lives in Post-merge validation.

1. **test** Add and run a test in `src/main/__tests__/art-protocol.test.ts` that writes a real temp JPEG to disk, calls `serveArtFile(\`${MW_ART_SCHEME}://${encodeURIComponent(tmpPath)}\`)`, and asserts: status `200`, `Content-Type: image/jpeg`, and the returned body bytes equal the file bytes. Add a second case: a `mw-art://` URL for a non-existent path returns status `404`. Command: `npx vitest run src/main/__tests__/art-protocol.test.ts`
   - Expected: both cases pass. (Before the fix, serving depended on `net.fetch(file://)` and was untested — this test reproduces the serving path in isolation and is the regression guard for the handoff `decoded-path → bytes → Response`.)
2. **test** `npx vitest run`
   - Expected: full suite green, no regressions in existing `decodeArtUrl`/`buildCsp` or any other tests.
3. **build** `npm run build`
   - Expected: `typecheck` (node + web) and `electron-vite build` complete with zero type errors and zero warnings.

## Post-merge validation

> The Electron GUI cannot be launched or observed inside a worker's isolated worktree, so the authoritative visual confirmation is a human check after merge. This is the reproduction-and-confirm step for a runtime rendering bug.

- [ ] Launch the app against the real library (`npm run dev`, or the packaged build) — Observable outcome: in the Library grid, matched cards (`M` badge, e.g. "A Man Called Otto", "40 Years of Rocky") display their poster images; no broken-image icons remain.
- [ ] Open a matched movie's detail view — Observable outcome: the poster and backdrop/fanart images render.
- [ ] Confirm an unmatched (`NEEDS MATCH`) card still shows the centered title text — Observable outcome: the `posterPath === null` fallback is unchanged (no regression).
- [ ] If posters are still broken after the primary fix: open DevTools console, record the exact `mw-art://` request error (e.g. `404`, `net::ERR_UNKNOWN_URL_SCHEME`, or a CSP violation), and reject the REQ with that error so the next worker has the precise failure — Observable outcome: a concrete console error string is captured.
