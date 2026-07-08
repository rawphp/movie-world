<script setup lang="ts">
import { computed } from 'vue'
import type { MovieRecord } from '../../../shared/types'
import { artSrc } from '../lib/art'
import StarRating from './StarRating.vue'

const props = defineProps<{ movie: MovieRecord }>()
defineEmits<{ open: [id: string] }>()

const title = computed(() => props.movie.title ?? props.movie.parsedTitle)
const year = computed(() => props.movie.year ?? props.movie.parsedYear)
const poster = computed(() => artSrc(props.movie.posterPath))
const actors = computed(() =>
  props.movie.cast
    .slice(0, 2)
    .map((c) => c.name)
    .join(', ')
)
const lastWatched = computed(() => {
  if (!props.movie.lastPlayedAt) return 'never'
  const days = Math.floor((Date.now() - Date.parse(props.movie.lastPlayedAt)) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
})

const retry = (): void => {
  void window.api.retryFetch(props.movie.id)
}
</script>

<template>
  <div
    class="group cursor-pointer overflow-hidden rounded-xl bg-neutral-800 shadow transition hover:scale-[1.02] hover:shadow-lg"
    @click="$emit('open', movie.id)"
  >
    <div class="relative aspect-[2/3] bg-neutral-700">
      <img
        v-if="poster"
        :src="poster"
        :alt="title"
        class="h-full w-full object-cover"
        :class="{ 'opacity-50': movie.fileMissing }"
      />
      <div
        v-else
        class="flex h-full items-center justify-center p-2 text-center text-sm text-neutral-400"
      >
        {{ title }}
      </div>

      <span
        v-if="movie.matchStatus === 'pending'"
        data-testid="badge-pending"
        class="absolute left-1 top-1 animate-pulse rounded-full bg-sky-600 px-1.5 py-0.5 text-xs font-medium uppercase text-white"
        >Fetching…</span
      >
      <span
        v-if="movie.matchStatus === 'unmatched'"
        data-testid="badge-unmatched"
        class="absolute left-1 top-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-medium uppercase text-black"
        >Needs Match</span
      >
      <span
        v-if="movie.fetchFailed"
        data-testid="badge-fetch-failed"
        class="absolute left-1 top-8 inline-flex items-center gap-1 rounded-full bg-red-700 px-1.5 py-0.5 text-xs font-medium uppercase text-white"
      >
        Fetch Failed
        <button class="underline" @click.stop="retry">Retry</button>
      </span>
      <span
        v-if="movie.fileMissing"
        data-testid="badge-missing"
        class="absolute right-1 top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-medium uppercase text-white"
        >File Missing</span
      >
      <span
        v-if="movie.sidecarWriteFailed"
        data-testid="badge-unsaved"
        class="absolute right-1 top-8 rounded-full bg-orange-500 px-1.5 py-0.5 text-xs font-medium uppercase text-black"
        >Not Saved</span
      >

      <span
        v-if="movie.certificationAu"
        class="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white backdrop-blur-md"
        >{{ movie.certificationAu }}</span
      >
    </div>

    <div class="space-y-0.5 p-2 text-sm">
      <div class="truncate font-medium text-white" :title="title">{{ title }}</div>
      <div class="flex items-center justify-between text-neutral-400">
        <span>{{ year ?? '—' }}</span>
        <StarRating :vote-average="movie.voteAverage" />
      </div>
      <div v-if="actors" class="truncate text-xs text-neutral-400">{{ actors }}</div>
      <div class="text-xs text-neutral-500">Watched: {{ lastWatched }}</div>
    </div>
  </div>
</template>
