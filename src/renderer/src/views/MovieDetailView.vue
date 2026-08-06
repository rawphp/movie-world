<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Keybindings } from '../../../shared/types'
import { matchesCombo } from '../../../shared/keybindings'
import { displayFanartPath, displayPosterPath } from '../../../shared/display-art'
import { useLibraryStore } from '../stores/library'
import { artSrc } from '../lib/art'
import { formatFileSize, formatWatchSummary } from '../lib/format'
import { adjacentMovieId, type MovieNavDirection } from '../lib/movie-nav'
import StarRating from '../components/StarRating.vue'
import FixMatchDialog from '../components/FixMatchDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useLibraryStore()
const api = window.api

const fixing = ref(false)
const playing = ref(false)
const keybindings = ref<Keybindings | null>(null)
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
let mounted = false

const movie = computed(() => store.movies[String(route.params.id)])
const title = computed(() => movie.value?.title ?? movie.value?.parsedTitle ?? '')
const year = computed(() => movie.value?.year ?? movie.value?.parsedYear ?? null)
const fanart = computed(() => artSrc(movie.value ? displayFanartPath(movie.value) : null))
const poster = computed(() => artSrc(movie.value ? displayPosterPath(movie.value) : null))
const backgroundArt = computed(() => fanart.value || poster.value)
const sizeLabel = computed(() => (movie.value ? formatFileSize(movie.value.fileSize) : ''))
const watchSummary = computed(() =>
  movie.value ? formatWatchSummary(movie.value.playCount, movie.value.lastPlayedAt) : ''
)
const trailerWatchUrl = computed(() =>
  movie.value?.trailerYoutubeKey
    ? `https://www.youtube.com/watch?v=${movie.value.trailerYoutubeKey}`
    : ''
)
const trailerEmbedUrl = computed(() => {
  if (!movie.value?.trailerYoutubeKey) {
    return ''
  }

  const origin = 'https://www.youtube-nocookie.com'
  const params = new URLSearchParams({
    origin,
    rel: '0',
    playsinline: '1'
  })

  return `${origin}/embed/${movie.value.trailerYoutubeKey}?${params.toString()}`
})

async function play(): Promise<void> {
  if (!movie.value || movie.value.fileMissing || playing.value) return
  playing.value = true
  try {
    await api.play(movie.value.id)
  } finally {
    // Keep “Opening…” visible briefly so the user sees feedback before the OS player takes over.
    window.setTimeout(() => {
      if (mounted) playing.value = false
    }, 900)
  }
}
function reveal(): void {
  if (movie.value) void api.revealFile(movie.value.id)
}
function retry(): void {
  if (movie.value) void api.retryFetch(movie.value.id)
}
function goBack(): void {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/')
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !=
      null
  )
}

const prevId = computed(() => adjacentMovieId(store.list, String(route.params.id), 'prev'))
const nextId = computed(() => adjacentMovieId(store.list, String(route.params.id), 'next'))

function navigate(direction: MovieNavDirection): void {
  const id = direction === 'prev' ? prevId.value : nextId.value

  if (id) {
    void router.push({ name: 'movie', params: { id } })
  }
}

function formatCombo(combo: string): string {
  return combo
    .split('+')
    .map((part) => {
      if (part === 'Mod') return isMac ? '⌘' : 'Ctrl'
      if (part === 'Alt') return isMac ? 'Option' : 'Alt'
      if (part === 'ArrowLeft') return '←'
      if (part === 'ArrowRight') return '→'
      if (part === 'ArrowUp') return '↑'
      if (part === 'ArrowDown') return '↓'
      return part
    })
    .join('+')
}

function onKeydown(event: KeyboardEvent): void {
  if (fixing.value || isEditableTarget(event.target)) {
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    goBack()
    return
  }

  if (!keybindings.value) {
    return
  }

  if (matchesCombo(event, keybindings.value.prevMovie, isMac)) {
    event.preventDefault()
    navigate('prev')
    return
  }

  if (matchesCombo(event, keybindings.value.nextMovie, isMac)) {
    event.preventDefault()
    navigate('next')
  }
}

// Keep the hero in view when flipping with prev/next.
watch(
  () => route.params.id,
  () => {
    window.scrollTo(0, 0)
  }
)

