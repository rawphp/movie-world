<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { MovieRecord } from '../../../shared/types'
import type { TmdbSearchResult } from '../../../main/tmdb/client'

const props = defineProps<{ movie: MovieRecord }>()
const emit = defineEmits<{ close: [] }>()

const api = window.api

const query = ref(props.movie.parsedTitle)
const yearText = ref(props.movie.parsedYear != null ? String(props.movie.parsedYear) : '')
const rawId = ref('')
const results = ref<TmdbSearchResult[]>([])
const searching = ref(false)
const applying = ref(false)
const applyingId = ref<number | null>(null)
const searchError = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const dialogRoot = ref<HTMLElement | null>(null)

const rawIdValid = computed(() => /^\d+$/.test(rawId.value.trim()))
const yearValue = computed((): number | null => {
  const t = yearText.value.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
})
const sourceFilename = computed(() => {
  const path = props.movie.filePath
  const base = path.split(/[/\\]/).pop()
  return base && base.length > 0 ? base : path
})

async function search(): Promise<void> {
  searching.value = true
  searchError.value = ''
  try {
    results.value = await api.searchTmdb(query.value, yearValue.value)
  } catch {
    results.value = []
    searchError.value = 'Search failed — check your TMDB API key and connection.'
  } finally {
    searching.value = false
  }
}

async function apply(tmdbId: number): Promise<void> {
  if (applying.value) return
  applying.value = true
  applyingId.value = tmdbId
  try {
    await api.fixMatch(props.movie.id, tmdbId)
    emit('close')
  } catch {
    searchError.value = 'Could not apply that match. Try another result or TMDB id.'
  } finally {
    applying.value = false
    applyingId.value = null
  }
}

function submitRawId(): void {
  if (rawIdValid.value) void apply(Number(rawId.value.trim()))
}

function focusableInDialog(): HTMLElement[] {
  const root = dialogRoot.value
  if (!root) return []
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ].filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key !== 'Tab') return
  const nodes = focusableInDialog()
  if (nodes.length === 0) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (event.shiftKey) {
    if (!active || active === first || !dialogRoot.value?.contains(active)) {
      event.preventDefault()
      last.focus()
    }
  } else if (active === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  void search().then(async () => {
    await nextTick()
    searchInput.value?.focus()
    searchInput.value?.select()
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    class="fixed inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="fix-match-title"
    @click.self="emit('close')"
  >
    <div
      ref="dialogRoot"
      class="flex max-h-[80vh] w-[560px] flex-col overflow-hidden rounded-lg bg-neutral-800 text-sm text-white shadow-2xl"
    >
      <div class="shrink-0 p-4 pb-0">
        <div class="mb-3 flex items-center justify-between">
          <h2 id="fix-match-title" class="text-lg font-semibold">Fix match</h2>
          <button
            type="button"
            class="rounded px-2 py-1 text-neutral-400 hover:text-white"
            aria-label="Close"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>

        <p
          data-testid="fix-source-filename"
          class="mb-3 truncate text-xs text-neutral-400"
          :title="props.movie.filePath"
        >
          Source: {{ sourceFilename }}
        </p>

        <div class="mb-3 flex gap-2">
          <input
            ref="searchInput"
            v-model="query"
            data-testid="fix-search-input"
            aria-label="Search title"
            placeholder="Title"
            class="flex-1 rounded bg-neutral-700 px-2 py-1 outline-none focus:ring-2 focus:ring-sky-500"
            @keyup.enter="search"
          />
          <input
            v-model="yearText"
            data-testid="fix-search-year"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            aria-label="Search year"
            placeholder="Year"
            class="w-24 rounded bg-neutral-700 px-2 py-1 outline-none focus:ring-2 focus:ring-sky-500"
            @keyup.enter="search"
          />
          <button
            type="button"
            class="rounded bg-sky-600 px-3 py-1 hover:bg-sky-500 disabled:opacity-50"
            :disabled="searching || applying"
            @click="search"
          >
            {{ searching ? 'Searching…' : 'Search' }}
          </button>
        </div>
      </div>

      <div data-testid="fix-results" class="min-h-0 flex-1 overflow-y-auto px-4">
        <p v-if="searchError" data-testid="fix-error" class="mb-2 text-red-400">{{ searchError }}</p>
        <p v-else-if="searching" class="text-neutral-400">Searching…</p>
        <p v-else-if="applying" data-testid="fix-applying" class="mb-2 text-sky-300">
          Applying match…
        </p>
        <p v-else-if="!results.length" class="text-neutral-400">
          No results — adjust the search or paste a TMDB id below.
        </p>
        <ul v-else class="space-y-2 pb-2">
          <li v-for="r in results" :key="r.id">
            <button
              type="button"
              data-testid="fix-candidate"
              class="flex w-full cursor-pointer gap-3 rounded bg-neutral-700/60 p-2 text-left hover:bg-neutral-600 disabled:opacity-50"
              :disabled="applying"
              :aria-label="applyingId === r.id ? `Applying match ${r.title}` : `Use match ${r.title}`"
              @click="apply(r.id)"
            >
              <img
                v-if="r.poster_path"
                data-testid="fix-candidate-poster"
                :src="`https://image.tmdb.org/t/p/w92${r.poster_path}`"
                :alt="`${r.title} poster`"
                class="h-20 w-14 shrink-0 rounded bg-neutral-900 object-cover"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
              <div
                v-else
                data-testid="fix-candidate-poster-fallback"
                class="flex h-20 w-14 shrink-0 items-center justify-center rounded bg-neutral-900 text-[10px] text-neutral-500"
                aria-hidden="true"
              >
                No art
              </div>
              <div class="min-w-0">
                <div class="font-medium">
                  {{ r.title }}
                  <span class="text-neutral-400">({{ r.release_date?.slice(0, 4) ?? '—' }})</span>
                  <span v-if="applyingId === r.id" class="ml-2 text-xs text-sky-300">Applying…</span>
                </div>
                <div class="line-clamp-2 text-xs text-neutral-400">{{ r.overview }}</div>
              </div>
            </button>
          </li>
        </ul>
      </div>

      <div
        data-testid="fix-id-footer"
        class="sticky bottom-0 shrink-0 border-t border-neutral-700 bg-neutral-800 p-4 pt-3"
      >
        <div class="flex items-center gap-2">
          <label for="fix-id-input" class="text-neutral-400">TMDB id:</label>
          <input
            id="fix-id-input"
            v-model="rawId"
            data-testid="fix-id-input"
            placeholder="e.g. 603"
            class="w-28 rounded bg-neutral-700 px-2 py-1 outline-none focus:ring-2 focus:ring-sky-500"
            @keyup.enter="submitRawId"
          />
          <button
            type="button"
            data-testid="fix-id-submit"
            class="rounded bg-sky-600 px-3 py-1 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!rawIdValid || applying"
            @click="submitRawId"
          >
            Use id
          </button>
          <button
            type="button"
            class="ml-auto rounded bg-neutral-700 px-3 py-1 hover:bg-neutral-600"
            @click="emit('close')"
          >
            Cancel
          </button>
        </div>
        <p class="mt-2 text-xs text-neutral-500">Press Esc to close.</p>
      </div>
    </div>
  </div>
</template>
