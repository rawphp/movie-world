# REQ-037: Diagnose Startup Freeze Hot Path

<!-- claimed-start -->
**Claimed by:** Toms-MacBook-Pro.local.46237
**Claimed at:** 2026-07-31T00:53:13Z
**Heartbeat:** 2026-07-31T00:53:13Z
<!-- claimed-end -->

**UR:** UR-010
**Status:** in-progress
**Created:** 2026-07-31
**Layer:** none
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** M
**Files:** src/main/library/manager.ts, src/main/library/scanner.ts, src/main/art-protocol.ts, src/main/index.ts, src/main/library/__tests__/manager.test.ts, src/main/__tests__/art-protocol.test.ts
**Depends on:**

## Task

Prove which post-paint stage freezes Movie World on launch against a Google Drive library: instrument the startup and artwork paths, capture timings under a slow/blocking FS simulation, and document the root cause with concrete evidence (stage name + timing numbers or stack) in the REQ closure notes.

## Context

UR-008 shipped cached-first `loadLibrary` (REQ-033) and prefer-cached art (REQ-034), but the freeze returned. Clarifications: freeze happens **after** the library grid appears; titles show; posters are mostly missing (0–2); mouse shows loading cursor; Drive is online but files may be cloud-only; both packaged and dev. Ideate suspects residual main-process sync I/O (`discoverVideoFiles`/`existsSync`/`copyFileSync` in background scan, or `serveArtFile` reading Drive `posterPath` when `cachedPosterPath` is absent). Reuse existing modules — do not invent a second cache. Diagnosis must precede hardening so we fix the real hot path.

## Acceptance Criteria

- [ ] Startup and artwork stages emit measurable timings (or equivalent structured logs) for at least: `hydrateFromCache`, `loadLibrary` return, background `discoverVideoFiles` per folder, `ingestFile`/sidecar resolve, and `serveArtFile` (or a test double proving the same code path).
- [ ] A unit or integration test uses a deliberately slow FS stub (or long `existsSync`/`readFileSync`/`readdir` mock) and shows the UI-critical path still waits on that stage when the freeze scenario is reproduced in process — or explicitly records that a specific stage is the only blocking call under the simulated cloud-only condition.
- [ ] Closure notes name **one primary root cause** with evidence (log lines, test output, or call stack), not a list of unprioritized guesses.
- [ ] Closure notes state whether the freeze is primarily (a) mw-art sync reads of Drive paths, (b) background scan FS on main process, (c) both, or (d) another named stage.

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/main/library/__tests__/manager.test.ts src/main/__tests__/art-protocol.test.ts`
   - Expected: new/updated tests pass and encode the slow-FS reproduction or stage timing assertions that pin the freeze.
2. **build** `npm run typecheck`
   - Expected: instrumentation and any production-safe logging compile cleanly.

## Manual checks (advisory)

- [ ] Launch Movie World with the real Google Drive movie folder (cloud-only posters) once after instrumentation — Observable outcome: logs show which stage(s) spend multi-second wall time after the grid paints, matching the closure root-cause claim.

## Assets

- (none)
