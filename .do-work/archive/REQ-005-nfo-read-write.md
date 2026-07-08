# REQ-005: NFO read/write & sidecar paths

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** commit:77dbec3 tests:passed
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** M
**Files:** src/main/library/nfo.ts, src/main/library/__tests__/nfo.test.ts
**Depends on:** REQ-002

## Task

Implement the Kodi-compatible NFO sidecar layer in `src/main/library/nfo.ts`: `sidecarPathsFor(filePath)` (nfo/poster/fanart paths by Kodi naming), `movieToNfoXml(movie)`, `parseNfoXml(xml): NfoData`, `writeSidecarNfo(movie)` (throws on fs error), and `readSidecarNfo(filePath): NfoData | null`. Follow TDD with a round-trip test (write → read yields the same fields, including `<playcount>`/`<lastplayed>`). Use `fast-xml-parser`.

## Context

From the plan (Task 4): NFO XML carries title, originalTitle, year, plot/overview, runtime, rating (`voteAverage`), genres, top-5 cast with order, `<mpaa>` certifications (all countries), `<trailer>` YouTube key, `<uniqueid type="tmdb">`, `<playcount>`, `<lastplayed>`. Sidecar naming (Kodi convention, next to the movie file): `<stem>.nfo`, `<stem>-poster.jpg`, `<stem>-fanart.jpg`. Watch state lives ONLY in the NFO tags. Per ideate (Explorer): the NFO schema is an external contract shared with Kodi/Jellyfin/TinyMediaManager — keep tag names/format standard so those tools can read our library and vice-versa.

## Acceptance Criteria

- [ ] `sidecarPathsFor('/M/The Matrix (1999)/The Matrix (1999).mkv')` returns nfo/poster/fanart paths using the `<stem>.nfo`, `<stem>-poster.jpg`, `<stem>-fanart.jpg` Kodi convention next to the file.
- [ ] `movieToNfoXml(movie)` emits standard Kodi tags including `<title>`, `<year>`, `<plot>`, `<runtime>`, `<rating>`, `<genre>` (one per genre), `<mpaa>`, `<uniqueid type="tmdb">`, `<playcount>`, and `<lastplayed>`.
- [ ] Round-trip: `parseNfoXml(movieToNfoXml(m))` returns an `NfoData` whose fields (including `playCount` and `lastPlayedAt`) equal the source movie's corresponding fields.
- [ ] `readSidecarNfo(filePath)` returns `null` when no `.nfo` exists next to the file.
- [ ] `writeSidecarNfo` throws on filesystem write error (so the caller can set `sidecarWriteFailed` and surface the warning badge, per REQ-010).
- [ ] The NFO test (`src/main/library/__tests__/nfo.test.ts`) passes under `npx vitest run`.

## Verification Steps

1. **test** `npx vitest run src/main/library/__tests__/nfo.test.ts` — Expected: round-trip and null-when-absent tests pass; playcount/lastplayed survive the round trip.
2. **build** `npx tsc --noEmit` — Expected: exit 0.
3. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.

## Integration

**Reachability:** `readSidecarNfo`/`sidecarPathsFor` are called by the scanner (REQ-007) during ingest; `writeSidecarNfo` is called by the fetch queue (REQ-008) after a successful match and by the player (REQ-009) when stamping watch state.

**Data dependencies:** Reads and writes `.nfo` sidecar files on disk next to each movie; consumes/produces `MovieRecord`/`CastMember` fields from `@shared/types` (REQ-002). The NFO is the entire persistence layer — no database.

**Service dependencies:** `fast-xml-parser` (installed in REQ-001) for XML build/parse; Node `fs` for read/write.
