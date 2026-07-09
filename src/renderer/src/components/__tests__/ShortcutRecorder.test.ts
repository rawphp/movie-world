// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import ShortcutRecorder from '../ShortcutRecorder.vue'

describe('ShortcutRecorder', () => {
  it('records a valid combo and emits it', async () => {
    const wrapper = mount(ShortcutRecorder, { props: { combo: 'Mod+ArrowRight' } })

    await wrapper.get('[data-testid="shortcut-recorder"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', altKey: true, cancelable: true }))

    expect(wrapper.emitted('update:combo')).toEqual([['Alt+n']])
  })

  it('ignores modifier-only keydowns and cancels recording with Escape', async () => {
    const wrapper = mount(ShortcutRecorder, { props: { combo: 'Alt+n' } })

    await wrapper.get('[data-testid="shortcut-recorder"]').trigger('click')
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Alt', altKey: true, cancelable: true })
    )
    await nextTick()
    expect(wrapper.emitted('update:combo')).toBeUndefined()
    expect(wrapper.text()).toContain('Press a combination')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    await nextTick()

    expect(wrapper.emitted('update:combo')).toBeUndefined()
    expect(wrapper.text()).toContain('Alt + n')
    expect(wrapper.text()).not.toContain('Press a combination')
  })

  it('shows an error and keeps recording for invalid combos', async () => {
    const wrapper = mount(ShortcutRecorder, { props: { combo: 'Alt+n' } })

    await wrapper.get('[data-testid="shortcut-recorder"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    await nextTick()

    expect(wrapper.emitted('update:combo')).toBeUndefined()
    expect(wrapper.get('[data-testid="shortcut-error"]').text()).toContain('not available')
    expect(wrapper.text()).toContain('Press a combination')
  })

  it('prevents captured recording keydowns from leaking to other handlers', async () => {
    const wrapper = mount(ShortcutRecorder, { props: { combo: 'Alt+n' } })
    let leaked = false

    await wrapper.get('[data-testid="shortcut-recorder"]').trigger('click')
    window.addEventListener('keydown', () => {
      leaked = true
    })

    const event = new KeyboardEvent('keydown', { key: 'p', altKey: true, cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(leaked).toBe(false)
  })
})
