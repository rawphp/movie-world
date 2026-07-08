# Movie World — Design Spec

**Date:** 2026-07-08
**Status:** Approved design, pending implementation plan

## Overview

A localhost web app for browsing a personal movie collection. Users register an account, point the app at folders on the local machine containing movie files, and get a rich, filterable library backed by metadata from themoviedb.org (TMDB). Metadata and artwork are persisted as Kodi-compatible sidecar files next to the movies themselves, making the library portable and self-contained; MySQL serves as a fast, rebuildable query index plus per-user state.

## Stack

- **Backend:** Laravel 12 (PHP), MySQL, database-driver queue (no Redis)
- **Frontend:** Inertia.js 2 + Vue 3 + Tailwind CSS 4
- **Auth:** Laravel Breeze (Vue/Inertia preset) — registration + login
- **External API:** TMDB v3, single API key in `.env` (`TMDB_API_KEY`)
- **Dev runtime:** one command boots HTTP server, Vite, and queue worker

## Core decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Playback | External player: Play button launches file via OS default (`open` on macOS); app stamps last-watched on click |
| Accounts | Multi-user, separate libraries — each user has own folders, movies, watch history |
| Folder selection | Server-side folder browser modal (Laravel endpoint lists directories; user drills down) |
| Folders per user | Multiple; manual Rescan button + auto-scan on library load |
| Match correction | Fix-match dialog: live TMDB candidate search (editable title/year) + raw TMDB ID input |
| Metadata fetching | Background queue jobs; library renders immediately, cards fill in via polling (~3s) while any movie is pending |
| Age rating | Australian certification displayed (G/PG/M/MA15+/R18+); all countries stored |
| Architecture | Inertia monolith (approach A — fewest moving parts) |
| On-disk persistence | Kodi-compatible NFO + artwork sidecar files next to each movie file |

## Data model

All library data is scoped per user. TMDB metadata is deliberately **not** shared between users in the DB (duplication is fine at localhost scale; scoping stays simple). Sidecar files on disk ARE shared if two users add the same folder — universal metadata on disk, per-user state in DB.

- `users` — standard Breeze
- `library_folders` — `user_id`, `path`; unique `(user_id, path)`
- `movies` — one row per video file:
  - Identity: `user_id`, `library_folder_id`, `file_path`, `file_size`
  - Parsed: `parsed_title`, `parsed_year`
  - TMDB: `tmdb_id`, `title`, `original_title`, `year`, `overview`, `runtime`, `vote_average`, `poster_path`, `backdrop_path`, `certifications` (JSON, all countries), `certification_au` (denormalized for filtering), `trailer_youtube_key`
  - State: `match_status` (`pending` | `matched` | `unmatched`), `file_missing_at`, `last_watched_at`, `times_watched`, `fetched_at`
- `genres` + `genre_movie` — pivot for clean genre filtering
- `actors` + `actor_movie` — top 5 billed cast, with billing order

## Sidecar files (source of truth on disk)

On successful match, the fetch job writes next to the movie file, Kodi naming convention:

```
Movies/The Matrix (1999)/
  The Matrix (1999).mkv
  The Matrix (1999).nfo        ← Kodi XML: title, year, plot, runtime, rating,
                                  genres, cast, <mpaa> certification,
                                  <trailer> YouTube key, <uniqueid type="tmdb">
  The Matrix (1999)-poster.jpg
  The Matrix (1999)-fanart.jpg
```

- Rescan reads existing NFO + artwork **first**; TMDB is called only for movies with no sidecar. A wiped DB or moved drive rebuilds with zero API calls.
- Library is directly readable by Kodi/Jellyfin/TinyMediaManager.
- Per-user state (watch history, match status) lives only in MySQL — never in sidecars.
- NFO write failure (e.g. read-only volume): metadata still saved to DB; warning logged and surfaced on the movie card.

## Core flows

