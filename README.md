# Movie World

Movie World is a desktop app (Electron + Vue + TypeScript) for macOS and Linux
that turns your local movie folders into a browsable, poster-driven library.
Point it at the folders where your movie files live and it scans them, matches
each file against [The Movie Database (TMDB)](https://www.themoviedb.org/), and
enriches every title with a poster, backdrop, rating, cast, genres and trailer.

All metadata is written back to disk as plain-text `.nfo` sidecars alongside
your movie files, so the library reloads instantly on the next launch (no
network needed) and stays compatible with other NFO-aware media tools.

## Features

- Folder scanning with filename parsing (title + year) for common release names.
- TMDB matching with a manual **Fix match** flow (search or paste a TMDB id).
- Poster / fanart artwork and a rich detail view with an embedded trailer.
- **Play** launches the file in your default external player and stamps watch
  state (last-watched date and play count) back into the sidecar.
- Filter and sort the grid by genre, year, rating, actor and watched state.
- Fully offline after the first match — everything is cached on disk.

## Requirements

- macOS or Linux
- [Node.js](https://nodejs.org/) 18+ and npm (for building from source)
- A free TMDB API key — create one at
  <https://www.themoviedb.org/settings/api> and enter it in the app's Settings
  screen on first run.

## Development

Install dependencies and start the app in dev mode with hot reload:

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck   # tsc / vue-tsc, no emit
npm run lint        # eslint
npm run test        # vitest (unit + component suite)
npm run build       # typecheck + compile main/preload/renderer bundles
```

## Building a packaged app

The packaging config lives in `electron-builder.yml` (product name
**Movie World**, appId `com.tomkaczocha.movieworld`). Builds are **unsigned**
and intended for personal use.

### macOS

Produces a `.dmg` plus an unpacked `.app` under `dist/`:

```bash
npm run build:mac
```

This runs the electron-vite build and then `electron-builder --mac`. There is
no Apple code signing or notarization.

#### First launch (unsigned app + Gatekeeper)

Because the app is unsigned, macOS Gatekeeper will block a normal double-click
the first time. To open it:

1. In Finder, right-click (or Control-click) **Movie World.app**.
2. Choose **Open**.
3. Confirm **Open** in the dialog that appears.

macOS remembers this choice, so subsequent launches work with a normal
double-click.

### Linux

Produces an AppImage plus an unpacked directory under `dist/`:

```bash
npm run build:linux
```

This runs the electron-vite build and then `electron-builder --linux`. Artifacts
land under `dist/`:

- AppImage: `dist/Movie World-<version>-<arch>.AppImage`
- Unpacked: `dist/linux-unpacked/movie-world` (x64) or
  `dist/linux-arm64-unpacked/movie-world` (ARM)

#### First launch (AppImage)

```bash
chmod +x "dist/Movie World-"*.AppImage
./dist/Movie\ World-*.AppImage
```

If the AppImage fails to mount, install FUSE 2. On Arch/Omarchy:

```bash
sudo pacman -S fuse2
```

You can also run the unpacked binary directly:

```bash
./dist/linux-arm64-unpacked/movie-world
# or, on x64:
./dist/linux-unpacked/movie-world
```

If Chromium refuses to start because of the sandbox, that is a host-policy
issue (user namespaces), not a missing package in this repo.

## Where your data lives

- **Movie metadata (NFO sidecars & artwork):** written next to each movie file.
  For `Movie.mkv` you get `Movie.nfo`, `Movie-poster.jpg` and
  `Movie-fanart.jpg` in the same folder. These are the source of truth and let
  the library reload without contacting TMDB again.
- **App settings (library folders + TMDB API key):** stored in the app's user
  data directory as `settings.json`.
  - macOS packaged: `~/Library/Application Support/Movie World/settings.json`
    (`~/Library/Application Support/movie-world/settings.json` in `npm run dev`)
  - Linux packaged: `~/.config/Movie World/settings.json`
    (`~/.config/movie-world/settings.json` in `npm run dev`)

## Scope

Signing, notarization and auto-update are intentionally out of scope; this is a
personal, unsigned build.
