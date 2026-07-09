<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { comboFromEvent, isValidCombo } from '../../../shared/keybindings'

const props = defineProps<{
  combo: string
  error?: string
}>()

const emit = defineEmits<{
  'update:combo': [combo: string]
}>()

const recording = ref(false)
const internalError = ref('')

const isMac = computed(() => /Mac|iPhone|iPad|iPod/.test(navigator.platform))
const visibleError = computed(() => internalError.value || props.error || '')
const label = computed(() => formatCombo(props.combo, isMac.value))

function startRecording(): void {
  if (recording.value) return

  internalError.value = ''
  recording.value = true
  window.addEventListener('keydown', captureKeydown, true)
}

function stopRecording(): void {
  if (!recording.value) return

  recording.value = false
  window.removeEventListener('keydown', captureKeydown, true)
}

function captureKeydown(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  if (event.key === 'Escape') {
    internalError.value = ''
    stopRecording()
    return
  }

  const next = comboFromEvent(event, isMac.value)
  if (!next) return

  if (!isValidCombo(next)) {
    internalError.value = 'That shortcut is not available.'
    return
  }

  internalError.value = ''
  emit('update:combo', next)
  stopRecording()
}

function formatCombo(combo: string, mac: boolean): string {
  return combo
    .split('+')
    .map((part) => formatPart(part, mac))
    .join(' + ')
}

function formatPart(part: string, mac: boolean): string {
  if (part === 'Mod') return mac ? '⌘' : 'Ctrl'
  if (part === 'Ctrl') return 'Ctrl'
  if (part === 'Alt') return mac ? 'Option' : 'Alt'
  if (part === 'Shift') return 'Shift'
  if (part === 'ArrowLeft') return '←'
  if (part === 'ArrowRight') return '→'
  if (part === 'ArrowUp') return '↑'
  if (part === 'ArrowDown') return '↓'
  if (part === ' ') return 'Space'
  return part
}

onBeforeUnmount(stopRecording)
</script>

<template>
  <div>
    <button
      type="button"
      data-testid="shortcut-recorder"
      class="min-w-32 rounded bg-neutral-700 px-3 py-2 text-left text-sm text-white hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
      :class="{ 'ring-2 ring-sky-500': recording }"
      @click="startRecording"
    >
      <span v-if="recording">Press a combination… Esc to cancel</span>
      <span v-else>{{ label }}</span>
    </button>
    <p v-if="visibleError" data-testid="shortcut-error" class="mt-1 text-xs text-red-400">
      {{ visibleError }}
    </p>
  </div>
</template>
