---
ur: UR-011
received: 2026-07-31
status: captured
classification: feature
layers_in_scope: [shared, main, preload, renderer, packaging]
layer_decisions: { preload: no, packaging: no }
reqs:
  - { id: REQ-041, layer: none, integration_confidence: n/a }
  - { id: REQ-042, layer: shared, integration_confidence: high }
  - { id: REQ-043, layer: renderer, integration_confidence: high }
  - { id: REQ-044, layer: main, integration_confidence: high }
  - { id: REQ-045, layer: main, integration_confidence: high }
  - { id: REQ-046, layer: main, integration_confidence: high }
  - { id: REQ-047, layer: main, integration_confidence: high }
  - { id: REQ-048, layer: main, integration_confidence: high }
acknowledged_partials: []
---

<!-- capture-summary-start -->
## Capture summary (2026-07-31)

| Item | Value |
|---|---|
| Classification | feature |
| Layers in scope | shared, main, preload, renderer, packaging |
| Layer decisions | preload: no, packaging: no |
| REQs generated | 8 |

| REQ | Layer | Integration confidence |
|---|---|---|
| REQ-041 | none | n/a |
| REQ-042 | shared | high |
| REQ-043 | renderer | high |
| REQ-044 | main | high |
| REQ-045 | main | high |
| REQ-046 | main | high |
| REQ-047 | main | high |
| REQ-048 | main | high |
<!-- capture-summary-end -->

# UR-011: User Request

## Request

1. Contract: “Renderer never paints Drive art paths.” Encode in types/helpers: display art is cachedPosterPath | null only (or rename to posterCachePath).
2. Writers: fetchAndApply + ingest always materialize under cachedSidecarPathsFor; optionally still write Drive sidecars for Kodi/NFO compatibility, but UI never depends on them.
3. Protocol: require userDataPath; serve only cache root; remove dual-mode.
4. Hydrate: keep completeCachedArtworkPaths as migration; then persist completed fields so it becomes a no-op.
5. Backfill: startup scan must re-touch records missing cache art (async, limited concurrency), not only brand-new files — otherwise incomplete cache never recovers.
6. Delete or gate: startup-timings production noise; preferCache = !markMissing → explicit mode; dual artSrc fallback.
7. Stop copying image buffers in serveArtFile.

## Clarifications

**Q:** Explicit scan modes vs current preferCache = !markMissing; protocol dual-mode; hydrate migration; display-only cache paths
**A:** Map modes to existing contracts: `startup` = prefer cache, do not mark missing; `rescan` = full source reconcile + mark missing. Production already passes `userDataPath` into `serveArtFile` — requiring it is the production contract (tests must pass userData). Keep `completeCachedArtworkPaths` on hydrate then persist so fields stick. Renderer display art uses only `cachedPosterPath`/`cachedFanartPath` (no Drive fallback in artSrc). *(inferred, confirmed)*

**Q:** You said display art is “cachedPosterPath | null only (or rename to posterCachePath).” Which should capture encode?
**A:** Keep names `cachedPosterPath`/`cachedFanartPath`; change contract only (renderer ignores `posterPath`/`fanartPath` for paint).

**Q:** You said startup scan must “re-touch records missing cache art (async, limited concurrency).” When cache art is missing, may backfill read/copy from Drive source sidecars?
**A:** May mirror from Drive: async limited pool may copy source poster/fanart into cache when missing — never blocks first paint; placeholders until done.

**Q:** You said backfill is “async, limited concurrency.” What pool size for concurrent Drive→cache art mirrors?
**A:** 2 concurrent.

**Q:** You said always materialize under cache and “optionally still write Drive sidecars for Kodi.” On TMDB match, Drive writes best-effort?
**A:** Yes — cache required for match paint success; Drive NFO/poster write failures only set sidecarWriteFailed / are swallowed.
