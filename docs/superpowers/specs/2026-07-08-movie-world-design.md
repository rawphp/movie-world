# Movie World — Design Spec

**Date:** 2026-07-08
**Status:** Approved design (v2 — Electron pivot), pending implementation plan
**Supersedes:** v1 Laravel/MySQL localhost web app design (see git history)

## Overview

A personal desktop app (macOS-first) for browsing a local movie collection. The user points the app at folders containing movie files and gets a rich, filterable poster-grid library backed by metadata from themoviedb.org (TMDB). All metadata, artwork, and watch state persist as Kodi-compatible sidecar files next to the movies themselves — the movie folders ARE the database. Single user, no auth, no server, no SQL.

## Stack

- **Shell:** Electron (main process = Node/TypeScript)
- **UI:** Vue 3 + Tailwind CSS 4, bundled with Vite (electron-vite)
- **Persistence:** Kodi NFO sidecar files + artwork on disk; small JSON settings file (electron-store or equivalent) for folder list, TMDB API key, window state
- **No database.** Library is loaded into memory from NFO files at launch; filtering/sorting is in-memory in the renderer.
- **External API:** TMDB v3; API key entered once in-app, stored in settings

## Core decisions (from brainstorming)

| Decision          | Choice                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Platform          | Installable Electron desktop app (was: localhost Laravel web app)                                 |
| Users/auth        | Single user, no accounts, no auth                                                                 |
| Playback          | External player via `shell.openPath()`; app stamps watch state on Play                            |
| Folder selection  | Native OS folder dialog; multiple folders supported                                               |
| Sync              | Manual Rescan button + automatic scan on app launch                                               |
| Match correction  | Fix-match dialog: live TMDB candidate search (editable title/year) + raw TMDB ID input            |
| Metadata fetching | Async in main process with small concurrency limit (~4); UI fills in live via IPC events          |
| Age rating        | Australian certification displayed (G/PG/M/MA15+/R18+); all countries kept in memory/NFO `<mpaa>` |
| On-disk format    | Kodi-compatible NFO + poster/fanart artwork, Kodi naming convention                               |
| Watch state       | Stored in NFO standard tags: `<playcount>`, `<lastplayed>`                                        |

## Data layer

### Sidecar files (the entire persistence layer)

```
Movies/The Matrix (1999)/
  The Matrix (1999).mkv
  The Matrix (1999).nfo        ← Kodi XML: title, year, plot, runtime, rating,
                                  genres, cast (top 5), <mpaa>, <trailer> YouTube key,
                                  <uniqueid type="tmdb">, <playcount>, <lastplayed>
  The Matrix (1999)-poster.jpg
  The Matrix (1999)-fanart.jpg
```

- Library is directly readable by Kodi/Jellyfin/TinyMediaManager.
- A moved drive or fresh install rebuilds the full library with zero TMDB calls.
- NFO write failure (read-only volume): movie still appears in the session library from the in-memory record; persistent warning badge that metadata/watch state cannot be saved.

### In-memory model

At launch the main process scans all registered folders, parses every NFO, and sends the renderer a complete movie list. Each movie record: file path, size, TMDB fields (title, year, overview, runtime, vote average, genres, top-5 cast with order, certifications, trailer YouTube key, tmdb id), match status (`pending` | `matched` | `unmatched`), watch state (`playcount`, `lastplayed`), `fileMissing` flag. A few thousand NFOs parse in well under a second; in-memory filtering is instant at personal-collection scale.

### Settings file (JSON, app-data dir)

Registered folder paths, TMDB API key, window bounds. Nothing else.

## Core flows

### Scan / rescan (main process)

1. Walk each registered folder recursively for video extensions: `mkv, mp4, avi, mov, m4v, wmv, webm`.
2. File has a sidecar NFO → ingest it directly (status `matched`); no TMDB call.
3. No NFO → parse filename (strip release tags — `1080p`, `BluRay`, `x264`, etc. — extract title + year), emit a `pending` record to the UI immediately, enqueue a TMDB fetch (in-process async queue, concurrency ~4).
4. Rescan adds new files and flags vanished ones `fileMissing` — never deletes records mid-session, never touches user files on disk (only writes sidecars).
5. Triggered on app launch and by per-folder Rescan buttons. Progress and per-movie results stream to the renderer over IPC — no polling.

