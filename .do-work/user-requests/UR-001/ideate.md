# Ideate — UR-001

**Reviewed:** 2026-07-08

## Explorer — Assumptions & Perspectives

- The whole enrichment layer assumes the user supplies a personal TMDB v3 key. Without one, the scan still indexes files but every card stays `pending` indefinitely — so first-run UX has to make key entry unmissable, or the app looks broken on launch. (Triggered by design "No/invalid TMDB API key → banner" + first-run empty state.)
- Match quality is entirely a function of the filename parser. Scene-release names, foreign/anime titles, or files sitting in a flat folder rather than `Title (Year)/` will parse poorly and land as `unmatched`. The parser (plan Task 3) is the single biggest determinant of how good the library looks, yet it's scoped as one small task. (Triggered by scan flow step 3 + Task 3.)
- Non-obvious stakeholders: Kodi / Jellyfin / TinyMediaManager read and write the *same* NFO + artwork files. If Movie World's NFO schema drifts (missing tags, non-standard `<mpaa>` format, unexpected `<uniqueid>` shape), another tool sharing the library can be corrupted by us or corrupt us. NFO compatibility is an external contract, not just an internal format. (Triggered by design "directly readable by Kodi/Jellyfin/TinyMediaManager.")

## Challenger — Risks & Edge Cases

- **Concrete wiring gap:** Task 12 consumes an `mw-art://` custom protocol "(Task 10)" to render on-disk poster/fanart in the sandboxed renderer, but Task 10's interface list never actually specifies registering that protocol in main. With `contextIsolation: true` and no fs access, `file://` artwork won't load — posters would silently fail to render across the whole grid. This needs to be an explicit acceptance criterion on the main-wiring REQ. (Triggered by Task 12 "Consumes … `mw-art://` protocol (Task 10)" vs Task 10 interfaces.)
- Partial sidecar writes: the fetch queue writes an NFO plus downloads two JPGs per movie at concurrency 4. A quit mid-fetch, a read-only volume, or a truncated download leaves an inconsistent sidecar set (NFO present, poster missing/corrupt). Rescan/ingest must not mark such a movie cleanly `matched` with a broken poster. (Triggered by design NFO-write-failure handling + Task 7.)
- CSP / webPreferences is an unowned cross-cutting concern. The detail view embeds a YouTube trailer iframe and the grid loads a custom `mw-art://` protocol; the default electron-vite renderer CSP may block both. No single task owns this, so it can fall through the cracks and only surface at runtime. (Triggered by design "embedded YouTube trailer iframe" + process boundaries.)
- AU certification display is underspecified for the miss case. `release_dates` often has no AU entry; "all countries stored" covers persistence, but what the badge shows when AU is absent (nothing? fall back to another region?) isn't defined. (Triggered by age-rating decision + Task 5 details mapping.)
- `movieId = sha1(filePath)` means moving or renaming a file yields a new id. Watch state survives because it lives in the NFO on disk, but any transient UI reference to the old id breaks and the file re-appears as new after a reorg. Worth confirming the id is only a session/UI key and never persisted. (Triggered by Task 6 `movieId`.)

## Connector — Links & Reuse

- `fetchAndApply` is deliberately shared by the fetch queue (Task 7), fix-match, and retry. Ensure the fix-match raw-TMDB-ID escape hatch also routes through `applyDetails`, so the NFO it rewrites is byte-identical to the auto-match path — otherwise fixed matches persist a subtly different schema. (Triggered by Task 7 "also used by fix-match".)
- The manager's private `commit(movie)` invariant (Task 9) is the single choke point keeping disk ↔ memory ↔ renderer in sync. Every mutating path (scan, fetch, play, fixMatch, retry) must route through it; if any module emits directly, the UI drifts from what's on disk. Reuse this rather than scattering `emit` calls. (Triggered by Task 9 internal invariant.)
- Shared `src/shared/types.ts` is imported by main, preload, and renderer — it is the real cross-process contract. A change to `MovieRecord` or the IPC payloads ripples through every layer, so it should land first and change rarely. (Triggered by plan File Structure + "Every later task imports these types.")

## Summary

The plan and design are unusually complete and TDD-structured, so decomposition is low-risk. Before building, the three things worth holding in mind: (1) the `mw-art://` protocol is a genuine wiring hole between Task 10 and Task 12 that must be closed explicitly or posters won't render; (2) renderer CSP for the trailer iframe + custom art protocol is a cross-cutting concern no single task owns; (3) NFO schema fidelity is an external contract with other media managers, and partial-write resilience is the main persistence risk. None of these block decomposition — they become explicit acceptance criteria on the relevant REQs.
