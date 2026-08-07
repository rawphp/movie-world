<script setup lang="ts">
import { computed } from 'vue'
import type { MovieRecord } from '../../../shared/types'
import { displayPosterPath } from '../../../shared/display-art'
import { artSrc } from '../lib/art'
import { formatLastWatchedRelative } from '../lib/format'
import StarRating from './StarRating.vue'

const props = defineProps<{ movie: MovieRecord }>()
const emit = defineEmits<{ open: [id: string]; fixMatch: [id: string] }>()

const title = computed(() => props.movie.title ?? props.movie.parsedTitle)
const year = computed(() => props.movie.year ?? props.movie.parsedYear)
const titleWithYear = computed(() =>
  year.value != null ? `${title.value} (${year.value})` : title.value
)
const poster = computed(() => artSrc(displayPosterPath(props.movie)))
const actors = computed(() =>
  props.movie.cast
    .slice(0, 2)
    .map((c) => c.name)
    .join(', ')
)
const lastWatched = computed(() => formatLastWatchedRelative(props.movie.lastPlayedAt))
const isUnmatched = computed(() => props.movie.matchStatus === 'unmatched')

const ariaLabel = computed(() => {
  const bits = [titleWithYear.value]
  if (isUnmatched.value) bits.push('needs match')
  if (props.movie.fileMissing) bits.push('file missing')
  if (props.movie.fetchFailed) bits.push('fetch failed')
  return bits.filter(Boolean).join(', ')
})

const retry = (): void => {
  void window.api.retryFetch(props.movie.id)
}

const open = (): void => {
  emit('open', props.movie.id)
}

const onFixMatch = (): void => {
  emit('fixMatch', props.movie.id)
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    open()
  }
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    data-testid="movie-card"
    :aria-label="ariaLabel"
    class="group cursor-pointer overflow-hidden rounded-xl bg-neutral-800 shadow transition hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
    @click="open"
    @keydown="onKeydown"
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
        data-testid="poster-fallback"
        class="flex h-full flex-col items-center justify-center gap-1 p-3 text-center text-sm text-neutral-500"
        aria-hidden="true"
      >
        <span class="text-2xl opacity-60">🎬</span>
        <span>No poster</span>
      </div>

      <span
        v-if="movie.matchStatus === 'pending'"
        data-testid="badge-pending"
        class="absolute left-1 top-1 animate-pulse rounded-full bg-sky-600 px-1.5 py-0.5 text-xs font-medium uppercase text-white"
        >Fetching…</span
      >
      <span
        v-if="isUnmatched"
        data-testid="badge-unmatched"
        class="absolute left-1 top-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-medium uppercase text-black"
        title="Use Fix match to pick the correct TMDB title"
        >Needs match</span
      >
      <span
        v-if="movie.fetchFailed"
        data-testid="badge-fetch-failed"
        class="absolute left-1 top-8 inline-flex items-center gap-1 rounded-full bg-red-700 px-1.5 py-0.5 text-xs font-medium uppercase text-white"
      >
        Fetch failed
        <button type="button" class="underline" @click.stop="retry">Retry</button>
      </span>
      <span
        v-if="movie.fileMissing"
        data-testid="badge-missing"
        class="absolute right-1 top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-medium uppercase text-white"
        title="The video file is not on disk"
        >File missing</span
      >
      <span
        v-if="movie.sidecarWriteFailed"
        data-testid="badge-unsaved"
        class="absolute right-1 top-8 rounded-full bg-orange-500 px-1.5 py-0.5 text-xs font-medium uppercase text-black"
        title="Metadata could not be written next to the file"
        >Not saved</span
      >

      <button
        v-if="isUnmatched"
        type="button"
        data-testid="card-fix-match"
        class="absolute bottom-1 left-1 z-10 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-black shadow-md hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
        @click.stop="onFixMatch"
      >
        Fix match
      </button>

      <span
        v-if="movie.certificationAu"
        class="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white backdrop-blur-md"
        >{{ movie.certificationAu }}</span
      >
    </div>

    <div class="space-y-0.5 p-2 text-sm">
      <div class="truncate font-medium text-white" :title="titleWithYear">
        {{ title
        }}<span v-if="year != null" class="font-normal text-neutral-400"> ({{ year }})</span>
      </div>
      <div class="flex items-center justify-between text-neutral-400">
        <span class="sr-only">{{ year ?? 'Unknown year' }}</span>
        <StarRating :vote-average="movie.voteAverage" />
      </div>
      <div v-if="actors" class="truncate text-xs text-neutral-400">{{ actors }}</div>
      <div class="text-xs text-neutral-500">
        {{ lastWatched === 'never' ? 'Not watched' : `Watched: ${lastWatched}` }}
      </div>
    </div>
  </div>
</template>
