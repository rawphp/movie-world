<script setup lang="ts">
import { useLibraryStore } from '../stores/library'
import type { SortKey } from '../lib/filtering'

const store = useLibraryStore()
const sortOptions: Array<[SortKey, string]> = [
  ['title', 'Title'],
  ['year', 'Year'],
  ['rating', 'Rating'],
  ['lastWatched', 'Last watched']
]
</script>

<template>
  <div
    class="hide-scrollbar flex flex-wrap items-center gap-2 rounded-full bg-neutral-800 p-3 text-sm backdrop-blur-xl"
  >
    <input
      data-testid="filter-search"
      :value="store.filters.search"
      placeholder="Search…"
      class="w-48 rounded-full bg-neutral-700 px-3 py-1 text-white placeholder-neutral-400"
      @input="store.setFilter({ search: ($event.target as HTMLInputElement).value })"
    />
    <select
      data-testid="filter-genre"
      :value="store.filters.genre ?? ''"
      class="rounded-full bg-neutral-700 px-2 py-1 text-white"
      @change="store.setFilter({ genre: ($event.target as HTMLSelectElement).value || null })"
    >
      <option value="">All genres</option>
      <option v-for="g in store.allGenres" :key="g" :value="g">{{ g }}</option>
    </select>
    <select
      data-testid="filter-year"
      :value="store.filters.year ?? ''"
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
    <select
      data-testid="filter-certification"
      :value="store.filters.certification ?? ''"
      class="rounded-full bg-neutral-700 px-2 py-1 text-white"
      @change="
        store.setFilter({ certification: ($event.target as HTMLSelectElement).value || null })
      "
    >
      <option value="">All ratings</option>
      <option v-for="c in store.allCertifications" :key="c" :value="c">{{ c }}</option>
    </select>
    <select
      data-testid="filter-minrating"
      :value="store.filters.minRating ?? ''"
      class="rounded-full bg-neutral-700 px-2 py-1 text-white"
      @change="
        store.setFilter({
          minRating: ($event.target as HTMLSelectElement).value
            ? Number(($event.target as HTMLSelectElement).value)
            : null
        })
      "
    >
      <option value="">Any score</option>
      <option v-for="r in [9, 8, 7, 6, 5]" :key="r" :value="r">★ {{ r / 2 }}+</option>
    </select>
    <select
      data-testid="filter-actor"
      :value="store.filters.actor ?? ''"
      class="max-w-40 rounded-full bg-neutral-700 px-2 py-1 text-white"
      @change="store.setFilter({ actor: ($event.target as HTMLSelectElement).value || null })"
    >
      <option value="">All actors</option>
      <option v-for="a in store.allActors" :key="a" :value="a">{{ a }}</option>
    </select>
    <select
      data-testid="filter-watched"
      :value="store.filters.watched"
      class="rounded-full bg-neutral-700 px-2 py-1 text-white"
      @change="
        store.setFilter({
          watched: ($event.target as HTMLSelectElement).value as 'all' | 'watched' | 'unwatched'
        })
      "
    >
      <option value="all">All</option>
      <option value="watched">Watched</option>
      <option value="unwatched">Unwatched</option>
    </select>
    <span class="ml-auto flex items-center gap-1 text-neutral-400">
      Sort:
      <select
        data-testid="filter-sort"
        :value="store.sort"
        class="rounded-full bg-neutral-700 px-2 py-1 text-white"
        @change="store.setSort(($event.target as HTMLSelectElement).value as SortKey)"
      >
        <option v-for="[k, label] in sortOptions" :key="k" :value="k">{{ label }}</option>
      </select>
    </span>
    <button
      class="rounded-full px-2 py-1 text-primary text-sky-400 hover:text-sky-300"
      @click="store.resetFilters()"
    >
      Clear
    </button>
  </div>
</template>
