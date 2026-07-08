# REQ-021: Detail page — wider content + fanart page background with central shade

**UR:** UR-004
**Status:** backlog
**Created:** 2026-07-09
**Layer:** renderer
**Entry point:** Click a movie card in the library → route `/movie/:id` renders `MovieDetailView.vue` (src/renderer/src/router.ts)
**Terminal state:** The detail page renders the movie's fanart as the full-page background with a dark shade centered behind the content keeping everything legible, and the body content column is visibly wider than today's `max-w-5xl`
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/renderer/src/views/MovieDetailView.vue, src/renderer/src/views/__tests__/MovieDetailView.test.ts
**Depends on:**

## Task

Redesign the movie detail page (`src/renderer/src/views/MovieDetailView.vue`) in two coupled ways:

1. **Widen the content section.** The two-column body is currently capped at `max-w-5xl` (1024px) inside the app shell's `max-w-[1440px]` main (src/renderer/src/App.vue). Widen the body container (e.g. `max-w-7xl` or the shell width) so the synopsis/trailer column gets meaningfully more room at typical window sizes.
2. **Fanart as page background.** Replace the flat black/neutral-900 page background with the movie's fanart rendered as a full-view background layer (via `artSrc(movie.fanartPath)` → `mw-art://`), overlaid with a dark scrim/shade that is strongest behind the central content area so the content is not overcrowded and text stays high-contrast, while the artwork remains visible toward the edges. Reconcile the existing hero-strip backdrop (lines 49–76) with the new full-page background so the page doesn't show a doubled/clashing image treatment. Balance is the explicit requirement: the artwork must enhance, not fight, the content.

Fallback behaviour: when the movie has no fanart, fall back to the poster or the existing solid dark background — never a blank/white page. The background layer must sit behind all content and never intercept pointer events.

## Context

From the brief (UR-004): "the content section is a bit narrow, could be wider; additionally, instead of the black background, can we have the movie artwork as the background and adding some shadow or shade in the center so not to overcrowd the content (needs to be well balanced so not to impact UX)". Screenshot of the current page: `.do-work/user-requests/UR-004/assets/screenshot-1.png`.

Advisory design reference: `docs/design/movie_detail_modal_the_matrix/` (`code.html` + `screen.png`) shows the Cinematic Minimalist treatment for the detail surface, including background/backdrop styling; tokens in `docs/design/cinematic_minimalist/DESIGN.md`. Follow its spirit for the scrim/gradient treatment where it fits the brief.

## Acceptance Criteria

- [ ] The detail body container uses a wider max-width than `max-w-5xl` (at least `max-w-7xl`), so at a 1440px-wide window the content columns are visibly wider than before.
- [ ] When the movie has fanart, the whole detail view (not just the hero strip) shows the fanart as a background layer sourced through `artSrc` (`mw-art:` URL), with a dark scrim/gradient overlay centered behind the content area.
- [ ] The background layer sits behind all foreground content in stacking order and has `pointer-events: none` (or equivalent), so Play/Fix match/trailer/Reveal remain fully interactive.
- [ ] When the movie has no fanart, the page falls back to the poster image or the existing solid dark background — no blank/white background and no layout breakage.
- [ ] The hero header area does not show a clashing doubled-image treatment — the previous hero backdrop is either removed or visually merged with the full-page background.
- [ ] A component test `src/renderer/src/views/__tests__/MovieDetailView.test.ts` mounts the view and asserts: (a) a background element with an `mw-art:` source (or style) is present when `fanartPath` is set, (b) the fallback renders when `fanartPath` is null, (c) the body container carries the wider max-width class.
- [ ] Full suite stays green: `npx vitest run` passes 100%.

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/renderer/src/views/__tests__/MovieDetailView.test.ts`
   - Expected: new component tests pass — background layer with `mw-art:` src when fanart exists, fallback when null, wider container class present. (jsdom component tests are the executable stand-in for the visual check.)
2. **test** `npx vitest run`
   - Expected: full suite passes, no regressions in existing renderer tests.
3. **build** `npm run typecheck`
   - Expected: exit 0.
4. **test** `npx eslint . --max-warnings 0`
   - Expected: exit 0.
5. **build** `npm run build`
   - Expected: typecheck + electron-vite build complete without errors (handoff: template → compiled renderer bundle).

## Post-merge validation

- [ ] Run `npm run dev` and open a movie that has fanart (e.g. Absolutely Anything) — Observable outcome: the artwork fills the page background with a central shade; synopsis/stars/trailer sit on a comfortably wider column; text is easy to read and the page does not feel overcrowded — artwork visible toward the edges, content clearly dominant (the brief's "well balanced" call is a human judgment).
- [ ] Open a movie without fanart/poster — Observable outcome: page shows the dark fallback background with identical layout, nothing blank or broken.

## Integration

**Reachability:** Route `/movie/:id` → `MovieDetailView.vue`, registered in `src/renderer/src/router.ts`; users reach it by activating a `MovieCard` in `LibraryView` (`src/renderer/src/components/MovieCard.vue`).

**Data dependencies:** Reads `movie.fanartPath` / `movie.posterPath` from `useLibraryStore` (`src/renderer/src/stores/library.ts`), mapped to renderable URLs by `artSrc` (`src/renderer/src/lib/art.ts`).

**Service dependencies:** Art files are served by the `mw-art://` protocol handler in the main process (`src/main/art-protocol.ts`) — already in place; no main-process changes required.

## Assets

- .do-work/user-requests/UR-004/assets/screenshot-1.png — screenshot of the current detail page showing the narrow content column and black background
