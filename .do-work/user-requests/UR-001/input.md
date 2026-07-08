---
ur: UR-001
received: 2026-07-08
status: intake
---

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
