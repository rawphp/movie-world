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
