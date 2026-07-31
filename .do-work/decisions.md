2026-07-09 | UR-003 | dev startup hang captured as its own REQ inside UR-003, hard dep for the trailer fix | user opted to include it; broken dev blocks runtime diagnosis/verification
2026-07-09 | UR-004 | width + background changes merged into one REQ (REQ-021) | same view template, brief couples them via "well balanced" UX requirement
2026-07-09 | UR-004 | layer "shared" out of scope | user answered "No" at layer-coverage prompt
2026-07-09 | UR-004 | layer "main" out of scope | user answered "No" at layer-coverage prompt
2026-07-09 | UR-004 | layer "preload" out of scope | user answered "No" at layer-coverage prompt
2026-07-09 | UR-004 | layer "packaging" out of scope | user answered "No" at layer-coverage prompt
2026-07-09 | UR-005 | hero-band redesign kept as one REQ (REQ-022) incl. file-info collapse + trailer sizing | all same-file template changes in MovieDetailView.vue; splitting forces footprint serialization
2026-07-09 | UR-005 | supersedes REQ-021 full-page background treatment; keep its max-w-7xl width | full-page backdrop failed human validation — art zone and text zone must be separated
2026-07-09 | UR-005 | layer "shared" out of scope | user answered "No" at layer-coverage prompt
2026-07-09 | UR-005 | layer "main" out of scope | user answered "No" at layer-coverage prompt
2026-07-09 | UR-005 | layer "preload" out of scope | user answered "No" at layer-coverage prompt
2026-07-09 | UR-005 | layer "packaging" out of scope | user answered "No" at layer-coverage prompt
2026-07-09 | UR-006 | layer "packaging" out of scope | user answered "No" at layer-coverage prompt
2026-07-09 | UR-006 | combo format, defaults, matching + validation centralized in src/shared/keybindings.ts (REQ-024) | single source of truth for main persistence, detail-view matching and recorder UI
2026-07-09 | UR-006 | keybinding validation enforced main-side in setKeybindings (reject invalid/duplicate) | renderer bugs must not persist unusable bindings
2026-07-09 | UR-007 | error 153 captured as REQ-030, addressing REQ-020's unfixed candidate #1 (file:// origin / missing referer) — not a REQ-020 reject | REQ-020's CSP fix worked (blank box → rendered 153); the referer/origin cause is a distinct next-layer fix
2026-07-10 | UR-008 | Google Drive freeze fix decomposed around app-owned local cache plus cached-first background rescan | free solution that removes Drive hydration from launch-critical path
2026-07-10 | UR-009 | trailer Error 152-4 kept as one bug-fix REQ spanning diagnosis, preserved header tests, and renderer fallback | same user-visible failure path; splitting before diagnosis risks solving the wrong cause
2026-07-31 | UR-010 | diagnosis REQ (037) hard-deps art+scan fixes (038/039); cache completeness (040) depends on art path fix | post-paint freeze needs proven hot path; titles-without-posters also needs hydrate field fill
2026-07-31 | UR-011 | layer "preload" out of scope | user answered "No" at layer-coverage prompt (default on decline)
2026-07-31 | UR-011 | layer "packaging" out of scope | user answered "No" at layer-coverage prompt (default on decline)
2026-07-31 | UR-011 | keep cachedPosterPath field names; display contract only | grill clarification — avoid rename churn
2026-07-31 | UR-011 | backfill may mirror Drive at concurrency 2; cache write required, Drive best-effort | grill clarifications from UR-010 review rework
