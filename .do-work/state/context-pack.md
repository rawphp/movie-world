# Context Pack — movie-world

Generated: 2026-07-09

## Architecture

movie-world is an Electron desktop app built with electron-vite, Vue, Pinia,
TypeScript, Tailwind utility classes, and Vitest. The app has three process
boundaries:

- Main process (`src/main/`) owns filesystem access, TMDB/library services, IPC,
  local artwork serving over `mw-art:`, CSP, and BrowserWindow lifecycle.
- Preload (`src/preload/`) exposes the typed `window.api` bridge.
- Renderer (`src/renderer/src/`) owns Vue routes, views, components, Pinia state,
  filtering, and the movie detail UI.

## Directory Roles

- `src/shared/` — shared domain types.
- `src/main/` — Electron bootstrap, IPC, TMDB, scanner/NFO, artwork protocol,
  settings, player/watch state, and related tests.
- `src/preload/` — contextBridge API and renderer-visible typings.
- `src/renderer/src/` — Vue app, router, views, components, stores, helpers, CSS.
- `src/**/__tests__/` — Vitest tests colocated under source subtrees.
- `docs/design/` — visual reference material and design tokens.

## Key Renderer Files

- `src/renderer/src/views/MovieDetailView.vue` — route `/movie/:id`; renders hero,
  poster, file info, play/fix actions, synopsis, stars, and YouTube trailer.
- `src/renderer/src/views/__tests__/MovieDetailView.test.ts` — expected focused
  component test target for UR-004; create it if absent.
- `src/renderer/src/lib/art.ts` — maps poster/fanart filesystem paths to
  `mw-art:` URLs via `artSrc`.
- `src/renderer/src/stores/library.ts` — movie state consumed by detail view.
- `src/renderer/src/router.ts` — route definitions, including `/movie/:id`.
- `src/renderer/src/App.vue` — app shell with `max-w-[1440px]` main container.

## Test And Command Conventions

- Full suite: `npx vitest run`
- Focused detail-view test: `npx vitest run src/renderer/src/views/__tests__/MovieDetailView.test.ts`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Lint strict: `npx eslint . --max-warnings 0`
- Component tests that need DOM use jsdom, commonly via a file directive.
- Keep helper logic testable without booting Electron when possible.

## Current UR-004 Intent

The request is a visual refinement of the movie detail page:

- The content area is too narrow; widen it beyond `max-w-5xl`, at least to
  `max-w-7xl`, while preserving responsive behavior.
- Replace the flat black page background with the movie artwork/fanart as a
  full-page background layer using `artSrc(movie.fanartPath)` / `mw-art:`.
- Add a dark shade/scrim strongest behind central content so text and controls
  remain high contrast. Artwork should be visible toward the edges, content
  clearly dominant.
- Reconcile the existing hero-strip backdrop with the new full-page backdrop so
  the page does not show clashing duplicate image treatments.
- If no fanart exists, fall back to poster artwork or the existing solid dark
  background. The fallback must never produce a blank/white page.
- Background layers must stay behind content and not intercept pointer events.

Screenshot asset:

- `.do-work/user-requests/UR-004/assets/screenshot-1.png` shows the current
  Absolutely Anything detail page with a black outside field and narrower body.

Design reference:

- `docs/design/cinematic_minimalist/DESIGN.md` emphasizes cinematic quietude,
  near-black foundation, artwork-forward surfaces, restrained cyan accents,
  and broad diffused shadows.
- `docs/design/movie_detail_modal_the_matrix/` is an advisory detail-surface
  reference; follow its spirit, not its exact page structure.

## Recent Relevant Work

- `REQ-018` fixed `mw-art:` poster serving and centralized renderer CSP.
- `REQ-019` fixed dev startup readiness and added main-process startup logging.
- `REQ-020` scoped CSP injection so YouTube iframe responses are not rewritten;
  it is merged and parked pending human packaged-app validation. Do not rework
  trailer behavior for UR-004 unless a test fails due to the visual change.
