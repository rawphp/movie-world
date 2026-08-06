<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { DEFAULT_KEYBINDINGS, isValidCombo } from '../../../shared/keybindings'
import type { Keybindings, ScanProgress, Settings } from '../../../shared/types'
import ShortcutRecorder from '../components/ShortcutRecorder.vue'

const api = window.api
const settings = ref<Settings>({ folders: [], tmdbApiKey: null, keybindings: DEFAULT_KEYBINDINGS })
const keyInput = ref('')
const saving = ref(false)
type KeyState = 'idle' | 'valid' | 'invalid' | 'cleared'
const keyState = ref<KeyState>('idle')
const progress = ref<Record<string, ScanProgress>>({})
const shortcutErrors = ref<Partial<Record<keyof Keybindings, string>>>({})

const firstRun = computed(() => settings.value.folders.length === 0 && !settings.value.tmdbApiKey)

onMounted(async () => {
  settings.value = await api.getSettings()
  keyInput.value = settings.value.tmdbApiKey ?? ''
  api.onScanProgress((p) => {
    progress.value = { ...progress.value, [p.folder]: p }
  })
})

async function saveKey(): Promise<void> {
  saving.value = true
  keyState.value = 'idle'
  try {
    const trimmed = keyInput.value.trim()
    const next = await api.setApiKey(trimmed)
    settings.value = next
    keyInput.value = next.tmdbApiKey ?? ''
    if (!trimmed) {
      keyState.value = 'cleared'
    } else {
      keyState.value = next.tmdbApiKey ? 'valid' : 'invalid'
    }
  } catch {
    keyState.value = 'invalid'
  } finally {
    saving.value = false
  }
}

async function addFolder(): Promise<void> {
  const next = await api.addFolder()
  if (next) settings.value = next
}

async function removeFolder(path: string): Promise<void> {
  const folderName = path.split('/').filter(Boolean).pop() ?? path
  const ok = window.confirm(
    `Remove “${folderName}” from Movie World?\n\nYour files on disk are not deleted — the app only stops scanning this folder.`
  )
  if (!ok) return
  settings.value = await api.removeFolder(path)
  const rest = { ...progress.value }
  delete rest[path]
  progress.value = rest
}

async function rescan(folder: string): Promise<void> {
  await api.rescanFolder(folder)
}

async function saveShortcut(action: keyof Keybindings, combo: string): Promise<void> {
  shortcutErrors.value = { ...shortcutErrors.value, [action]: '' }
  const otherAction: keyof Keybindings = action === 'prevMovie' ? 'nextMovie' : 'prevMovie'

  if (!isValidCombo(combo)) {
    shortcutErrors.value = { ...shortcutErrors.value, [action]: 'That shortcut is not available.' }
    return
  }

  if (combo === settings.value.keybindings[otherAction]) {
    shortcutErrors.value = {
      ...shortcutErrors.value,
      [action]: 'Already used by another shortcut.'
    }
    return
  }

  try {
    const nextKeybindings = { ...settings.value.keybindings, [action]: combo }
    settings.value = await api.setKeybindings(nextKeybindings)
  } catch {
    shortcutErrors.value = { ...shortcutErrors.value, [action]: 'Shortcut could not be saved.' }
  }
}