### TMDB metadata fetch

1. Search TMDB by parsed title + year.
2. Confident top match (title similarity + year within ±1) → fetch full details in one call (`append_to_response=credits,videos,release_dates`) → write NFO + download poster/fanart → emit `matched` record to UI.
3. No confident match → emit `unmatched`; card shows "needs match" badge.
4. Trailer: TMDB `videos` supplies official YouTube trailer keys (prefer official Trailer type) — no YouTube scraping.
5. Failures/rate limits retry with backoff (3 attempts), then surface on the card with a manual Retry action.

### Fix match

Dialog with live TMDB search (poster + title + year candidates, editable query) and a raw TMDB ID input as escape hatch. Selecting a candidate re-runs the detail fetch and rewrites the sidecars.

### Playback

Play button → main process verifies the file still exists → `shell.openPath(file)` opens the OS default player (VLC etc.) → increments `<playcount>`, sets `<lastplayed>` to now, rewrites the NFO, emits the updated record.

## Windows & UI

Single-window app, three views (Vue Router, hash mode):

- **Library** — responsive poster grid. Card: poster, title, year, AU age-rating badge, ★ rating (TMDB vote average out of 5), top-billed actor names, last watched (relative time / "never"). States: pending (placeholder + loading shimmer), unmatched ("needs match" badge), missing-file badge, unsaved-warning badge (NFO write failed).
- **Filter bar** — text search, genre, year, AU certification, minimum ★, actor, watched/unwatched; sort by title / year / rating / recently added / last watched. All in-memory, instant, combinable; filter state lives in a Pinia store and survives navigating to a detail page and back.
- **Movie detail** — backdrop header, poster, overview, runtime, genres, cast, certification, ★ rating, embedded YouTube trailer iframe (graceful "no trailer found" state; requires internet), Play button, watch history line, file info (path/size, reveal-in-Finder), Fix match button.
- **Settings** — registered folders (add via native dialog, remove = forget only, per-folder Rescan with progress), TMDB API key field with validation check.

**First-run experience:** no API key + no folders → guided empty state (enter key → add first folder → watch the grid fill in).

## Error handling

- TMDB down / rate-limited → per-movie retry with backoff; card-level Retry action; non-blocking toast.
- No/invalid TMDB API key → banner linking to Settings; scanning still indexes files (cards stay `pending`).
- Folder unreadable at add-time → native dialog result validated, error toast.
- File missing on disk → `fileMissing` badge; record retained for the session; disappears permanently only when rescan confirms and user removes it or the folder.
- NFO/artwork write failure → in-memory record still updated; warning badge on card.
- No internet → library fully browsable from sidecars; trailer iframe and fetches degrade gracefully.

## Process boundaries (Electron)

- **Main process:** filesystem walking, NFO read/write, artwork download, TMDB client, external-player launch, settings, native dialogs.
- **Renderer (Vue):** all UI, in-memory filtering/sorting.
- **IPC:** typed channel contract (e.g. `scan:progress`, `movie:updated`, `movie:play`, `tmdb:search`). Context isolation on; renderer has no direct Node/fs access — everything goes through the preload-exposed API.

## Testing

- **Vitest (node):** filename parser (table-driven: dotted names, year-less files, release tags), NFO write/read round-trip (including playcount/lastplayed), TMDB client + match-confidence logic against mocked HTTP, scan logic against a temp-dir fixture tree.
- **Vitest (components):** filter bar, movie card states (pending/unmatched/missing/matched/unsaved), fix-match dialog.
- **Gates:** 100% pass, ESLint zero warnings, `tsc --noEmit` clean.

## Packaging

electron-builder producing a macOS `.dmg`/`.app`. Unsigned for personal use initially (right-click → Open on first launch); signing/notarization deferred until wanted. Auto-update out of scope.

## Out of scope (v1)

- In-app video playback / transcoding
- TV shows, collections, multi-part movies
- Filesystem watchers / real-time sync (launch + manual rescan only)
- Multi-user, accounts, auth
- Code signing / notarization / auto-update
- Windows/Linux builds (Electron keeps the door open)
