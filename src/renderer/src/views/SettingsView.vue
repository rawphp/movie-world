<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { DEFAULT_KEYBINDINGS, isValidCombo } from '../../../shared/keybindings'
import type { Keybindings, ScanProgress, Settings } from '../../../shared/types'
import { formatFolderLabel } from '../lib/format'
import ShortcutRecorder from '../components/ShortcutRecorder.vue'

const api = window.api
const settings = ref<Settings>({ folders: [], tmdbApiKey: null, keybindings: DEFAULT_KEYBINDINGS })
const keyInput = ref('')
const saving = ref(false)
const showKey = ref(false)
type KeyState = 'idle' | 'present' | 'valid' | 'invalid' | 'cleared'
const keyState = ref<KeyState>('idle')
const progress = ref<Record<string, ScanProgress>>({})
const shortcutErrors = ref<Partial<Record<keyof Keybindings, string>>>({})
const rescanning = ref<Record<string, boolean>>({})

const hasApiKey = computed(() => !!settings.value.tmdbApiKey)
const hasFolders = computed(() => settings.value.folders.length > 0)
const firstRun = computed(() => !hasFolders.value && !hasApiKey.value)
/** Incomplete setup: missing key and/or folders — show step checklist. */
const setupIncomplete = computed(() => !hasApiKey.value || !hasFolders.value)