onMounted(async () => {
  mounted = true
  const settings = await api.getSettings()

  if (!mounted) {
    return
  }

  keybindings.value = settings.keybindings
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  mounted = false
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    v-if="!movie"
    data-testid="movie-not-found"
    class="mx-auto max-w-md space-y-3 py-16 text-center text-neutral-300"
  >
    <p class="text-lg text-white">Movie not found.</p>
    <p class="text-sm text-neutral-400">It may have been removed from your library folders.</p>
    <button
      type="button"
      data-testid="movie-not-found-home"
      class="rounded bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500"
      @click="router.push('/')"
    >
      Back to library
    </button>
  </div>

  <div v-else class="relative -mx-6 -my-6 min-h-[calc(100vh-4rem)] bg-neutral-950 text-neutral-100">
    <!-- Hero: art + title only. Actions live on a solid bar below so they never fight fanart. -->
    <section
      data-testid="detail-hero"
      class="relative h-[42vh] min-h-[320px] overflow-hidden bg-neutral-950"
    >
      <div
        v-if="backgroundArt"
        data-testid="detail-hero-art"
        class="pointer-events-none absolute inset-0 bg-cover bg-center"
        :style="backgroundArt ? { backgroundImage: `url('${backgroundArt}')` } : undefined"
      />
      <div
        v-else
        data-testid="detail-hero-fallback"
        class="pointer-events-none absolute inset-0 bg-neutral-950"
      />
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-b from-transparent via-neutral-950/70 to-neutral-950"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-neutral-950/95 via-neutral-950/55 to-transparent md:w-3/4"
        aria-hidden="true"
      />

      <div
        data-testid="detail-hero-content"
        class="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-between px-6 py-6"
      >
        <button
          type="button"
          data-testid="detail-back"
          class="w-fit rounded-full bg-black/55 px-3 py-1 text-sm text-white shadow-lg shadow-black/30 backdrop-blur-sm hover:bg-black/75"
          @click="goBack"
        >
          ← Back
        </button>

        <div class="max-w-3xl pb-4">
          <h1 class="text-3xl font-bold text-white drop-shadow-lg md:text-4xl">
            {{ title }}
            <span class="font-normal text-neutral-300">({{ year ?? '—' }})</span>
          </h1>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-100 drop-shadow">
            <StarRating :vote-average="movie.voteAverage" />
            <span v-if="movie.runtime">· {{ movie.runtime }} min</span>
            <span
              v-if="movie.certificationAu"
              class="rounded border border-neutral-400 px-1.5 py-0.5 text-xs"
              >{{ movie.certificationAu }}</span
            >
            <span v-if="movie.genres.length">· {{ movie.genres.join(' · ') }}</span>
          </div>
          <p
            v-if="movie.matchStatus === 'unmatched'"
            data-testid="detail-unmatched-hint"
            class="mt-3 text-xs text-amber-200"
          >
            This file was not matched to TMDB — use Fix match to pick the correct title.
          </p>
          <p
            v-if="movie.fileMissing"
            data-testid="detail-file-missing-hint"
            class="mt-3 text-xs text-red-300"
          >
            Video file is missing — reconnect the folder or restore the file to play.
          </p>
        </div>
      </div>
    </section>

    <!-- Solid action bar: primary + secondary left, browse nav right. Never over fanart. -->
    <div data-testid="detail-action-bar" class="border-b border-neutral-800/80 bg-neutral-950">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-4">
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <button
            v-if="movie.matchStatus === 'unmatched'"
            type="button"
            data-testid="detail-fix-match"
            class="inline-flex items-center gap-1 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
            @click="fixing = true"
          >
            Fix match
          </button>
          <button
            type="button"
            data-testid="detail-play"
            class="inline-flex items-center gap-1.5 rounded-full bg-cyan-400 px-6 py-2.5 text-sm font-semibold text-neutral-950 shadow-lg shadow-cyan-400/20 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400 disabled:shadow-none"
            :disabled="movie.fileMissing || playing"
            :title="
              movie.fileMissing ? 'Video file is missing from disk' : 'Play in your default player'
            "
            :aria-label="
              movie.fileMissing
                ? 'Play unavailable — video file is missing'
                : playing
                  ? `Opening ${title}`
                  : `Play ${title}`
            "
            @click="play"
          >
            {{ playing ? 'Opening…' : '▶ Play' }}
          </button>
          <button
            v-if="movie.matchStatus !== 'unmatched'"
            type="button"
            data-testid="detail-fix-match"
            class="rounded-full bg-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-100 ring-1 ring-white/15 hover:bg-neutral-700"
            @click="fixing = true"
          >
            Fix match
          </button>
          <button
            v-if="movie.fetchFailed"
            type="button"
            data-testid="detail-retry-fetch"
            class="rounded-full bg-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-100 ring-1 ring-white/15 hover:bg-neutral-700"
            @click="retry"
          >
            Retry fetch
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="detail-prev"
            class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-neutral-100 ring-1 ring-white/10 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-35"
            :disabled="!prevId"
            :title="keybindings ? formatCombo(keybindings.prevMovie) : 'Previous movie'"
            aria-label="Previous movie"
            @click="navigate('prev')"
          >
            ‹
          </button>
          <button
            type="button"
            data-testid="detail-next"
            class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-neutral-100 ring-1 ring-white/10 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-35"
            :disabled="!nextId"
            :title="keybindings ? formatCombo(keybindings.nextMovie) : 'Next movie'"
            aria-label="Next movie"
            @click="navigate('next')"
          >
            ›
          </button>
        </div>
      </div>
      <p
        v-if="keybindings"
        data-testid="detail-shortcut-hint"
        class="mx-auto max-w-7xl px-6 pb-3 text-xs text-neutral-500"
      >
        Keyboard:
        {{ formatCombo(keybindings.prevMovie) }} previous ·
        {{ formatCombo(keybindings.nextMovie) }} next · Esc back
      </p>
    </div>

    <div
      data-testid="detail-body"
      class="relative z-0 mx-auto grid max-w-7xl gap-6 bg-neutral-950 px-6 pb-10 pt-6 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]"
    >
      <div class="space-y-4">
        <img
          v-if="poster"
          :src="poster"
          :alt="title"
          class="aspect-[2/3] w-full rounded-lg object-cover shadow-xl shadow-black/50"
        />
        <div
          v-else
          class="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-neutral-800 p-4 text-center text-sm text-neutral-400"
        >
          {{ title }}
        </div>

        <div
          data-testid="detail-file-info"
          class="flex flex-wrap items-center gap-2 text-xs text-neutral-400"
          :title="movie.filePath"
        >
          <span data-testid="detail-file-size">{{ sizeLabel }}</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            data-testid="detail-reveal"
            class="text-sky-400 hover:text-sky-300 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:no-underline"
            :disabled="movie.fileMissing"
            :title="movie.fileMissing ? 'File is missing from disk' : 'Reveal in Finder'"
            @click="reveal"
          >
            Reveal in Finder
          </button>
        </div>
      </div>

      <div class="min-w-0 space-y-5 md:pt-1">
        <p data-testid="detail-watch-summary" class="text-xs text-neutral-500">
          {{ watchSummary }}
        </p>

        <section v-if="movie.overview">
          <h2 class="mb-1 text-lg font-semibold text-white">Synopsis</h2>
          <p class="text-sm leading-relaxed text-neutral-300">{{ movie.overview }}</p>
        </section>

        <section v-if="movie.cast.length">
          <h2 class="mb-1 text-lg font-semibold text-white">Stars</h2>
          <p class="text-sm text-neutral-300">
            {{ movie.cast.map((c) => c.name).join(', ') }}
          </p>
        </section>

        <section>
          <h2 class="mb-2 text-lg font-semibold text-white">Trailer</h2>
          <div
            v-if="movie.trailerYoutubeKey"
            data-testid="detail-trailer-frame"
            class="aspect-video w-full max-w-2xl overflow-hidden rounded-lg bg-black shadow-2xl shadow-black/40"
          >
            <iframe
              :src="trailerEmbedUrl"
              :title="`${title} trailer`"
              class="h-full w-full"
              frameborder="0"
              referrerpolicy="strict-origin-when-cross-origin"
              allowfullscreen
              allow="
                accelerometer;
                autoplay;
                clipboard-write;
                encrypted-media;
                gyroscope;
                picture-in-picture;
              "
            />
          </div>
          <a
            v-if="movie.trailerYoutubeKey"
            data-testid="detail-trailer-youtube-link"
            :href="trailerWatchUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-2 inline-flex text-sm text-sky-400 hover:text-sky-300"
          >
            Open trailer on YouTube
          </a>
          <p v-else class="text-sm text-neutral-500">No trailer found for this movie.</p>
        </section>
      </div>
    </div>

    <FixMatchDialog v-if="fixing" :movie="movie" @close="fixing = false" />
  </div>
</template>
