---
ur: UR-002
received: 2026-07-08
status: intake
---

# UR-002: User Request

## Request

artwork is not loading into the library items

## Clarifications

**Q:** On a movie card, what appears where the poster should be — the centered title fallback (posterPath null) or a broken-image icon (posterPath set but the image fails to load)?
**A:** Screenshot supplied. Matched cards (`M` badge) render an `<img>` that fails — a broken-image icon appears top-left next to the title. Unmatched cards (`NEEDS MATCH`) correctly show the centered title fallback. This is a **serving-layer bug**, not a data/matching bug: `posterPath` is populated for matched movies but the `mw-art://` image never loads.

**Q:** Do the `*-poster.jpg` sidecar files actually exist on disk for matched movies, or did the TMDB download silently fail?
**A:** They exist and are valid. Library folder is `/Users/tomkaczocha/Library/CloudStorage/GoogleDrive-tomkaczocha@gmail.com/My Drive/8 Photos & Videos/Movies` (settings.json). 141 `-poster.jpg` + 141 `.nfo` files present; sample `A Man Called Otto (2022)-poster.jpg` is a valid 88 KB / 500×750 progressive JPEG; zero sub-1 KB placeholder files. So the download pipeline works — the fault is purely in serving those bytes to the renderer. *(inferred from filesystem, confirmed)*

**Q:** What is the environment (so the fix can be reproduced and verified)?
**A:** macOS, Electron ^39.2.6, running the Electron app (dev vs. packaged `preview` build to be confirmed by the worker during reproduction — CSP/secure-context behaviour of a custom scheme can differ between the `http://localhost` dev origin and the `file://` production origin). Library sits on a Google Drive CloudStorage mount, but the poster files themselves are fully materialised local files. *(partially inferred)*

**Note:** The entire `mw-art` serving stack (scheme privileges `{ standard:false, stream:true, supportFetchAPI:true }`, `protocol.handle` → `net.fetch(pathToFileURL(...))`, and the `onHeadersReceived` CSP injection) lives in `src/main/index.ts`, which has **no test coverage** — only the pure helpers `decodeArtUrl`/`buildCsp` are tested. Fix must be reproduced and **visually verified in the running app** (a poster must actually render), not signed off on a green `vitest` suite. Leading hypotheses for the worker to confirm via the DevTools console error: (a) the `standard:false` scheme isn't renderable as an `<img>` subresource in Electron 39, and/or (b) `net.fetch()` fails to serve `file://` URLs — a direct `fs.readFile` → `Response` with a proper `Content-Type` sidesteps that entirely.
