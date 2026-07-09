# REQ-022: Detail page — hero-band redesign (visible artwork, solid body)

**UR:** UR-005
**Status:** done
**Created:** 2026-07-09
**Layer:** renderer
**Entry point:** Click a movie card in the library → route `/movie/:id` renders `MovieDetailView.vue` (src/renderer/src/router.ts)
**Terminal state:** The detail page shows the fanart at near-full opacity in a top hero band (title/meta/actions overlaid in its lower-left), fading into a solid neutral-950 body where synopsis/stars/trailer sit on a clean surface — no full-page dimmed backdrop, no "content floating in darkness"
**Parent:**
**Closure proof:** upgrade: pending/ removal — human validation moved outside the system
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/renderer/src/views/MovieDetailView.vue, src/renderer/src/views/**tests**/MovieDetailView.test.ts
**Depends on:**

## Task

Replace the full-page dimmed-backdrop treatment in `src/renderer/src/views/MovieDetailView.vue` with the hero-band pattern (Plex/Jellyfin/TMDB style). The current implementation (lines 52–66) stacks four darkening layers — backdrop image at `opacity-45` with blur, a full-page 55% black overlay, an 85% black center panel with a `150px/110px` shadow spread, and a vertical gradient — leaving the artwork at ~7% effective visibility and making the content appear to float in darkness.

The redesign:

1. **Hero band.** Confine the backdrop to a top band (~45vh). Render it at near-full opacity — no blur, no flat scrim. Apply exactly two gradients: a bottom fade into the solid page background, and a left-side scrim for text legibility. Delete the four-layer stack.
2. **Hero content.** Overlay the title, star rating, runtime/certification/genres meta line, and the Play / Fix match buttons in the hero's lower-left, where the left scrim guarantees contrast. Remove the arbitrary `mt-40` spacer — the hero height defines the layout.
3. **Solid body.** Below the hero, render synopsis, stars, watched-state line, and trailer on a solid `neutral-950` background — no artwork bleed-through behind body text.
4. **Poster overlap.** The poster (left column) overlaps the hero's bottom edge via negative top margin, tying the two zones together.
5. **File-info collapse.** Replace the file-path card with a compact line: `<size> · Reveal in Finder`, with the full path available via tooltip or click-to-expand — not permanently displayed.
6. **Trailer sizing.** Cap the trailer embed at `max-w-2xl` with a locked 16:9 aspect ratio so it no longer dominates and clips off-screen.

Fallback behaviour (unchanged requirement from REQ-021): when the movie has no fanart, the hero band falls back to the poster or a solid dark surface — never a blank/white region. Background/hero layers must never intercept pointer events.

## Context

From the brief (UR-005): "background updated... background too dark, cannot see artwork... we may need a top banner back ... it kind of seems like the content is floating in the center of the darkness". The user approved the hero-band recommendation: a full-page backdrop behind readable text is an unwinnable tension — any scrim dark enough for legible body text makes the artwork invisible — so the fix separates the art zone (hero) from the text zone (solid body).

This REQ supersedes the visual treatment delivered by REQ-021 (UR-004, `.do-work/pending/REQ-021-detail-wider-content-fanart-background.md`), whose full-page-background approach failed human validation. Keep REQ-021's wider body container (`max-w-7xl`) — the width change was good; only the background treatment is being replaced. Existing component tests from REQ-021 that assert the full-page background element will need updating to assert the hero-band structure instead.

Advisory design reference: `docs/design/movie_detail_modal_the_matrix/` and tokens in `docs/design/cinematic_minimalist/DESIGN.md` — follow their spirit for gradient/scrim styling where it fits.

## Acceptance Criteria