### Scan / rescan
1. User adds a folder via the folder-browser modal (validated readable at add-time).
2. Scan walks it recursively for video extensions: `mkv, mp4, avi, mov, m4v, wmv, webm`.
3. For each new file: if a sidecar NFO exists, ingest it directly (status `matched`); otherwise parse the filename (strip release tags — `1080p`, `BluRay`, `x264`, etc. — extract title + year), create a `pending` movie row, dispatch `FetchTmdbMetadata` job.
4. Rescan adds new files and stamps `file_missing_at` on vanished ones — never deletes rows silently, never touches files on disk.
5. Triggered by per-folder Rescan button and automatically on library load. The scan itself runs as a queued job so page loads never block on directory walks; per-folder progress is reported via the same polling endpoint.

### TMDB metadata fetch (queued job)
1. Search TMDB by parsed title + year.
2. Confident top match (title similarity + year within ±1) → fetch full details in one call (`append_to_response=credits,videos,release_dates`), store metadata + genres + top-5 cast + certifications + trailer key, write sidecar files, mark `matched`.
3. No confident match → mark `unmatched`; card shows "needs match" badge.
4. Trailer: TMDB `videos` response supplies official YouTube trailer keys (prefer official Trailer type) — no YouTube scraping.
5. Retries with backoff (3 attempts) on API failure/rate limit.

### Fix match
Dialog with live TMDB search (poster + title + year candidates, editable query) **and** a raw TMDB ID input as escape hatch. Selecting a candidate re-runs the detail fetch + sidecar write against that ID.

### Playback
`POST /movies/{id}/play` → server validates ownership and that the resolved real path is inside one of that user's registered folders → launches file with the OS default player → stamps `last_watched_at`, increments `times_watched`.

## Pages & UI

All behind auth.

- **Library (`/movies`)** — responsive poster grid. Card: poster, title, year, AU age-rating badge, ★ rating (TMDB vote average out of 5), top-billed actor names, last watched (relative time / "never"). States: pending (placeholder + loading), unmatched ("needs match" badge), missing file badge.
- **Filter bar** — text search, genre, year, AU certification, minimum ★, actor, watched/unwatched; sort by title / year / rating / recently added / last watched. Filters combine, persist in URL query string, execute server-side via Inertia partial reloads.
- **Movie detail (`/movies/{id}`)** — backdrop header, poster, overview, runtime, genres, cast, certification, ★ rating, embedded YouTube trailer iframe (graceful "no trailer found" state), Play button, watch history, file info (path/size), Fix match button.
- **Folders (`/folders`)** — user's folders list, folder-browser modal to add, remove (index-only removal — disk untouched), per-folder Rescan with progress.
- **Live updates** — while any movie is `pending`, library polls a lightweight endpoint (~3s) and patches cards in place. No websockets.

## Error handling

- TMDB down / rate-limited → job retries (3, backoff); movie stays `pending`; library banner "metadata fetch delayed".
- `TMDB_API_KEY` missing → persistent banner with setup instructions; scanning still indexes files.
- Unreadable folder path → validation error at add-time.
- File missing on disk → badge on card; row retained.
- NFO write failure → DB still updated; warning surfaced.

## Security

Two endpoints touch the filesystem from web input — both get strict validation even on localhost:
- **Folder browser**: directory listing endpoint constrained with realpath resolution; no file contents exposed.
- **Play endpoint**: resolved path must sit inside one of the requesting user's registered folders (path-traversal safe).
- All movie/folder queries scoped by `user_id`; user A can never see or play user B's library.

## Testing

- **Pest (feature/unit):** auth scoping invariant (cross-user isolation), scan/rescan behavior, filename parser (table-driven: dotted names, year-less files, release tags), `FetchTmdbMetadata` with `Http::fake`, NFO write/read round-trip, path-traversal protection on play + folder browser.
- **Vitest:** filter bar, movie card states (pending/unmatched/missing/matched), fix-match dialog.
- **Gates:** 100% pass, Pint + ESLint zero warnings, `tsc --noEmit` clean.

## Out of scope (v1)

- In-browser video playback / transcoding
- TV shows, collections, multi-part movies
- Filesystem watchers / real-time sync (manual + on-load rescan only)
- Sharing libraries between users
- Writing watch state into NFO files