onMounted(async () => {
  settings.value = await api.getSettings()
  keyInput.value = settings.value.tmdbApiKey ?? ''
  keyState.value = settings.value.tmdbApiKey ? 'present' : 'idle'
  api.onScanProgress((p) => {
    progress.value = { ...progress.value, [p.folder]: p }
    if (p.done) {
      const next = { ...rescanning.value }
      delete next[p.folder]
      rescanning.value = next
    }
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
  if (rescanning.value[folder]) return
  rescanning.value = { ...rescanning.value, [folder]: true }
  try {
    await api.rescanFolder(folder)
  } catch {
    const next = { ...rescanning.value }
    delete next[folder]
    rescanning.value = next
  }
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
  const ok = window.confirm('Reset keyboard shortcuts to the defaults?')
  if (!ok) return
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

    <!-- Setup progress: which steps are done vs remaining -->
    <div
      v-if="setupIncomplete"
      data-testid="setup-progress"
      class="rounded-xl border border-neutral-700 bg-neutral-900/60 p-5 text-sm text-neutral-200"
    >
      <p class="mb-3 font-semibold text-white">Setup progress</p>
      <ul class="space-y-2">
        <li
          data-testid="setup-step-key"
          :data-done="hasApiKey ? 'true' : 'false'"
          class="flex items-start gap-2"
          :class="hasApiKey ? 'text-emerald-400' : 'text-amber-200'"
        >
          <span class="select-none" aria-hidden="true">{{ hasApiKey ? '✓' : '○' }}</span>
          <span>
            <template v-if="hasApiKey">TMDB API key saved</template>
            <template v-else>Add a free TMDB API key (for posters &amp; details)</template>
          </span>
        </li>
        <li
          data-testid="setup-step-folder"
          :data-done="hasFolders ? 'true' : 'false'"
          class="flex items-start gap-2"
          :class="hasFolders ? 'text-emerald-400' : 'text-amber-200'"
        >
          <span class="select-none" aria-hidden="true">{{ hasFolders ? '✓' : '○' }}</span>
          <span>
            <template v-if="hasFolders">Movie folder added</template>
            <template v-else>Add a movie folder to scan</template>
          </span>
        </li>
      </ul>
    </div>

    <!-- Metadata: TMDB API key -->
    <section>
      <h2 class="mb-2 text-lg font-semibold text-white">TMDB API key</h2>
      <p data-testid="tmdb-key-help" class="mb-2 text-sm text-neutral-400">
        Movie World uses a free TMDB API key to fetch posters, titles, cast, and other metadata for
        your files. Get one at
        <a
          href="https://www.themoviedb.org/settings/api"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sky-400 underline hover:text-sky-300"
          >themoviedb.org → Settings → API</a
        >. Without a key, movies are still indexed on disk but no metadata is fetched.
      </p>
      <div class="flex flex-wrap gap-2">
        <label class="sr-only" for="apikey-input">TMDB API key</label>
        <input
          id="apikey-input"
          v-model="keyInput"
          data-testid="apikey-input"
          :type="showKey ? 'text' : 'password'"
          autocomplete="off"
          spellcheck="false"
          aria-label="TMDB API key"
          class="min-w-0 flex-1 rounded bg-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-400"
          placeholder="Paste your TMDB API key"
        />
        <button
          type="button"
          data-testid="apikey-toggle"
          class="rounded bg-neutral-700 px-3 py-2 text-sm text-white hover:bg-neutral-600"
          :aria-pressed="showKey"
          :aria-label="showKey ? 'Hide API key' : 'Show API key'"
          @click="showKey = !showKey"
        >
          {{ showKey ? 'Hide' : 'Show' }}
        </button>
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
        v-else-if="keyState === 'present'"
        data-testid="apikey-status"
        class="mt-2 text-xs text-emerald-400"
      >
        ✓ Key is set.
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
          <span class="min-w-0 flex-1 truncate" :title="f"> 📁 {{ formatFolderLabel(f) }} </span>
          <span
            v-if="(progress[f] && !progress[f].done) || rescanning[f]"
            class="whitespace-nowrap text-xs text-sky-300"
          >
            <template v-if="progress[f] && !progress[f].done">
              scanning {{ progress[f].ingested }}/{{ progress[f].discovered }}…
            </template>
            <template v-else>scanning…</template>
          </span>
          <span
            v-else-if="progress[f] && progress[f].done"
            class="whitespace-nowrap text-xs text-emerald-400"
          >
            done ({{ progress[f].ingested }})
          </span>
          <button
            data-testid="folder-rescan"
            class="rounded bg-neutral-700 px-2 py-1 text-xs text-white hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!!rescanning[f] || !!(progress[f] && !progress[f].done)"
            @click="rescan(f)"
          >
            {{ rescanning[f] || (progress[f] && !progress[f].done) ? 'Scanning…' : 'Rescan' }}
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
            action-label="Previous movie"
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
            action-label="Next movie"
            :combo="settings.keybindings.nextMovie"
            :error="shortcutErrors.nextMovie"
            @update:combo="saveShortcut('nextMovie', $event)"
          />
        </div>
      </div>
    </section>

    <!-- Where data lives (always visible; matches README) -->
    <section
      data-testid="data-location"
      class="rounded-xl border border-neutral-700 bg-neutral-900/60 p-5 text-sm text-neutral-200"
    >
      <h2 class="mb-2 text-lg font-semibold text-white">Where your data lives</h2>
      <ul class="list-disc space-y-2 pl-5 text-neutral-300">
        <li>
          <span class="font-medium text-neutral-100"
            >Movie metadata (NFO sidecars &amp; artwork):</span
          >
          written next to each movie file. For
          <code class="rounded bg-neutral-800 px-1 text-xs text-neutral-200">Movie.mkv</code>
          you get
          <code class="rounded bg-neutral-800 px-1 text-xs text-neutral-200">Movie.nfo</code>,
          <code class="rounded bg-neutral-800 px-1 text-xs text-neutral-200">Movie-poster.jpg</code>
          and
          <code class="rounded bg-neutral-800 px-1 text-xs text-neutral-200">Movie-fanart.jpg</code>
          in the same folder.
        </li>
        <li>
          <span class="font-medium text-neutral-100">App settings</span>
          (library folders + TMDB API key): stored as
          <code class="rounded bg-neutral-800 px-1 text-xs text-neutral-200">settings.json</code>
          in the app user-data directory.
          <ul class="mt-2 list-disc space-y-1 pl-5">
            <li>
              macOS packaged:
              <code class="break-all rounded bg-neutral-800 px-1 text-xs text-neutral-200"
                >~/Library/Application Support/Movie World/settings.json</code
              >
              (<code class="break-all rounded bg-neutral-800 px-1 text-xs text-neutral-200"
                >~/Library/Application Support/movie-world/settings.json</code
              >
              in
              <code class="rounded bg-neutral-800 px-1 text-xs text-neutral-200">npm run dev</code>)
            </li>
            <li>
              Linux packaged:
              <code class="break-all rounded bg-neutral-800 px-1 text-xs text-neutral-200"
                >~/.config/Movie World/settings.json</code
              >
              (<code class="break-all rounded bg-neutral-800 px-1 text-xs text-neutral-200"
                >~/.config/movie-world/settings.json</code
              >
              in
              <code class="rounded bg-neutral-800 px-1 text-xs text-neutral-200">npm run dev</code>)
            </li>
          </ul>
        </li>
      </ul>
    </section>

    <!-- First-launch tips for unsigned personal builds (always visible) -->
    <section
      data-testid="gatekeeper-tip"
      class="rounded-xl border border-neutral-700 bg-neutral-900/60 p-5 text-sm text-neutral-200"
    >
      <h2 class="mb-2 text-lg font-semibold text-white">First launch</h2>
      <p class="mb-3 text-neutral-300">Builds are unsigned and intended for personal use.</p>
      <h3 class="mb-1 font-medium text-neutral-100">macOS (Gatekeeper)</h3>
      <p class="mb-2 text-neutral-300">
        macOS Gatekeeper may block a normal double-click the first time. To open it:
      </p>
      <ol class="list-decimal space-y-1 pl-5 text-neutral-300">
        <li>
          In Finder, right-click (or Control-click)
          <strong class="text-neutral-100">Movie World.app</strong>.
        </li>
        <li>Choose <strong class="text-neutral-100">Open</strong>.</li>
        <li>Confirm <strong class="text-neutral-100">Open</strong> in the dialog that appears.</li>
      </ol>
      <p class="mt-2 text-xs text-neutral-500">
        macOS remembers this choice, so subsequent launches work with a normal double-click.
      </p>
      <h3 class="mb-1 mt-4 font-medium text-neutral-100">Linux (AppImage)</h3>
      <p class="mb-2 text-neutral-300">Mark the AppImage executable, then run it:</p>
      <ol class="list-decimal space-y-1 pl-5 text-neutral-300">
        <li>
          <code class="rounded bg-neutral-800 px-1 text-xs text-neutral-200"
            >chmod +x Movie-World-*.AppImage</code
          >
        </li>
        <li>
          <code class="rounded bg-neutral-800 px-1 text-xs text-neutral-200"
            >./Movie-World-*.AppImage</code
          >
        </li>
      </ol>
      <p class="mt-2 text-xs text-neutral-500">
        If the AppImage fails to mount, install FUSE 2 (on Arch/Omarchy:
        <code class="rounded bg-neutral-800 px-1">sudo pacman -S fuse2</code>). You can also run the
        unpacked binary under
        <code class="rounded bg-neutral-800 px-1">dist/linux-unpacked</code>
        (or
        <code class="rounded bg-neutral-800 px-1">dist/linux-arm64-unpacked</code>
        on ARM).
      </p>
    </section>
  </div>
</template>
