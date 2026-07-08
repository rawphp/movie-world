---
ur: UR-005
received: 2026-07-09
status: captured
classification: feature
layers_in_scope: [shared, main, preload, renderer, packaging]
layer_decisions: { shared: no, main: no, preload: no, packaging: no }
reqs:
  - { id: REQ-022, layer: renderer, integration_confidence: high }
acknowledged_partials: []
---

<!-- capture-summary-start -->
## Capture summary (2026-07-09)

| Item | Value |
|---|---|
| Classification | feature |
| Layers in scope | shared, main, preload, renderer, packaging |
| Layer decisions | shared: no, main: no, preload: no, packaging: no |
| REQs generated | 1 |

| REQ | Layer | Integration confidence |
|---|---|---|
| REQ-022 | renderer | high |
<!-- capture-summary-end -->

# UR-005: User Request

## Request

background updated... background too dark, cannot see artwork... we may need a top banner back ... it kind of seems like the content is floating in the center of the darkness: [screenshot of A Man Called Otto detail view]

how would you improve this UI?

[User approved the following recommendation with "yes, go":]

Root cause: `MovieDetailView.vue:52-66` stacks four darkening layers over the artwork (image at opacity-45 with blur, full-page 55% black overlay, 85% black center panel with 150px/110px shadow spread, vertical gradient). Artwork ends up at ~7% effective visibility, and the huge soft shadow creates the "content floating in darkness" effect. A full-page backdrop behind readable text is an unwinnable tension — any scrim dark enough for legible body text makes the artwork invisible.

Approved approach — the hero-band pattern (Plex/Jellyfin/TMDB style):

1. Confine the backdrop to a top band (~45vh). Show it at near-full opacity — no blur, no flat scrim — with just two gradients: a bottom fade into the solid page background, and a left-side scrim for text legibility.
2. Overlay title, rating, meta, and the Play/Fix match buttons in the hero's lower-left, where the gradient guarantees contrast. This also removes the current `mt-40` arbitrary dead space above the title — the hero height defines the layout.
3. Solid `neutral-950` body below the hero for synopsis, stars, and trailer. Text sits on a clean surface, nothing floats.
4. Poster overlaps the hero's bottom edge (negative top margin on the left column) — the classic detail-page look that ties the two zones together.

Two smaller included fixes:

- The file-path card is visual noise — collapse it to `2.33 GB · Reveal in Finder` with the full path in a tooltip or click-to-expand.
- The trailer embed is oversized and clips off-screen. Cap it at `max-w-2xl` with a locked 16:9 aspect so the whole page fits closer to one viewport.

This replaces the four-layer stack with something simpler — deletes more CSS than it adds.
