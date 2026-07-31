# Ideate — UR-011

**Reviewed:** 2026-07-31

## Explorer — Assumptions & Perspectives

- The brief assumes “display art = cachedPosterPath only” can coexist with existing `posterPath`/`fanartPath` source fields on `MovieRecord`; if capture renames fields or drops dual storage without a migration plan, every IPC consumer (grid, detail, cache JSON, tests) breaks mid-rollout when a record still has Drive `posterPath` and null cache.
- Stakeholders include the packaged app user, Google Drive File Stream (cloud-only sidecars), Kodi/NFO source folders that still want optional sidecar writes, and the `mw-art` protocol handler — not only Vue `artSrc`. A writer that only mirrors to cache but fails Drive write must still leave paintable cache art.
- “Rename to posterCachePath” vs keep `cachedPosterPath` is foggy: rename is a large shared-type churn; keeping the name and changing the *contract* (renderer ignores source paths) may deliver the same outcome with less risk.
- Backfill “limited concurrency” is undefined (pool size, whether it may touch Drive source to mirror, and whether it runs before or after discover). Without that, implementers will either re-block the main process or never recover incomplete cache.

## Challenger — Risks & Edge Cases

- Point 2 (always materialize under cache) + optional Drive sidecars conflicts with cold Drive: if source copy is best-effort and TMDB download only hits Drive today, a failed Drive write with a successful cache write is fine — but a failed cache write must not set display fields, or grid paints 404 forever after protocol lock-down.
- Point 5 (re-touch missing cache art) + Point 3 (serve only cache) creates a window where startup shows placeholders until backfill finishes; if backfill still uses sync `existsSync`/`copyFileSync` on Drive, the original freeze returns under a different name.
- Point 6 (`preferCache = !markMissing` → explicit mode) can regress rescan if “startup” and “rescan” modes are incomplete: rescan must still reconcile source NFO/art; startup must not mark missing; a third mode for “backfill art only” may be needed rather than overloading two modes.
- Dual-mode removal in `serveArtFile` (require `userDataPath`) will break unit tests that call `serveArtFile(url)` with no options unless every call site is updated; also breaks any accidental production path that forgot to pass userData.
- Renaming fields while also changing writers and protocol in one UR risks a big-bang footprint collision across shared/main/renderer; sequential REQs with a stable field name reduce merge pain.

## Connector — Links & Reuse

- Direct follow-on to **UR-010** (REQ-037–040) and **UR-008** (REQ-031–035): reuse `cachedSidecarPathsFor`, `completeCachedArtworkPaths`, `isAppOwnedCachePath`, manager `scanOne` / `scheduleStartupScan` — do not invent a second cache tree.
- Standing decision (2026-07-10 | UR-008): free app-owned local cache + cached-first background rescan — this UR hardens that decision into a single display contract rather than stacking prefer-cache layers.
- Standing decision (2026-07-31 | UR-010): diagnosis + art/scan/hydrate split — this UR should treat incomplete dual-path art as the root structural debt, not re-instrument freezes first.
- TMDB `fetchAndApply` (`src/main/tmdb/fetcher.ts`) still writes only `sidecarPathsFor` (Drive); that is the primary writer gap named by the code review and must be in scope with ingest.
- Renderer `artSrc` + MovieCard/MovieDetailView already take dual args; contract work is a small renderer change once main always populates cache fields.

## Summary

This brief is a structural fix for UR-010’s half-complete “fail-fast serve cache only” change: make app-owned cache the only paint path end-to-end (writers → hydrate → backfill → protocol → artSrc), then delete dual-mode and timing noise. Prefer keeping `cachedPosterPath`/`cachedFanartPath` names unless rename is proven necessary; define backfill as async, concurrent, source-optional mirror that never blocks first paint; sequence REQs so contract + writers land before protocol hard-fail, and keep Kodi Drive sidecars optional and non-blocking.
