<script setup lang="ts">
import { computed } from 'vue'
import { useLibraryStore } from '../stores/library'
import type { IssueFilter, SortKey } from '../lib/filtering'

const store = useLibraryStore()
const sortOptions: Array<[SortKey, string]> = [
  ['title', 'Title'],
  ['year', 'Year'],
  ['rating', 'Rating'],
  ['lastWatched', 'Last watched']
]

const resultCount = computed(() => store.list.length)
const totalCount = computed(() => store.all.length)
const filtersActive = computed(() => store.hasActiveFilters)

const isCertSelected = (cert: string): boolean => store.filters.certification.includes(cert)

const toggleCertification = (cert: string): void => {
  const current = store.filters.certification
  const next = current.includes(cert) ? current.filter((c) => c !== cert) : [...current, cert]
  store.setFilter({ certification: next })
}
</script>

<template>
  <div
    data-testid="filter-bar"
    class="sticky top-[61px] z-[5] -mx-1 space-y-2 bg-neutral-900/95 px-1 pb-2 pt-1 backdrop-blur-xl"
  >
    <div
      class="hide-scrollbar flex flex-wrap items-center gap-2 rounded-full bg-neutral-800 p-3 text-sm backdrop-blur-xl"
    >
      <input
        data-testid="filter-search"
        :value="store.filters.search"
        type="search"
        aria-label="Search movies"
        placeholder="Search title or actor…"
        class="w-52 rounded-full bg-neutral-700 px-3 py-1 text-white placeholder-neutral-400"
        @input="store.setFilter({ search: ($event.target as HTMLInputElement).value })"
      />
      <select
        data-testid="filter-genre"
        :value="store.filters.genre ?? ''"
        aria-label="Filter by genre"
        class="rounded-full bg-neutral-700 px-2 py-1 text-white"
        @change="store.setFilter({ genre: ($event.target as HTMLSelectElement).value || null })"
      >
        <option value="">All genres</option>
        <option v-for="g in store.allGenres" :key="g" :value="g">{{ g }}</option>
      </select>
      <select
        data-testid="filter-year"
        :value="store.filters.year ?? ''"
        aria-label="Filter by year"
        class="rounded-full bg-neutral-700 px-2 py-1 text-white"
        @change="
          store.setFilter({
            year: ($event.target as HTMLSelectElement).value
              ? Number(($event.target as HTMLSelectElement).value)
              : null
          })
        "
      >
        <option value="">All years</option>
        <option v-for="y in store.allYears" :key="y" :value="y">{{ y }}</option>
      </select>
      <div
        data-testid="filter-certification"
        role="group"
        aria-label="Australian classification multi-select"
        class="flex flex-wrap items-center gap-1"
      >
        <button
          v-for="c in store.allCertifications"
          :key="c"
          type="button"
          :data-testid="`filter-cert-chip-${c}`"
          :aria-pressed="isCertSelected(c)"
          :aria-label="`Classification ${c}`"
          class="rounded-full px-2 py-1 text-xs transition-colors"
          :class="
            isCertSelected(c)
              ? 'bg-sky-600 text-white'
              : 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600'
          "
          @click="toggleCertification(c)"
        >
          {{ c }}
        </button>
      </div>
      <select
        data-testid="filter-minrating"
        :value="store.filters.minRating ?? ''"
        aria-label="Filter by minimum TMDB score"
        class="rounded-full bg-neutral-700 px-2 py-1 text-white"
        @change="
          store.setFilter({
            minRating: ($event.target as HTMLSelectElement).value
              ? Number(($event.target as HTMLSelectElement).value)
              : null
          })
        "
      >
        <option value="">Any TMDB score</option>
        <option v-for="r in [9, 8, 7, 6, 5]" :key="r" :value="r">{{ r.toFixed(1) }}+</option>
      </select>
      <input
        data-testid="filter-actor"
        :value="store.filters.actor ?? ''"
        type="search"
        aria-label="Filter by actor name"
        placeholder="Actor…"
        class="w-36 rounded-full bg-neutral-700 px-3 py-1 text-white placeholder-neutral-400"
        @input="
          store.setFilter({
            actor: ($event.target as HTMLInputElement).value.trim()
              ? ($event.target as HTMLInputElement).value
              : null
          })
        "
      />
      <select
        data-testid="filter-watched"
        :value="store.filters.watched"
        aria-label="Filter by watched status"
        class="rounded-full bg-neutral-700 px-2 py-1 text-white"
        @change="
          store.setFilter({
            watched: ($event.target as HTMLSelectElement).value as 'all' | 'watched' | 'unwatched'
          })
        "
      >
        <option value="all">Any status</option>
        <option value="watched">Watched</option>
        <option value="unwatched">Unwatched</option>
      </select>
      <select
        data-testid="filter-issue"
        :value="store.filters.issue"
        aria-label="Filter by library issues"
        class="rounded-full bg-neutral-700 px-2 py-1 text-white"
        @change="
          store.setFilter({
            issue: ($event.target as HTMLSelectElement).value as IssueFilter
          })
        "
      >
        <option value="all">All movies</option>
        <option value="unmatched">Needs match</option>
        <option value="missing">File missing</option>
        <option value="fetchFailed">Fetch failed</option>
      </select>
      <span class="ml-auto flex items-center gap-1 text-neutral-400">
        <label for="filter-sort" class="sr-only">Sort movies</label>
        Sort:
        <select
          id="filter-sort"
          data-testid="filter-sort"
          :value="store.sort"
          aria-label="Sort movies"
          class="rounded-full bg-neutral-700 px-2 py-1 text-white"
          @change="store.setSort(($event.target as HTMLSelectElement).value as SortKey)"
        >
          <option v-for="[k, label] in sortOptions" :key="k" :value="k">{{ label }}</option>
        </select>
      </span>
      <button
        v-if="filtersActive"
        type="button"
        data-testid="filter-clear"
        class="rounded-full px-2 py-1 text-sky-400 hover:text-sky-300"
        @click="store.resetFilters()"
      >
        Clear filters
      </button>
    </div>
    <p data-testid="library-result-count" class="px-1 text-xs text-neutral-400">
      <template v-if="filtersActive">
        Showing {{ resultCount }} of {{ totalCount }}
        {{ totalCount === 1 ? 'movie' : 'movies' }}
      </template>
      <template v-else> {{ totalCount }} {{ totalCount === 1 ? 'movie' : 'movies' }} </template>
    </p>
  </div>
</template>