- [x] The backdrop artwork is confined to a top hero band (height ≈ 40–50vh, not full-page), rendered without blur and without a flat full-coverage scrim; the four-layer darkening stack (opacity-45+blur image, 55% overlay, 85% center panel with 150px/110px shadow, full-page gradient) is deleted from the template.
- [x] The hero band carries exactly two gradient overlays: a bottom fade that resolves to the solid page background color, and a left-side scrim behind the title block.
- [x] Title, star rating, meta line (runtime/certification/genres), and the Play + Fix match buttons render inside the hero's lower-left region; the `mt-40` spacer is removed.
- [x] Content below the hero (synopsis, stars, trailer, file info) sits on a solid `neutral-950` (or equivalent token) background with no artwork visible behind body text.
- [x] The poster column overlaps the hero's bottom edge via a negative top margin (poster partially inside the hero, partially in the body).
- [x] The file-info card is replaced by a compact single line showing the file size and a "Reveal in Finder" action; the full file path is not permanently rendered — it is available via tooltip or click-to-expand.
- [x] The trailer embed is constrained to `max-w-2xl` with a 16:9 aspect ratio (`aspect-video` or equivalent).
- [x] When the movie has no fanart, the hero band falls back to the poster image or a solid dark surface — no blank/white region and no layout breakage; hero/background layers have `pointer-events: none` so all actions stay clickable.
- [x] The body container keeps its widened `max-w-7xl` width from REQ-021.
- [x] Component tests in `src/renderer/src/views/__tests__/MovieDetailView.test.ts` are updated to assert: (a) a hero element with an `mw-art:` source when `fanartPath` is set, (b) the fallback renders when `fanartPath` is null, (c) the full file path is not present in the default rendered output but the size + Reveal action are, (d) the trailer container carries the `max-w-2xl` and aspect-ratio classes.
- [x] Full suite stays green: `npx vitest run` passes 100%.

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/renderer/src/views/__tests__/MovieDetailView.test.ts`
   - Expected: updated component tests pass — hero band with `mw-art:` src when fanart exists, fallback when null, compact file-info line without full path, trailer sizing classes present.
2. **test** `npx vitest run`
   - Expected: full suite passes, no regressions in other renderer tests.
3. **build** `npm run typecheck`
   - Expected: exit 0.
4. **test** `npx eslint . --max-warnings 0`
   - Expected: exit 0.
5. **build** `npm run build`
   - Expected: typecheck + electron-vite build complete without errors (handoff: template → compiled renderer bundle).

## Manual checks (advisory)

- [ ] Run `npm run dev` and open a movie with fanart (e.g. A Man Called Otto) — Observable outcome: the artwork is clearly visible in the top hero band (recognisable imagery, not a murky dark wash); title and buttons are legible over the left scrim; the body below sits on a solid dark surface with nothing "floating in darkness"; the whole page reads as one composition, not a spotlit island.
- [ ] Open a movie without fanart — Observable outcome: hero shows the poster or solid dark fallback with identical layout, nothing blank or broken.
- [ ] Check the trailer — Observable outcome: the embed is modest (≤ ~672px wide, 16:9) and the page's key content fits close to one viewport without the trailer clipping awkwardly.

## Integration

**Reachability:** Route `/movie/:id` → `MovieDetailView.vue`, registered in `src/renderer/src/router.ts`; users reach it by activating a `MovieCard` in `LibraryView` (`src/renderer/src/components/MovieCard.vue`).

**Data dependencies:** Reads `movie.fanartPath` / `movie.posterPath` from `useLibraryStore` (`src/renderer/src/stores/library.ts`), mapped to renderable URLs by `artSrc` (`src/renderer/src/lib/art.ts`).

**Service dependencies:** Art files are served by the `mw-art://` protocol handler in the main process (`src/main/art-protocol.ts`) — already in place; no main-process changes required.

## Assets

- (screenshot of the too-dark result lives in the conversation; the current code state at `src/renderer/src/views/MovieDetailView.vue:52-66` is the authoritative "before")

## Outputs

- src/renderer/src/views/MovieDetailView.vue — Replaced full-page dark backdrop with hero-band artwork, solid body, compact file info, poster overlap, and capped trailer
- src/renderer/src/views/**tests**/MovieDetailView.test.ts — Updated component coverage for hero artwork, fallback, compact file info, trailer sizing, and width preservation
