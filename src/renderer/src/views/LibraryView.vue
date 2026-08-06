<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '../stores/library'
import FilterBar from '../components/FilterBar.vue'
import MovieCard from '../components/MovieCard.vue'

const store = useLibraryStore()
const router = useRouter()
const apiKeyMissing = ref(false)
const hasFolders = ref(true)

onMounted(async () => {
  const settings = await window.api.getSettings()
  apiKeyMissing.value = !settings.tmdbApiKey
  hasFolders.value = settings.folders.length > 0
  await store.load()
})

const emptyLibrary = computed(() => store.loaded && store.all.length === 0)
const emptyFiltered = computed(
  () => store.loaded && store.all.length > 0 && store.list.length === 0
)
const cacheStatusMessage = computed(() => store.cacheStatusMessage)
const unmatchedCount = computed(() => store.all.filter((m) => m.matchStatus === 'unmatched').length)
const missingCount = computed(() => store.all.filter((m) => m.fileMissing).length)
const fetchFailedCount = computed(() => store.all.filter((m) => m.fetchFailed).length)
</script>

<template>
  <div class="space-y-4">
    <div v-if="apiKeyMissing" class="rounded-lg bg-amber-900/60 p-3 text-sm text-amber-200">
      No TMDB API key set — movies will be indexed without metadata.
      <RouterLink to="/settings" class="underline">Add your key in Settings</RouterLink>.
    </div>
    <div
      v-if="cacheStatusMessage"
      data-testid="library-cache-status"
      class="rounded-lg border border-sky-800 bg-sky-950/60 px-4 py-3 text-sm text-sky-100"
    >
      {{ cacheStatusMessage }}
    </div>
    <div
      v-if="unmatchedCount > 0"
      data-testid="library-unmatched-banner"
      class="flex flex-wrap items-center gap-2 rounded-lg bg-amber-900/50 px-4 py-3 text-sm text-amber-100"
    >
      <span
        >{{ unmatchedCount }} {{ unmatchedCount === 1 ? 'movie needs' : 'movies need' }} a TMDB
        match.</span
      >
      <button
        v-if="store.filters.issue !== 'unmatched'"
        type="button"
        class="underline hover:text-white"
        @click="store.setFilter({ issue: 'unmatched' })"
      >
        Show them
      </button>
      <span v-else class="text-amber-200/80">Showing them now.</span>
    </div>
    <div
      v-if="missingCount > 0"
      data-testid="library-missing-banner"
      class="flex flex-wrap items-center gap-2 rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-100"
    >
      <span
        >{{ missingCount }} {{ missingCount === 1 ? 'file is' : 'files are' }} missing from
        disk.</span
      >
      <button
        v-if="store.filters.issue !== 'missing'"
        type="button"
        class="underline hover:text-white"
        @click="store.setFilter({ issue: 'missing' })"
      >
        Show them
      </button>
      <span v-else class="text-red-200/80">Showing them now.</span>
    </div>
    <div
      v-if="fetchFailedCount > 0"
      data-testid="library-fetch-failed-banner"
      class="flex flex-wrap items-center gap-2 rounded-lg bg-orange-900/40 px-4 py-3 text-sm text-orange-100"
    >
      <span
        >{{ fetchFailedCount }} {{ fetchFailedCount === 1 ? 'movie failed' : 'movies failed' }} to
        fetch metadata.</span
      >
      <button
        v-if="store.filters.issue !== 'fetchFailed'"
        type="button"
        class="underline hover:text-white"
        @click="store.setFilter({ issue: 'fetchFailed' })"
      >
        Show them
      </button>
      <span v-else class="text-orange-200/80">Showing them now.</span>
    </div>

    <div
      v-if="!store.loaded"
      data-testid="library-loading"
      class="rounded-lg bg-neutral-800 p-10 text-center text-neutral-300"
    >
      Loading your library…
    </div>

    <template v-else>
      <FilterBar v-if="store.all.length > 0 || store.hasActiveFilters" />

      <div
        v-if="emptyLibrary"
        data-testid="library-empty"
        class="rounded-lg bg-neutral-800 p-10 text-center text-neutral-300"
      >
        <p class="mb-3 text-lg">Your library is empty.</p>
        <RouterLink to="/settings" class="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-500">
          {{ hasFolders ? 'Manage folders' : 'Add your first movie folder' }}
        </RouterLink>
      </div>

      <div
        v-else-if="emptyFiltered"
        data-testid="library-no-results"
        class="rounded-lg bg-neutral-800 p-10 text-center text-neutral-300"
      >
        <p class="mb-2 text-lg">No movies match your filters.</p>
        <p class="mb-4 text-sm text-neutral-400">Try a different search or clear filters.</p>
        <button
          type="button"
          data-testid="library-no-results-clear"
          class="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-500"
          @click="store.resetFilters()"
        >
          Clear filters
        </button>
      </div>

      <div
        v-else
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        <MovieCard
          v-for="m in store.list"
          :key="m.id"
          :movie="m"
          @open="router.push(`/movie/${$event}`)"
        />
      </div>
    </template>
  </div>
</template>
