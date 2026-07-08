# REQ-017: End-to-end verification & packaging

**UR:** UR-001
**Status:** backlog
**Created:** 2026-07-08
**Layer:** packaging
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 1
**Size:** M
**Files:** package.json, electron-builder.yml, README.md
**Depends on:** REQ-014, REQ-015, REQ-016

## Task

Close out the app: run the full-suite gate (tsc + eslint + vitest all green), package the macOS app with electron-builder into a `.dmg`/`.app` (unsigned for personal use), and write `README.md` (what it is, how to run in dev, how to build, how to open the unsigned app on first launch, where sidecars live). The real-data manual walkthrough is a post-merge human validation.

## Context

From the plan (Task 15): the full-suite gate is `npx tsc --noEmit`, `npx eslint . --max-warnings 0`, `npx vitest run` (100% pass). Packaging uses electron-builder (template provides config) producing a macOS `.dmg`/`.app`, unsigned initially (right-click → Open on first launch); signing/notarization and auto-update are out of scope. A manual end-to-end walkthrough against the real app + real movie files + a real TMDB key is the human acceptance gate.

## Acceptance Criteria

- [ ] The full-suite gate passes: `npx tsc --noEmit` (0 errors), `npx eslint . --max-warnings 0` (0 warnings), `npx vitest run` (100% pass).
- [ ] `npm run build` produces main/preload/renderer bundles with no errors.
- [ ] An electron-builder packaging script exists in `package.json` (e.g. `build:mac`) and `electron-builder.yml` targets macOS `.dmg`/`.app` (unsigned, no notarization).
- [ ] `README.md` documents: what the app is, dev run (`npm run dev`), build/package steps, first-launch instructions for the unsigned app, and where NFO/artwork sidecars are stored.

## Verification Steps

1. **build** `npx tsc --noEmit` — Expected: exit 0.
2. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.
3. **test** `npx vitest run` — Expected: exit 0, 100% pass across the whole suite.
4. **build** `npm run build` — Expected: all three bundles build with no errors.

## Post-merge validation

- [ ] Run the electron-builder mac target (`npm run build:mac` or equivalent) on macOS — Observable outcome: a `.dmg`/`.app` is produced under `dist/`.
- [ ] Install the packaged app and open it (right-click → Open on first launch, unsigned) — Observable outcome: the app launches from the packaged build.
- [ ] Real-data end-to-end walkthrough: add a real movie folder + valid TMDB key — Observable outcome: files scan, cards fill from `pending` to matched with posters, filtering works, Play launches the external player and stamps watch state, and Fix-match corrects a wrong/unmatched movie.
- [ ] Visual conformance: the Library, Detail, and Settings screens match the Cinematic Minimalist mockups in `docs/design/` (dark near-black surfaces, Inter type, pill filter bar, coloured state badges, bundled fonts render with the network offline).

## Integration

**Reachability:** The packaged `.app` is the end-user entry point; `README.md` is the human's entry to running/building. The packaging scripts wrap the app built in REQ-001's toolchain.

**Data dependencies:** Depends on the complete feature set (REQ-014–016 views over the REQ-003–012 main stack). No new data model.

**Service dependencies:** electron-builder (dev dep from the template/REQ-001), the full app. No signing/notarization services (out of scope).
