# REQ-014: Library UI — grid, card, filter bar, star rating

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** renderer
**Entry point:** App launch / `/` route (LibraryView) — the default window view
**Terminal state:** A responsive poster grid renders one MovieCard per movie with the correct state badges, and the FilterBar filters/sorts the grid live in-memory
**Parent:**
**Closure proof:** commit:44f7e5a tests:passed
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** L
**Files:** src/renderer/src/components/StarRating.vue, src/renderer/src/components/MovieCard.vue, src/renderer/src/components/FilterBar.vue, src/renderer/src/views/LibraryView.vue, src/renderer/src/router.ts, src/renderer/src/lib/art.ts, src/renderer/src/App.vue, src/renderer/src/main.ts, src/renderer/src/components/__tests__/MovieCard.test.ts, src/renderer/src/components/__tests__/FilterBar.test.ts
**Depends on:** REQ-013

## Task

Build the library view and its components **to match the `movie_world_main_screen` mockup** in the Cinematic Minimalist design system: `StarRating.vue` (renders `voteAverage/2` as 5 stars, half-star rounding, raw score in `title`), `MovieCard.vue` (poster via `artSrc`, title, year, AU badge, ★ rating, top actors, last-watched; state badges), `FilterBar.vue` (reads/writes the store), `LibraryView.vue` (responsive grid), the app shell **TopAppBar** + **status banner**, the Vue Router (`/`, `/movie/:id`, `/settings`, hash mode), and `art.ts` (`artSrc(path)` → `mw-art://` URL). Install Pinia + router in `main.ts`, rewrite the App shell, delete template demo components. TDD MovieCard and FilterBar.

## Context

From the plan (Task 12): MovieCard badge test-ids are `badge-pending`, `badge-unmatched`, `badge-missing`, `badge-unsaved`, `badge-fetch-failed`; StarRating shows `voteAverage/2`. `artSrc(path)` maps an on-disk poster/fanart path to the `mw-art://` protocol registered in REQ-011. Routes: `/` → LibraryView, `/movie/:id` → MovieDetailView (REQ-015), `/settings` → SettingsView (REQ-016). Per ideate (Challenger): posters load through `mw-art://`; if `artSrc`/protocol/CSP are wrong, artwork silently fails — the MovieCard test should assert the poster `<img>` src uses `mw-art:`.

## Design reference

Match `docs/design/movie_world_main_screen/` (`code.html` + `screen.png`) and the tokens in `docs/design/cinematic_minimalist/DESIGN.md` (wired in REQ-001).

- **App shell / TopAppBar:** fixed, translucent (`bg-background/80 backdrop-blur-xl`), brand "🎬 Movie World" (`headline-md`, bold) on the left; on the right a **Library** nav link (active = `text-primary`) and a **settings gear** icon button (Material Symbols `settings`) routing to `/settings`. **Drop the mockup's "Discover"/"Collections" nav links and the mobile bottom nav bar** — out of scope (v1 is movies-only, macOS desktop). `main` is `max-w-[1440px]` centered with `pt-24` to clear the fixed bar.
- **Status banner:** when `pendingCount > 0`, a dismissible glass banner (`bg-primary-container/10`, `sync` icon, `text-primary`) reading "Fetching metadata for N movies…". Hidden when nothing is pending.
- **Filter bar:** a single pill-shaped, horizontally-scrolling strip (`rounded-full`, `backdrop-blur-xl`, `hide-scrollbar`) with an inline search field (`search` icon), pill filter controls, a "Sort: …" pill, and a `text-primary` "Clear" action. Active pills use `bg-primary-container text-on-primary-container`; inactive use `bg-surface-container-high text-on-surface-variant`.
- **Poster card:** `aspect-[2/3]`, `rounded-xl`, `.poster-shadow`, `group-hover:scale-[1.02]`; AU age-rating chip bottom-right (`bg-black/60 backdrop-blur-md`, `label-sm`); below the poster: bold title (`body-md`, truncate), year (`label-md`, `on-surface-variant`), ★ rating in `text-tertiary-container` with a filled `star` icon, and a truncated top-billed-actor line (`label-sm`, dimmed). State badges are pill chips top-left/right with a solid status dot + uppercase `label-sm` label.
- **State badge → status mapping** (semantic tokens): `pending` → "Fetching…" `primary-container` (cyan, pulsing); `unmatched` → "Needs Match" `tertiary-container` (amber); `fileMissing` → "File Missing" `error` (red) + poster dimmed to `opacity-50`; `sidecarWriteFailed` → "Not Saved" `tertiary` (orange); `fetchFailed` → "Fetch Failed" `error` with an inline Retry affordance (`window.api.retryFetch`). Pending/unmatched cards with no poster show a placeholder icon on `bg-surface-container`.
- **Grid density** is driven by `usePreferencesStore.posterSize` (REQ-013): `small`/`medium`/`large` map to more/fewer columns (e.g. base `grid-cols-2`, `md:grid-cols-4`, `lg:grid-cols-6` at `medium`, denser at `small`, larger at `large`) with `gap-x-gutter gap-y-stack-lg`.
- **Adult-rating gating:** when `usePreferencesStore.showAdultRatings` is `false`, the R18+/adult age-rating chip is hidden on the card.

