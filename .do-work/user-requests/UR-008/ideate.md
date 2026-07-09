# Ideate - UR-008

**Reviewed:** 2026-07-10

## Explorer - Assumptions & Perspectives

- The brief assumes every slow asset is safe to read from the movie folder on launch; when Google Drive has evicted `.nfo`, poster, or fanart files, synchronous reads can trigger hydration and freeze the Electron app.
- The brief does not state whether the video files are also offline-only; if movie files are unavailable but cached metadata exists, the library should still open while marking playback unavailable.
- Google Drive is an external sync system with its own storage policy; relying on "available offline" alone would push the problem onto the user instead of making Movie World resilient.
- The app needs a distinction between "folder missing/offline" and "library empty"; otherwise a startup scan could replace a usable cached library with nothing.

## Challenger - Risks & Edge Cases

- A scan that walks an offline Google Drive tree can trigger many downloads before the UI paints, which recreates the freeze even if artwork loading is fixed.
- `readSidecarNfo()` and `serveArtFile()` currently use synchronous filesystem calls; against a cloud-backed path those calls can block the main process long enough to make the renderer feel hung.
- A cache can become stale when the user edits `.nfo` or artwork outside the app, so the fix needs background reconciliation rather than a one-time import.
- Cached artwork must not be treated as authoritative forever; if a better poster/fanart exists in the source folder when it is available, the app should refresh the app-owned copy.

## Connector - Links & Reuse

- `src/main/library/manager.ts` already centralizes `loadLibrary()`, scan progress, and movie updates, so cached-first startup can reuse the existing `movie:updated` and `scan:progress` event paths.
- `src/main/library/scanner.ts` already maps sidecar paths through `sidecarPathsFor()`, making it the right place to prefer cached metadata/art references when source sidecars are unavailable.
- `src/main/art-protocol.ts` already owns `mw-art://` reads, so it can enforce fast missing-file behavior and serve app-owned cached artwork without renderer changes to every image.
- `src/renderer/src/stores/library.ts` already gates first load with `loaded`, so a small status extension can show cached data immediately while background scan updates stream in.

## Summary

The lowest-cost fix is to keep the movie folder as a source, but stop making it the launch-time dependency. Movie World should maintain an app-owned local cache of metadata and artwork, return cached records immediately, and reconcile Google Drive folders in the background when they are available.
