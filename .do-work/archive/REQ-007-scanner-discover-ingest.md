# REQ-007: Scanner — discover & ingest

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** commit:8d5c65c tests:passed
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/main/library/scanner.ts, src/main/library/__tests__/scanner.test.ts
**Depends on:** REQ-004, REQ-005

## Task

Implement `src/main/library/scanner.ts`: `VIDEO_EXTENSIONS` (the exact set), `movieId(filePath)` (sha1 hex), `discoverVideoFiles(root)` (recursive, sorted), and `ingestFile(filePath, folderPath)` — NFO present → `matched` record with sidecar data + on-disk poster/fanart paths; NFO absent → `pending` record from the parsed filename (with folder-name fallback). TDD against a temp-dir fixture tree.

## Context

From the plan (Task 6): video extensions are exactly `.mkv .mp4 .avi .mov .m4v .wmv .webm`. `ingestFile` reads the sidecar via `readSidecarNfo`/`sidecarPathsFor` (REQ-005); when absent it calls `parseFilename` (REQ-004). Per UR-001 clarification, when the filename is unhelpful `ingestFile` applies the folder-name fallback before emitting a `pending` record. Per ideate (Challenger): a present-but-incomplete sidecar set (NFO exists but poster file missing/corrupt) must not be reported as a clean `matched` with a broken poster — set `posterPath`/`fanartPath` only when the image files actually exist on disk.

## Acceptance Criteria

- [ ] `VIDEO_EXTENSIONS` contains exactly `.mkv .mp4 .avi .mov .m4v .wmv .webm` and nothing else.
- [ ] `discoverVideoFiles(root)` returns every video file under `root` recursively, sorted, excluding non-video files.
- [ ] `movieId(filePath)` returns the sha1 hex of the path (stable for the same path).
- [ ] `ingestFile` on a file WITH a sidecar NFO returns a `matched` record populated from the NFO, with `posterPath`/`fanartPath` set only when those image files exist on disk (missing image → null path, record still `matched`).
- [ ] `ingestFile` on a file WITHOUT a sidecar returns a `pending` record whose `parsedTitle`/`parsedYear` come from the filename, or from the parent folder name when the filename is unhelpful.
- [ ] The scanner test against a temp fixture tree passes under `npx vitest run`.

## Verification Steps

1. **test** `npx vitest run src/main/library/__tests__/scanner.test.ts` — Expected: discovery (recursive/sorted/extension-filtered), matched-from-NFO ingest, pending-from-filename ingest, and folder-name fallback all pass against the fixture tree.
2. **build** `npx tsc --noEmit` — Expected: exit 0.
3. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.

## Integration

**Reachability:** `discoverVideoFiles`/`ingestFile`/`movieId` are called by the library manager (REQ-010) during `loadLibrary` and `rescanFolder`.

**Data dependencies:** Walks the registered library folders on disk; reads NFO/artwork sidecars (REQ-005). Produces `MovieRecord`s (`@shared/types`, REQ-002).

**Service dependencies:** `parseFilename` (REQ-004), `readSidecarNfo`/`sidecarPathsFor` (REQ-005), Node `fs`/`crypto` (sha1).
