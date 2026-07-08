export interface StartupWindow {
  show(): void
  isDestroyed(): boolean
  on(event: 'ready-to-show', listener: () => void): void
  webContents: {
    on(event: 'did-finish-load', listener: () => void): void
    on(
      event: 'did-fail-load',
      listener: (
        event: unknown,
        errorCode: number,
        errorDescription: string,
        validatedURL: string
      ) => void
    ): void
  }
}

export interface StartupLogger {
  info(message: string): void
  error(message: string): void
}

export function wireWindowStartupEvents(
  mainWindow: StartupWindow,
  logger: StartupLogger = console
): void {
  let shown = false

  const showOnce = (reason: string): void => {
    if (shown || mainWindow.isDestroyed()) return
    shown = true
    mainWindow.show()
    logger.info(`[startup] main window shown: ${reason}`)
  }

  logger.info('[startup] main window created')
  mainWindow.on('ready-to-show', () => showOnce('ready-to-show'))
  mainWindow.webContents.on('did-finish-load', () => showOnce('did-finish-load'))
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.error(
      `[startup] renderer load failed: ${errorCode} ${errorDescription} ${validatedURL}`
    )
  })
}
