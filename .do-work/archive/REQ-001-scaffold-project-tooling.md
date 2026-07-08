# REQ-001: Scaffold project & tooling

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** packaging
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** commit:a1b2059 tests:passed
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** M
**Files:** package.json, .gitignore, electron.vite.config.ts, vitest.config.ts, src/renderer/src/assets/main.css
**Depends on:**

## Task

Scaffold the electron-vite Vue-TS app into the existing repo (which already holds `docs/` and `.git`), wire Tailwind CSS 4 into the renderer **with the "Cinematic Minimalist" design system** (`docs/design/cinematic_minimalist/DESIGN.md`), add a root `vitest.config.ts`, and get all four toolchain gates green: `npm run dev` opens an Electron window, `npx vitest run`, `npx eslint . --max-warnings 0`, and `npx tsc --noEmit`. This is Task 1 of the plan and the foundation every later REQ builds on.

## Context

From the plan (Task 1): scaffold into a temp dir and merge so `docs/`/`.git` survive (`npm create @quick-start/electron@latest tmp-scaffold -- --template vue-ts --skip`, then `rsync -a tmp-scaffold/ . && rm -rf tmp-scaffold`). Add runtime deps `pinia vue-router fast-xml-parser` and dev deps `tailwindcss @tailwindcss/vite vitest @vue/test-utils jsdom`. Tailwind 4 is wired via `@tailwindcss/vite` in the renderer section of `electron.vite.config.ts` and `@import "tailwindcss";` in the renderer base CSS. Vitest config uses `environment: 'node'` (component tests opt into jsdom via pragma), `include: ['src/**/__tests__/**/*.test.ts']`, and aliases `@renderer`/`@shared`. Delete unused template demo components rather than suppressing lint/type noise.

## Design system

The renderer uses the **Cinematic Minimalist** design system defined in `docs/design/cinematic_minimalist/DESIGN.md` (with the reference mockups under `docs/design/movie_world_main_screen/`, `movie_detail_modal_the_matrix/`, `movie_world_settings/`). Wire it into Tailwind 4 via a `@theme {}` block in `src/renderer/src/assets/main.css` — Tailwind 4 reads tokens from CSS `@theme`, **not** a `tailwind.config.js` (the mockups' `tailwind.config` block is Tailwind-3 syntax and must be translated to `@theme`).

- **Colors:** the full Material-style token set from `DESIGN.md` (`primary`, `on-primary`, `surface-container-*`, `tertiary`, `error`, `outline`, etc.). Ground the base background at **`#0B0B0C`** (near-black) and elevated surfaces at **`#161617`**, matching the mockup `body`/`.glass-panel` styles and the "Near-Black foundation" prose — note these override the `background`/`surface` values in the DESIGN.md frontmatter, which are lighter.
- **Typography:** **Inter** (weights 400/600/700/800) as the sole family; the `display-lg` / `headline-md` / `headline-sm` / `body-md` / `body-sm` / `label-md` / `label-sm` scale from `DESIGN.md`.
- **Icons:** **Material Symbols Outlined** (used across all three mockups).
- **Radii / spacing:** the `rounded` and `spacing` tokens from `DESIGN.md` (8px base unit; `container-margin`, `gutter`, `stack-*`; pill `full`, `xl`, `lg` radii).
- **Offline fonts (important):** the mockups load Inter and Material Symbols from the Google Fonts CDN and Tailwind from the Tailwind CDN. The packaged Electron app runs **offline behind a strict CSP** (REQ-011), so those CDNs will not load. **Bundle the fonts locally** (e.g. `@fontsource/inter` + the `material-symbols` npm package, imported from the renderer CSS/entry) instead of any CDN `<link>`. Tailwind is already the local `@tailwindcss/vite` build, not the CDN.
- Utility helpers used by the mockups (`.glass-panel` backdrop-blur, `.poster-shadow`, `.hide-scrollbar`, filled-icon variation settings) may be added as small base-layer CSS.

## Acceptance Criteria

- [ ] `npm run dev` launches an Electron window without runtime errors (template demo content acceptable at this stage).
- [ ] `npx vitest run` exits 0 (either "no test files found" or the template sample passing).
- [ ] `npx eslint . --max-warnings 0` exits 0 with zero warnings.
- [ ] `npx tsc --noEmit` exits 0 with zero type errors.
- [ ] `docs/` and the existing git history are preserved (scaffold merged, not overwritten).
- [ ] `vitest.config.ts` sets `environment: 'node'`, `include: ['src/**/__tests__/**/*.test.ts']`, and resolves `@shared`/`@renderer` aliases.
- [ ] Tailwind 4 is active: a Tailwind utility class applied in a renderer component produces the expected computed style in `npm run dev`.
- [ ] The Cinematic Minimalist tokens from `docs/design/cinematic_minimalist/DESIGN.md` are wired into a Tailwind 4 `@theme {}` block in `src/renderer/src/assets/main.css`: the color set (`primary`, `tertiary`, `error`, `surface-container-*`, `outline`, …), the Inter type scale (`display-lg`…`label-sm`), and the `rounded`/`spacing` tokens are all available as Tailwind utilities (`bg-surface-container-low`, `text-label-md`, `rounded-xl`, `px-container-margin`, etc.).
- [ ] Base background resolves to `#0B0B0C` and elevated surfaces to `#161617` (not the lighter frontmatter values).
- [ ] Inter and Material Symbols Outlined are **bundled locally** (no Google Fonts / Tailwind CDN `<link>` or `<script>` remains) so they render with no network access.

## Verification Steps

> Execute after implementation; each must pass before committing.

1. **build** `npx tsc --noEmit` — Expected: exit 0, no type errors.
2. **test** `npx eslint . --max-warnings 0` — Expected: exit 0, zero warnings.
3. **test** `npx vitest run` — Expected: exit 0.
4. **build** `npm run build` — Expected: electron-vite build completes with no errors (main, preload, renderer bundles emitted).

## Post-merge validation

- [ ] Run `npm run dev` on macOS — Observable outcome: an Electron window opens showing the app shell with Tailwind styling applied, and closes cleanly.

## Integration

**Reachability:** The build tooling is the entry point for the whole app — `npm run dev` / `npm run build` drive `electron.vite.config.ts`, which loads `src/main/index.ts`, `src/preload/index.ts`, and `src/renderer/index.html`. All later REQs compile and test through this scaffold.

**Data dependencies:** None (no persisted data yet). Establishes `src/shared`, `src/main`, `src/renderer`, `src/preload` source trees the rest of the plan populates.

**Service dependencies:** electron-vite, Vite, Vue 3, Tailwind 4 (`@tailwindcss/vite`), Vitest, ESLint, TypeScript — all installed here as the project's build/test services.
