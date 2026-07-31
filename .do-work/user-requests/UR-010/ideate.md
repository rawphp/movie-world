# Ideate — UR-010

**Reviewed:** 2026-07-31

## Explorer — Assumptions & Perspectives

- The brief assumes the UR-008 fix (REQ-031–035: local library cache, cached sidecars, cached-first `loadLibrary`, prefer cached art) either regressed or never fully covered the launch-critical path; a concrete scenario is every launch with a Google Drive movie folder still freezes the window even though `loadLibrary()` was changed to return cache first.
- "Freeze" is undefined as main-process event-loop stall vs renderer white-screen vs slow first paint; that matters because Electron freezes the UI when the main process does synchronous FS on cloud-backed paths, even after the IPC reply returns.
- Empty-cache / first-launch is foggy: if `library-records.json` is missing or lacks `cachedPosterPath` fields, the design falls back to scanning and reading Drive paths again, so a "fixed" install can still freeze on a clean userData or after cache eviction.
- Stakeholders include the packaged app user (you), Google Drive File Stream / Drive for Desktop hydration policy, and the main-process art protocol (`serveArtFile`), not only the library manager.

## Challenger — Risks & Edge Cases

- Cached-first is incomplete against Drive: `loadLibrary()` schedules `scanOne` → `discoverVideoFiles` (`readdir` walk) and `ingestFile` (`stat`, `existsSync` on sidecars, `copyFileSync` for mirror) on the main process; concurrent Drive hydration can still stall the event loop and make the app feel frozen *after* the library view mounts.
- Artwork path preference is half-done: `artSrc` prefers `cachedPosterPath`, but `resolveArtworkPath` still probes Drive with `existsSync(sourcePath)` first and stores `posterPath` as the Drive path; any record without a populated cache field (or grid that falls back) hits `serveArtFile` → sync `existsSync` + `readFileSync` on Drive and freezes on first paint of many cards.
- `existsSync(folder)` in `loadLibrary` for `unavailableFolders` can itself block on a partially mounted / spinning Drive path before the IPC result returns — a launch hang that never reaches "background scan."
- Regression risk is high because REQ-033/034 manual checks (launch with offline Drive) were advisory-only; unit tests mock FS and cannot reproduce Drive placeholder/hydration stalls, so a silent regression would look green in CI.
- Contradictory user framing ("should have been fixed" vs "investigate root cause") means capture must lead with diagnosis REQs, not only re-apply the old cache design without proving which stage blocks today.

## Connector — Links & Reuse

- Direct overlap with **UR-008** and archived **REQ-031–035** (`cache.ts`, `manager.loadLibrary` cached-first, `scanner` sidecar mirror, `art.ts` / MovieCard prefer cache, REQ-035 status UX). Reuse those modules; do not invent a second cache.
- Related earlier hang: **REQ-019** (dev window lifecycle) — different root cause (window ready-to-show), but useful so diagnosis does not re-chase window-lifecycle if the freeze is post-show FS.
- Pattern already present: background scans + `scan:progress` / `movie:updated` IPC — the gap is making Drive-touching work non-blocking (async FS, timeouts, never sync-read Drive on art/protocol paths) rather than inventing new UI.
- Standing decision (2026-07-10 | UR-008): free solution via app-owned local cache + cached-first background rescan — still the right constraint; this UR should prove why that path still stalls and harden it.

## Summary

UR-008 already shipped the intended fix; the freeze returning strongly suggests either residual main-process sync I/O against Google Drive (background scan, `existsSync` on folders/sidecars, or `mw-art` reads of non-cached poster paths) or an empty/incomplete cache so cached-first never engages. Decompose as investigate → measure which stage blocks → harden the hot path (never block launch or first paint on Drive) rather than redoing the whole cache feature from scratch.