## Acceptance Criteria

- [ ] `StarRating.vue` given `voteAverage` renders 5 stars representing `voteAverage/2` with half-star rounding, and exposes the raw score via the `title` attribute; a null `voteAverage` renders an empty/zero state without error.
- [ ] `MovieCard.vue` renders poster (`<img>` src from `artSrc`, i.e. `mw-art:` when a poster path exists), title, year, AU age-rating badge, ★ rating, top-billed actor names, and last-watched (relative time or "never").
- [ ] MovieCard renders the correct state badge by test-id: `badge-pending` (pending, "Fetching…", cyan), `badge-unmatched` (unmatched, "Needs Match", amber), `badge-missing` (fileMissing, "File Missing", red + dimmed poster), `badge-unsaved` (sidecarWriteFailed, "Not Saved", orange), `badge-fetch-failed` (fetchFailed, "Fetch Failed", red + Retry). A `matched` movie with no error flag shows no state badge.
- [ ] MovieCard styling matches the mockup: `aspect-[2/3] rounded-xl` poster with `.poster-shadow`, AU rating chip bottom-right, ★ rating in `text-tertiary-container`, truncated top-actor line; the AU chip is hidden when `usePreferencesStore.showAdultRatings` is `false` and the certification is R18+/adult.
- [ ] MovieCard emits `open(id)` when activated.
- [ ] `FilterBar.vue` reads and writes the store filters/sort directly (no props); changing a control updates the store so `LibraryView`'s grid reflects it. It renders as the pill-shaped strip from the mockup (search field + filter pills + sort pill + Clear), with active pills styled `bg-primary-container`.
- [ ] `LibraryView.vue` renders a responsive grid of MovieCards from the store's `list` getter; grid column density follows `usePreferencesStore.posterSize`.
- [ ] The app shell renders the TopAppBar (brand + Library nav + settings gear → `/settings`) and, when `pendingCount > 0`, the "Fetching metadata for N movies…" status banner; the mockup's Discover/Collections links and mobile bottom nav are omitted.
- [ ] Router exposes `/`, `/movie/:id`, `/settings` in hash mode; Pinia and the router are installed in `main.ts`; template demo components are deleted (no leftover lint/type noise).
- [ ] MovieCard and FilterBar component tests (`@vue/test-utils`) pass under `npx vitest run`, asserting the rendered badges/test-ids and the `mw-art:` poster src.

## Verification Steps

1. **test** `npx vitest run src/renderer/src/components/__tests__/MovieCard.test.ts src/renderer/src/components/__tests__/FilterBar.test.ts` — Expected: mounted components render the specified test-ids/badges; MovieCard poster src uses `mw-art:`; FilterBar writes flow to the store. (These jsdom component tests are the executable stand-in for the visual check.)
2. **build** `npx tsc --noEmit` — Expected: exit 0.
3. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.
4. **build** `npm run build` — Expected: renderer builds with router + Pinia wired; no errors.

## Post-merge validation

- [ ] Run `npm run dev` against a real library folder — Observable outcome: the default window matches the `movie_world_main_screen` mockup — TopAppBar + pill filter bar + poster grid in Cinematic Minimalist styling; typing in search and changing genre/sort filters the grid instantly; pending/unmatched cards show the right coloured badges; while fetches run, the "Fetching metadata for N movies…" banner is visible.

## Integration

**Reachability:** `LibraryView` is the `/` route (default view) registered in `src/renderer/src/router.ts` and mounted by the App shell / `main.ts`. MovieCard's `open(id)` navigates to `/movie/:id` (REQ-015). FilterBar is embedded in LibraryView.

**Data dependencies:** Reads the `useLibraryStore` `list`, filter-option getters, and filters/sort (REQ-013). Poster/fanart paths are turned into `mw-art://` URLs by `artSrc` and served by the main protocol handler (REQ-011).

**Service dependencies:** Pinia stores `useLibraryStore` + `usePreferencesStore` (REQ-013), Vue Router, Tailwind + Cinematic Minimalist tokens and bundled Inter/Material Symbols (REQ-001), the `mw-art://` protocol (REQ-011). Consumes `MovieRecord`/`LibraryFilters`/`SortKey` (REQ-002/013). `fetchFailed` Retry uses `window.api.retryFetch` (REQ-012).
