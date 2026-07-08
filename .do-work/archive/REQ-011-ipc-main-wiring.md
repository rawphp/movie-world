# REQ-011: IPC handlers, main wiring, art protocol & CSP

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** commit:6ed6ce1 tests:passed
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** L
**Files:** src/main/ipc.ts, src/main/index.ts
**Depends on:** REQ-010

## Task

Implement `src/main/ipc.ts` (thin `ipcMain.handle` registrations delegating to the library manager) and rewrite `src/main/index.ts` to wire the settings store, manager, TMDB client factory, native folder dialog, and IPC together, forwarding manager `emit` to `webContents.send`. Register a custom `mw-art://` protocol that serves on-disk poster/fanart to the sandboxed renderer, and set a renderer Content-Security-Policy that permits `mw-art://` images and the YouTube trailer iframe.

## Context

From the plan (Task 10): the main process owns filesystem/network work and native dialogs; IPC channels include `scan:progress`, `movie:updated`, and request/response handlers backing every `window.api` method (getSettings, setApiKey, addFolder [native dialog], removeFolder, loadLibrary, rescanFolder, play, retryFetch, fixMatch, searchTmdb, revealFile). Context isolation is on. **Folded from ideate + UR-001 clarification (gaps → existing REQs):** Task 12 consumes an `mw-art://` protocol that Task 10's interface list never specified — register it here (map `mw-art://<encoded-abs-path>` to the on-disk image file). The renderer CSP must allow `mw-art:` image sources and `https://www.youtube.com` frame sources, or posters and the trailer iframe silently fail.

## Acceptance Criteria

- [ ] `src/main/ipc.ts` registers one `ipcMain.handle` per `window.api` request method (getSettings, setApiKey, addFolder, removeFolder, loadLibrary, rescanFolder, play, retryFetch, fixMatch, searchTmdb, revealFile), each delegating to the manager/settings/client with no business logic in the handler.
- [ ] `addFolder` opens the native OS folder dialog (`dialog.showOpenDialog`, `openDirectory`) and returns the updated `Settings`, or `null` when cancelled.
- [ ] `revealFile(id)` reveals the movie file in Finder (`shell.showItemInFolder`).
- [ ] The manager's `emit` is wired so `movie:updated` and `scan:progress` are delivered to the renderer via `webContents.send` on the correct channels.
- [ ] A `mw-art://` protocol is registered in the main process and resolves `mw-art://<path>` to the corresponding on-disk poster/fanart file (returns the image bytes; 404-equivalent when absent).
- [ ] The renderer response CSP includes `img-src` permitting `mw-art:` and `frame-src`/`child-src` permitting `https://www.youtube.com`, so artwork and the trailer iframe load at runtime.
- [ ] `npx tsc --noEmit` and `npx eslint . --max-warnings 0` pass with the new/rewritten files.

## Verification Steps

1. **build** `npx tsc --noEmit` — Expected: exit 0; `ipc.ts` and rewritten `index.ts` type-check against the manager and `window.api` contract.
2. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.
3. **build** `npm run build` — Expected: main + preload + renderer bundles build with the protocol registration and CSP in place; no build errors.

## Post-merge validation

- [ ] Launch `npm run dev` with a real library folder + TMDB key — Observable outcome: poster/fanart images render in the grid (served via `mw-art://`), and opening a matched movie's detail view shows the embedded YouTube trailer iframe (no CSP-blocked errors in the devtools console).
- [ ] Click "Add folder" — Observable outcome: the native macOS folder picker opens; choosing a folder adds it and cancelling returns without change.

## Integration

**Reachability:** `src/main/index.ts` is the Electron main entry (loaded by electron-vite from REQ-001). IPC handlers are the server side of every `window.api` call the renderer makes (REQ-012 exposes them). The `mw-art://` protocol is reached by `<img src="mw-art://…">` produced by `artSrc` in the renderer (REQ-014).

**Data dependencies:** Delegates to the library manager's in-memory model (REQ-010) and the settings store (REQ-003). The `mw-art://` handler reads poster/fanart files from disk (paths produced by the scanner/fetcher, REQ-007/008).

**Service dependencies:** Electron `ipcMain`, `dialog`, `shell`, `protocol`, `session`/`webRequest` (for CSP headers), `BrowserWindow`. Library manager (REQ-010), settings store (REQ-003), TMDB client factory (REQ-006).
