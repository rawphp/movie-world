# REQ-015: Movie detail view & fix-match dialog

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** renderer
**Entry point:** Clicking a MovieCard → `/movie/:id` route (MovieDetailView)
**Terminal state:** The detail view shows full metadata + trailer and Play works; the Fix-match dialog re-matches a movie via TMDB search or raw ID and the card/detail updates live
**Parent:**
**Closure proof:** commit:9acd4c9 tests:passed
**Criteria approved:** agent-drafted
**Priority:** 1
**Size:** M
**Files:** src/renderer/src/views/MovieDetailView.vue, src/renderer/src/components/FixMatchDialog.vue, src/renderer/src/components/**tests**/FixMatchDialog.test.ts
**Depends on:** REQ-014

## Task

Implement `MovieDetailView.vue` (replacing the Task 12 stub) and `FixMatchDialog.vue`, styled per the `movie_detail_modal_the_matrix` mockup **as a full routed view** (`/movie/:id`, not a modal). Detail: backdrop header, poster, overview, runtime, genres, cast, certification, ★ rating, embedded YouTube trailer iframe (graceful "no trailer found"), Play button, watch history line, file info (path/size, reveal-in-Finder), and a Fix-match button. Fix-match dialog: live TMDB candidate search (editable title/year) plus a raw TMDB ID escape hatch, rendered as a centered modal. TDD the dialog.

## Context

From the plan (Task 13): FixMatchDialog props `{ movie }`, emits `close`; test-ids `fix-search-input`, `fix-search-year`, `fix-candidate` (one per result), `fix-id-input`, `fix-id-submit`. It consumes `window.api.searchTmdb/fixMatch/play/retryFetch/revealFile` (REQ-011/012), `artSrc` and `StarRating` (REQ-014). Per ideate (Connector): selecting a candidate OR submitting a raw ID both route through `fixMatch` → the shared `applyDetails`/`fetchAndApply` pipeline (REQ-010/008/006), so the rewritten NFO is identical either way. Per ideate (Challenger): the trailer iframe requires internet and CSP `frame-src https://www.youtube.com` (set in REQ-011); render a graceful "no trailer found" state when the key is absent.

## Design reference

Match the layout of `docs/design/movie_detail_modal_the_matrix/` (`code.html` + `screen.png`) and the Cinematic Minimalist tokens — but rendered as the **`/movie/:id` routed page**, not the mockup's floating modal.

- **Hero header:** full-width backdrop (fanart via `artSrc`, dimmed `opacity-40` with a `bg-gradient-to-t` fade into the surface), a close/back control returning to `/`, and a title overlay — `display-lg` title + `(year)`, then a metadata row of ★ rating (`text-tertiary`), runtime, AU certification chip, and genres separated by dot glyphs.
- **Two-column content** (`md:grid-cols-[300px_1fr]`): left = `aspect-[2/3]` poster (`.poster-shadow`) above a tech-info card; right = a `bg-primary-container` pill **Play** button (filled `play_arrow`) + a secondary pill, then **Synopsis** (`headline-sm` heading + `body-md` overview), then a Director/**Stars** grid, then a bottom action row.
- **Actions:** the mockup's "Edit Metadata" maps to the **Fix-match** button; the bottom row uses `text-on-surface-variant` hover styling.
- **Decorative / out-of-scope mockup elements (omit — no domain-model backing):** the "Watchlist" button, the "Remove from Library" action (v1 removal is folder-level "forget" in Settings, not per-movie), and the tech-card rows for **Resolution**, **Audio**, and **Added date** (not in `MovieRecord`; would require ffprobe/extra fields, out of scope). **Director** is likewise not in the domain model — omit it or leave the label with the cast; do not invent data. The tech-info card therefore shows **File Size** + file path with reveal-in-Finder; keep it minimal rather than fabricating fields.

## Acceptance Criteria

- [ ] `MovieDetailView.vue` renders, in the mockup's layout (dimmed backdrop hero + title overlay, two-column poster/content body), the backdrop + poster (via `artSrc`), title/year, overview, runtime, genres, cast, AU certification, ★ rating (StarRating, `text-tertiary`), a pill Play button, a watch-history line, and a minimal file-info card (File Size + path + reveal-in-Finder). It does **not** render Watchlist / Remove-from-Library / Resolution / Audio / Added-date (out of scope).
- [ ] The AU certification chip respects `usePreferencesStore.showAdultRatings` (hidden for R18+/adult when off), consistent with the card.
- [ ] When a trailer YouTube key exists, an embedded YouTube iframe is rendered; when absent, a "no trailer found" state renders instead (no broken iframe).
- [ ] The Play button calls `window.api.play(id)`; reveal-in-Finder calls `window.api.revealFile(id)`.
- [ ] `FixMatchDialog.vue` renders as a centered modal (glass backdrop; the blur is gated by `usePreferencesStore.backdropBlur`) with `fix-search-input`, `fix-search-year`, a `fix-candidate` per TMDB result (from `window.api.searchTmdb`), `fix-id-input`, and `fix-id-submit`.
- [ ] Selecting a `fix-candidate` and submitting a raw `fix-id-input` both call `window.api.fixMatch(id, tmdbId)` and then emit `close`.
- [ ] The FixMatchDialog test passes under `npx vitest run` (stubbing `window.api.searchTmdb`/`fixMatch`), asserting candidates render and both re-match paths call `fixMatch`.

## Verification Steps

1. **test** `npx vitest run src/renderer/src/components/__tests__/FixMatchDialog.test.ts` — Expected: candidates render one `fix-candidate` per stubbed result; selecting a candidate and submitting a raw id each invoke `fixMatch` with the right tmdbId, then emit `close`.
2. **build** `npx tsc --noEmit` — Expected: exit 0.
3. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.
4. **build** `npm run build` — Expected: renderer builds; no errors.

## Post-merge validation

- [ ] Run `npm run dev`: open a matched movie — Observable outcome: detail view shows metadata and (with internet) the YouTube trailer; Play launches the external player and the watch-history line updates.
- [ ] Open Fix-match on an unmatched movie, search a title, pick a candidate — Observable outcome: the movie re-matches, sidecars rewrite, and the card/detail update live.

## Integration

**Reachability:** `MovieDetailView` is the `/movie/:id` route (REQ-014 router); reached by MovieCard's `open(id)`. `FixMatchDialog` is opened from the detail view's Fix-match button (and/or an unmatched card).

**Data dependencies:** Reads the movie from `useLibraryStore` (REQ-013); triggers `fixMatch`/`play`/`retryFetch`/`revealFile`/`searchTmdb` via `window.api` (REQ-012). Re-match rewrites NFO/artwork sidecars through the manager pipeline (REQ-010).

**Service dependencies:** `window.api` (REQ-012), `useLibraryStore` + `usePreferencesStore` (REQ-013), `StarRating`/`artSrc` (REQ-014), Cinematic Minimalist tokens (REQ-001), YouTube embed (needs CSP `frame-src`, REQ-011).