async function resetShortcuts(): Promise<void> {
  shortcutErrors.value = {}
  settings.value = await api.setKeybindings(DEFAULT_KEYBINDINGS)
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-8">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-white">Settings</h1>
      <RouterLink to="/" class="text-sm text-sky-400 hover:text-sky-300">
        ← Back to library
      </RouterLink>
    </div>

    <!-- First-run guided empty state: no key + no folders -->
    <div
      v-if="firstRun"
      data-testid="first-run"
      class="rounded-xl border border-sky-800 bg-sky-950/40 p-6 text-sm text-sky-100"
    >
      <p class="mb-3 text-lg font-semibold text-white">Welcome to Movie World 🎬</p>
      <ol class="list-decimal space-y-1 pl-5 text-sky-200">
        <li>Paste your free TMDB API key below so posters and details can be fetched.</li>
        <li>Add your first movie folder — scanning starts automatically.</li>
        <li>Head back to the library and watch the grid fill in.</li>
      </ol>
    </div>

    <!-- Metadata: TMDB API key -->
    <section>
      <h2 class="mb-2 text-lg font-semibold text-white">TMDB API key</h2>
      <p class="mb-2 text-sm text-neutral-400">
        Get a free key at
        <a
          href="https://www.themoviedb.org/settings/api"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sky-400 underline hover:text-sky-300"
          >themoviedb.org → Settings → API</a
        >. Without it, movies are indexed but no metadata is fetched.
      </p>
      <div class="flex gap-2">
        <label class="sr-only" for="apikey-input">TMDB API key</label>
        <input
          id="apikey-input"
          v-model="keyInput"
          data-testid="apikey-input"
          type="password"
          autocomplete="off"
          aria-label="TMDB API key"
          class="flex-1 rounded bg-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-400"
          placeholder="Paste your TMDB API key"
        />
        <button
          data-testid="apikey-save"
          class="rounded bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
          :disabled="saving"
          @click="saveKey"
        >
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
      <p
        v-if="keyState === 'valid'"
        data-testid="apikey-status"
        class="mt-2 text-xs text-emerald-400"
      >
        ✓ Saved — key is set.
      </p>
      <p
        v-else-if="keyState === 'cleared'"
        data-testid="apikey-status"
        class="mt-2 text-xs text-amber-300"
      >
        API key cleared. Metadata won’t be fetched until you add a key.
      </p>
      <p
        v-else-if="keyState === 'invalid'"
        data-testid="apikey-status"
        class="mt-2 text-xs text-red-400"
      >
        ✕ That key could not be saved — try again.
      </p>
    </section>

    <!-- Library: registered folders -->
    <section>
      <h2 class="mb-2 text-lg font-semibold text-white">Movie folders</h2>
      <ul v-if="settings.folders.length" class="mb-3 space-y-2">
        <li
          v-for="f in settings.folders"
          :key="f"
          data-testid="folder-row"
          class="flex items-center gap-2 rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white"
        >
          <span class="min-w-0 flex-1 truncate">📁 {{ f }}</span>
          <span
            v-if="progress[f] && !progress[f].done"
            class="whitespace-nowrap text-xs text-sky-300"
          >
            scanning {{ progress[f].ingested }}/{{ progress[f].discovered }}…
          </span>
          <span
            v-else-if="progress[f] && progress[f].done"
            class="whitespace-nowrap text-xs text-emerald-400"
          >
            done ({{ progress[f].ingested }})
          </span>
          <button
            data-testid="folder-rescan"
            class="rounded bg-neutral-700 px-2 py-1 text-xs text-white hover:bg-neutral-600"
            @click="rescan(f)"
          >
            Rescan
          </button>
          <button
            data-testid="folder-remove"
            class="rounded bg-red-800 px-2 py-1 text-xs text-white hover:bg-red-700"
            @click="removeFolder(f)"
          >
            Remove
          </button>
        </li>
      </ul>
      <button
        data-testid="folder-add"
        class="rounded bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500"
        @click="addFolder"
      >
        + Add folder…
      </button>
      <p class="mt-2 text-xs text-neutral-500">
        Removing a folder only forgets it in the app — nothing on disk is touched.
      </p>
    </section>

    <!-- Keyboard shortcuts -->
    <section data-testid="keyboard-shortcuts">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold text-white">Keyboard shortcuts</h2>
        <button
          data-testid="shortcut-reset"
          class="rounded bg-neutral-700 px-3 py-2 text-sm text-white hover:bg-neutral-600"
          @click="resetShortcuts"
        >
          Reset to defaults
        </button>
      </div>
      <div class="space-y-2">
        <div
          data-testid="shortcut-prev"
          class="flex items-start justify-between gap-3 rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white"
        >
          <span class="pt-2">Previous movie</span>
          <ShortcutRecorder
            :combo="settings.keybindings.prevMovie"
            :error="shortcutErrors.prevMovie"
            @update:combo="saveShortcut('prevMovie', $event)"
          />
        </div>
        <div
          data-testid="shortcut-next"
          class="flex items-start justify-between gap-3 rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white"
        >
          <span class="pt-2">Next movie</span>
          <ShortcutRecorder
            :combo="settings.keybindings.nextMovie"
            :error="shortcutErrors.nextMovie"
            @update:combo="saveShortcut('nextMovie', $event)"
          />
        </div>
      </div>
    </section>
  </div>
</template>
