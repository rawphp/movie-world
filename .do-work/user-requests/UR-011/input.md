---
ur: UR-011
received: 2026-07-31
status: intake
---

# UR-011: User Request

## Request

1. Contract: “Renderer never paints Drive art paths.” Encode in types/helpers: display art is cachedPosterPath | null only (or rename to posterCachePath).
2. Writers: fetchAndApply + ingest always materialize under cachedSidecarPathsFor; optionally still write Drive sidecars for Kodi/NFO compatibility, but UI never depends on them.
3. Protocol: require userDataPath; serve only cache root; remove dual-mode.
4. Hydrate: keep completeCachedArtworkPaths as migration; then persist completed fields so it becomes a no-op.
5. Backfill: startup scan must re-touch records missing cache art (async, limited concurrency), not only brand-new files — otherwise incomplete cache never recovers.
6. Delete or gate: startup-timings production noise; preferCache = !markMissing → explicit mode; dual artSrc fallback.
7. Stop copying image buffers in serveArtFile.
