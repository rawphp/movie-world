import { app, shell, BrowserWindow, session, protocol } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createSettingsStore } from './settings'
import { createLibraryManager } from './library/manager'
import { createTmdbClient } from './tmdb/client'
import { registerIpc, emitToAll } from './ipc'
import {
  MW_ART_SCHEME,
  serveArtFile,
  buildCsp,
  shouldApplyRendererCsp,
  withYoutubeRefererHeaders
} from './art-protocol'
import { wireWindowStartupEvents } from './window-lifecycle'

// Must run before app is ready so the renderer treats mw-art:// as a real scheme.
protocol.registerSchemesAsPrivileged([
  {
    scheme: MW_ART_SCHEME,
    privileges: { standard: false, stream: true, supportFetchAPI: true }
  }
])

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  wireWindowStartupEvents(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite cli. Load the remote URL for
  // development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    console.info(`[startup] loading dev renderer: ${rendererUrl}`)
    mainWindow.loadURL(rendererUrl)
  } else {
    const rendererFile = join(__dirname, '../renderer/index.html')
    console.info(`[startup] loading packaged renderer: ${rendererFile}`)
    mainWindow.loadFile(rendererFile)
  }
}

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Serve on-disk poster/fanart to the sandboxed renderer.
  // Renderer requests `mw-art://<encodeURIComponent(absPath)>`; serveArtFile
  // reads the bytes directly and returns them with a correct image
  // Content-Type, or a 404 Response when the file is absent (REQ-018).
  protocol.handle(MW_ART_SCHEME, (req) => serveArtFile(req.url))

  // YouTube rejects packaged file:// renderer embeds with Error 153 unless the
  // embed request carries a web origin. Keep the injected identity scoped to
  // YouTube hosts only.
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: withYoutubeRefererHeaders(details.url, details.requestHeaders)
    })
  })

  // Content-Security-Policy for the renderer: permit mw-art: artwork images and
  // the https://www.youtube.com trailer iframe. Keep this scoped to renderer
  // responses so Electron does not inject the app CSP into remote iframes.
  const csp = buildCsp(is.dev)
  const rendererUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!shouldApplyRendererCsp(details.url, is.dev, rendererUrl)) {
      callback({ responseHeaders: details.responseHeaders })
      return
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  // Wire settings store, library manager and IPC surface together. Manager
  // events are forwarded to every renderer on their channels.
  const settings = createSettingsStore(join(app.getPath('userData'), 'settings.json'))
  const manager = createLibraryManager({
    settings,
    makeClient: (key) => createTmdbClient(key),
    emit: (channel, payload) => emitToAll(channel, payload)
  })
  registerIpc(settings, manager)

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
