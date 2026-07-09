---
ur: UR-008
received: 2026-07-10
status: captured
open_gaps:
  - The brief does not say whether movie video files themselves are offline-only, or only the .nfo/artwork sidecars are being evicted by Google Drive.
  - The app currently treats sidecars next to the movie file as the source of truth, so the fix needs a policy for copying or mirroring data into app-owned storage.
  - Startup must distinguish a missing/offline folder from an empty library so Google Drive placeholders do not wipe useful cached records.
  - Artwork serving must fail fast or use cached art when a Google Drive file is unavailable, instead of blocking the renderer while the file hydrates.
classification: bug-fix
layers_in_scope: []
layer_decisions: {}
reqs:
  - { id: REQ-031, layer: none, integration_confidence: n/a }
  - { id: REQ-032, layer: none, integration_confidence: n/a }
  - { id: REQ-033, layer: none, integration_confidence: n/a }
  - { id: REQ-034, layer: none, integration_confidence: n/a }
  - { id: REQ-035, layer: none, integration_confidence: n/a }
acknowledged_partials: []
---

# UR-008: User Request

<!-- capture-summary-start -->
## Capture summary (2026-07-10)

| Item | Value |
|---|---|
| Classification | bug-fix |
| Layers in scope | (none - bug-fix) |
| Layer decisions | (none - bug-fix) |
| REQs generated | 5 |

| REQ | Layer | Integration confidence |
|---|---|---|
| REQ-031 | none | n/a |
| REQ-032 | none | n/a |
| REQ-033 | none | n/a |
| REQ-034 | none | n/a |
| REQ-035 | none | n/a |
<!-- capture-summary-end -->

## Request

We have a problem with the current movie directory setup. All movie world assets, the.info and the artwork for each movie, are stored in the movie directory. The issue is that the movie directory is in Google Drive, which is offline, so it gets deleted after local Drive. When I launch movie world there is a long delay. The whole app freezes while all the assets get downloaded, which is a huge problem. It's unusable and also we've got the download issue. Come up with free solutions that would fix this issue, you 
