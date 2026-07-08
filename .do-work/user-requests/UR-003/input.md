---
ur: UR-003
received: 2026-07-09
status: captured
classification: bug-fix
layers_in_scope: []
layer_decisions: {}
reqs:
  - { id: REQ-019, layer: none, integration_confidence: n/a }
  - { id: REQ-020, layer: none, integration_confidence: n/a }
acknowledged_partials: []
---

<!-- capture-summary-start -->
## Capture summary (2026-07-09)

| Item | Value |
|---|---|
| Classification | bug-fix |
| Layers in scope | (none — bug-fix) |
| Layer decisions | (none — all covered) |
| REQs generated | 2 |

| REQ | Layer | Integration confidence |
|---|---|---|
| REQ-019 | none | n/a |
| REQ-020 | none | n/a |
<!-- capture-summary-end -->

# UR-003: User Request

## Request

movie detail trailer not working. Just a placeholder in the UI?

## Clarifications

**Q:** You said the trailer is "not working — just a placeholder in the UI". What exactly do you see in the Trailer section of the detail view?
**A:** Blank/black box — an empty or black rectangle where the video player should be. The iframe branch renders (trailerYoutubeKey is set) but shows nothing.

**Q:** Where are you seeing the blank/black box — dev (`npm run dev`) or the packaged app?
**A:** Packaged build.

**Q:** Is the blank trailer box happening for every movie's detail page, or only some movies?
**A:** Every movie — points to CSP/embed/origin in the packaged app, not per-video YouTube restrictions.

**Q:** Have you confirmed the trailer plays correctly in dev?
**A:** Dev seems to have another bug — it hangs during startup, so dev behavior is unknown.

**Q:** Should the dev startup hang be part of this UR or recorded separately?
**A:** Include in this UR — it blocks trailer diagnosis and verification in dev.
