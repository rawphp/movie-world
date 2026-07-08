<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { MovieRecord } from '../../../shared/types'
import type { TmdbSearchResult } from '../../../main/tmdb/client'

const props = defineProps<{ movie: MovieRecord }>()
const emit = defineEmits<{ close: [] }>()

const api = window.api

const query = ref(props.movie.parsedTitle)
const year = ref<number | null>(props.movie.parsedYear)
const rawId = ref('')
const results = ref<TmdbSearchResult[]>([])
const searching = ref(false)

const rawIdValid = computed(() => /^\d+$/.test(rawId.value.trim()))

async function search(): Promise<void> {
  searching.value = true
  try {
    results.value = await api.searchTmdb(query.value, year.value)
  } finally {
    searching.value = false
  }
}

async function apply(tmdbId: number): Promise<void> {
  await api.fixMatch(props.movie.id, tmdbId)
  emit('close')
}

function submitRawId(): void {
  if (rawIdValid.value) void apply(Number(rawId.value.trim()))
}

onMounted(search)
</script>

<template>
  <div
    class="fixed inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      class="max-h-[80vh] w-[560px] overflow-y-auto rounded-lg bg-neutral-800 p-4 text-sm text-white shadow-2xl"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">Fix match</h2>
        <button
          class="rounded px-2 py-1 text-neutral-400 hover:text-white"
          aria-label="Close"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <div class="mb-3 flex gap-2">
        <input
          v-model="query"
          data-testid="fix-search-input"
          placeholder="Title"
          class="flex-1 rounded bg-neutral-700 px-2 py-1 outline-none focus:ring-2 focus:ring-sky-500"
          @keyup.enter="search"
        />
        <input
          v-model.number="year"
          data-testid="fix-search-year"
          type="number"
          placeholder="Year"
          class="w-24 rounded bg-neutral-700 px-2 py-1 outline-none focus:ring-2 focus:ring-sky-500"
          @keyup.enter="search"
        />
        <button class="rounded bg-sky-600 px-3 py-1 hover:bg-sky-500" @click="search">
          Search
        </button>
      </div>

      <p v-if="searching" class="text-neutral-400">Searching…</p>
      <p v-else-if="!results.length" class="text-neutral-400">
        No results — adjust the search or paste a TMDB id below.
      </p>
      <ul v-else class="space-y-2">
        <li
          v-for="r in results"
          :key="r.id"
          data-testid="fix-candidate"
          class="flex cursor-pointer gap-3 rounded bg-neutral-700/60 p-2 hover:bg-neutral-600"
          @click="apply(r.id)"
        >
          <img
            v-if="r.poster_path"
            :src="`https://image.tmdb.org/t/p/w92${r.poster_path}`"
            :alt="r.title"
            class="h-20 w-14 shrink-0 rounded object-cover"
          />
          <div class="min-w-0">
            <div class="font-medium">
              {{ r.title }}
              <span class="text-neutral-400">({{ r.release_date?.slice(0, 4) ?? '—' }})</span>
            </div>
            <div class="line-clamp-2 text-xs text-neutral-400">{{ r.overview }}</div>
          </div>
        </li>
      </ul>

      <div class="mt-4 flex items-center gap-2 border-t border-neutral-700 pt-3">
        <span class="text-neutral-400">TMDB id:</span>
        <input
          v-model="rawId"
          data-testid="fix-id-input"
          placeholder="e.g. 603"
          class="w-28 rounded bg-neutral-700 px-2 py-1 outline-none focus:ring-2 focus:ring-sky-500"
          @keyup.enter="submitRawId"
        />
        <button
          data-testid="fix-id-submit"
          class="rounded bg-sky-600 px-3 py-1 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!rawIdValid"
          @click="submitRawId"
        >
          Use id
        </button>
        <button
          class="ml-auto rounded bg-neutral-700 px-3 py-1 hover:bg-neutral-600"
          @click="emit('close')"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
