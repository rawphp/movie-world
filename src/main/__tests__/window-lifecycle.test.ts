import { describe, expect, it, vi } from 'vitest'
import { wireWindowStartupEvents } from '../window-lifecycle'
import type { StartupWindow } from '../window-lifecycle'

type Handler = (...args: unknown[]) => void

function createWindowStub() {
  const windowHandlers = new Map<string, Handler>()
  const webHandlers = new Map<string, Handler>()
  const show = vi.fn()
  const on: StartupWindow['on'] = (event, handler) => {
    windowHandlers.set(event, handler as Handler)
  }
  const webContentsOn: StartupWindow['webContents']['on'] = (event, handler) => {
    webHandlers.set(event, handler as Handler)
  }

  return {
    window: {
      show,
      isDestroyed: () => false,
      on,
      webContents: {
        on: webContentsOn
      }
    },
    show,
    windowHandlers,
    webHandlers
  }
}

describe('window startup lifecycle', () => {
  it('shows the hidden window when the renderer finishes loading', () => {
    const { window, show, webHandlers } = createWindowStub()
    const logger = { info: vi.fn(), error: vi.fn() }

    wireWindowStartupEvents(window, logger)

    webHandlers.get('did-finish-load')?.()

    expect(show).toHaveBeenCalledOnce()
    expect(logger.info).toHaveBeenCalledWith('[startup] main window shown: did-finish-load')
  })

  it('does not show the window twice when both startup events fire', () => {
    const { window, show, windowHandlers, webHandlers } = createWindowStub()

    wireWindowStartupEvents(window, { info: vi.fn(), error: vi.fn() })

    webHandlers.get('did-finish-load')?.()
    windowHandlers.get('ready-to-show')?.()

    expect(show).toHaveBeenCalledOnce()
  })
})
