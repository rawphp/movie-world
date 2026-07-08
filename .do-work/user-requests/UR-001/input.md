---
ur: UR-001
received: 2026-07-08
status: captured
classification: feature
layers_in_scope: [shared, main, preload, renderer, packaging]
layer_decisions: {}
reqs:
  - { id: REQ-001, layer: packaging, integration_confidence: high }
  - { id: REQ-002, layer: shared, integration_confidence: high }
  - { id: REQ-003, layer: main, integration_confidence: high }
  - { id: REQ-004, layer: main, integration_confidence: high }
  - { id: REQ-005, layer: main, integration_confidence: high }
  - { id: REQ-006, layer: main, integration_confidence: high }
  - { id: REQ-007, layer: main, integration_confidence: high }
  - { id: REQ-008, layer: main, integration_confidence: high }
  - { id: REQ-009, layer: main, integration_confidence: high }
  - { id: REQ-010, layer: main, integration_confidence: high }
  - { id: REQ-011, layer: main, integration_confidence: high }
  - { id: REQ-012, layer: preload, integration_confidence: high }
  - { id: REQ-013, layer: renderer, integration_confidence: high }
  - { id: REQ-014, layer: renderer, integration_confidence: high }
  - { id: REQ-015, layer: renderer, integration_confidence: high }
  - { id: REQ-016, layer: renderer, integration_confidence: high }
  - { id: REQ-017, layer: packaging, integration_confidence: high }
acknowledged_partials: []
---

<!-- capture-summary-start -->
## Capture summary (2026-07-08)

| Item | Value |
|---|---|
| Classification | feature |
| Layers in scope | shared, main, preload, renderer, packaging |
| Layer decisions | (none — all covered) |
| REQs generated | 17 |

| REQ | Layer | Integration confidence |
|---|---|---|
| REQ-001 | packaging | high |
| REQ-002 | shared | high |
| REQ-003 | main | high |
| REQ-004 | main | high |
| REQ-005 | main | high |
| REQ-006 | main | high |
| REQ-007 | main | high |
| REQ-008 | main | high |
| REQ-009 | main | high |
| REQ-010 | main | high |
| REQ-011 | main | high |
| REQ-012 | preload | high |
| REQ-013 | renderer | high |
| REQ-014 | renderer | high |
| REQ-015 | renderer | high |
| REQ-016 | renderer | high |
| REQ-017 | packaging | high |

> Decomposition maps the plan's 15 build tasks 1:1, with two layer-boundary splits: Task 2 → REQ-002 (shared types) + REQ-003 (settings/main); Task 10 → REQ-011 (IPC+main wiring) + REQ-012 (preload). Ideate gaps were folded into existing REQs per the UR-001 clarification: mw-art:// protocol + renderer CSP → REQ-011; partial-write resilience → REQ-007/008/010; AU-cert US→GB→any fallback → REQ-006; folder-name filename fallback → REQ-004/007. Integration confidence is "high" against the plan/design contracts (this is a greenfield build, so cited files are created by their own or sibling REQs — the plan is the authoritative source for every reachability/data/service answer).
<!-- capture-summary-end -->

# UR-001: User Request

## Request

start docs/superpowers/plans/2026-07-08-movie-world.md docs/superpowers/specs/2026-07-08-movie-world-design.md

Implement Movie World per the approved implementation plan and design spec referenced above:

- Plan: `docs/superpowers/plans/2026-07-08-movie-world.md` (15 TDD-structured build tasks)
- Design spec: `docs/superpowers/specs/2026-07-08-movie-world-design.md` (v2 — Electron pivot)

Goal: an installable Electron desktop app (macOS-first) that turns folders of movie files
into a filterable, TMDB-enriched poster library, persisting everything as Kodi-compatible
NFO sidecar files. No database, no server, no auth. Electron main process owns all
filesystem/network work and streams MovieRecord updates to a Vue 3 renderer over typed IPC.

## Clarifications

**Q:** The card shows an "AU age-rating badge", but TMDB's release_dates often has no Australian entry. When AU certification is missing, what should the badge show?
**A:** Fall back to the closest available rating — US, then GB, then the first available country — so a rating almost always appears. (All countries are still stored in the NFO `<mpaa>`/certifications; only the displayed badge falls back.)

**Q:** The plan's filename parser handles dotted names, year-less files, and release tags. When the filename alone is unhelpful (e.g. `movie.mkv` inside `The Matrix (1999)/`), should it fall back to the containing folder name?
**A:** Yes — when the filename yields no usable title/year, parse the parent folder name instead (helps folder-per-movie libraries).

**Q:** Ideate found gaps not explicitly owned by any plan task (mw-art:// protocol registration, renderer CSP for the trailer iframe + art protocol, partial-write resilience). How should capture handle them?
**A:** Fold them into existing REQs as explicit acceptance criteria on the relevant REQs, keeping the REQ count close to the plan's 15 tasks (no separate cross-cutting REQs).
