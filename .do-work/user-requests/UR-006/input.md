---
ur: UR-006
received: 2026-07-09
status: captured
classification: feature
layers_in_scope: [shared, main, preload, renderer, packaging]
layer_decisions: { packaging: no }
reqs:
  - { id: REQ-023, layer: none, integration_confidence: n/a }
  - { id: REQ-024, layer: shared, integration_confidence: high }
  - { id: REQ-025, layer: renderer, integration_confidence: high }
  - { id: REQ-026, layer: none, integration_confidence: n/a }
  - { id: REQ-027, layer: main, integration_confidence: high }
  - { id: REQ-028, layer: preload, integration_confidence: high }
  - { id: REQ-029, layer: renderer, integration_confidence: high }
acknowledged_partials: []
---

<!-- capture-summary-start -->

## Capture summary (2026-07-09)

| Item            | Value                                      |
| --------------- | ------------------------------------------ |
| Classification  | feature                                    |
| Layers in scope | shared, main, preload, renderer, packaging |
| Layer decisions | packaging: no                              |
| REQs generated  | 7                                          |

| REQ     | Layer            | Integration confidence |
| ------- | ---------------- | ---------------------- |
| REQ-023 | none (path-unit) | n/a                    |
| REQ-024 | shared           | high                   |
| REQ-025 | renderer         | high                   |
| REQ-026 | none (path-unit) | n/a                    |
| REQ-027 | main             | high                   |
| REQ-028 | preload          | high                   |
| REQ-029 | renderer         | high                   |

<!-- capture-summary-end -->

# UR-006: User Request

## Request

when I'm in a movie detail view, if I press a keyboard combination, it should navigate to the previous or next movie in the library (filtered or not), keyboard combination should be editable in settings

## Clarifications

**Q:** The brief says navigate to the previous/next movie "in the library (filtered or not)" — which order should prev/next follow when a filter is active?
**A:** Displayed list — follow the list as currently shown, with active filters AND current sort applied (the same order as the library grid).

**Q:** "A keyboard combination" is really two actions (previous and next) — what should the default bindings be before anyone edits them in settings?
**A:** Cmd/Ctrl+← for previous and Cmd/Ctrl+→ for next (Cmd on macOS, Ctrl elsewhere).

**Q:** At the edges of the list — pressing "previous" on the first movie or "next" on the last — what should happen?
**A:** Wrap around — previous on the first movie jumps to the last; next on the last jumps to the first.

**Q:** "Keyboard combination should be editable in settings" — how should editing work in the Settings view?
**A:** Key-capture recorder — click the binding, press the desired combo, it's recorded. Validated against duplicates/unusable keys, with a reset-to-default button.
