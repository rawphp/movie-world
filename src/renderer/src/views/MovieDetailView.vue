<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Keybindings } from '../../../shared/types'
import { matchesCombo } from '../../../shared/keybindings'
import { displayFanartPath, displayPosterPath } from '../../../shared/display-art'
import { useLibraryStore } from '../stores/library'
import { artSrc } from '../lib/art'
import { adjacentMovieId, type MovieNavDirection } from '../lib/movie-nav'
import StarRating from '../components/StarRating.vue'
import FixMatchDialog from '../components/FixMatchDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useLibraryStore()
const api = window.api

const fixing = ref(false)
const keybindings = ref<Keybindings | null>(null)
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
let mounted = false

const movie = computed(() => store.movies[String(route.params.id)])
const title = computed(() => movie.value?.title ?? movie.value?.parsedTitle ?? '')
const year = computed(() => movie.value?.year ?? movie.value?.parsedYear ?? null)
const fanart = computed(() => artSrc(movie.value ? displayFanartPath(movie.value) : null))
const poster = computed(() => artSrc(movie.value ? displayPosterPath(movie.value) : null))
const backgroundArt = computed(() => fanart.value || poster.value)
const sizeGb = computed(() =>
  movie.value ? `${(movie.value.fileSize / 1024 ** 3).toFixed(2)} GB` : ''
)
const lastWatched = computed(() =>
  movie.value?.lastPlayedAt ? new Date(movie.value.lastPlayedAt).toLocaleString() : 'never'
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

function play(): void {
  if (movie.value) void api.play(movie.value.id)
}
function reveal(): void {
  if (movie.value) void api.revealFile(movie.value.id)
}
function retry(): void {
  if (movie.value) void api.retryFetch(movie.value.id)
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

function navigate(direction: MovieNavDirection): void {
  const id = adjacentMovieId(store.list, String(route.params.id), direction)

  if (id) {
    void router.push({ name: 'movie', params: { id } })
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (fixing.value || !keybindings.value || isEditableTarget(event.target)) {
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
  <div v-if="!movie" class="mx-auto max-w-2xl py-16 text-center text-neutral-400">
    Movie not found.
    <button class="ml-1 underline hover:text-white" @click="router.push('/')">
      Back to library
    </button>
  </div>

  <div v-else class="relative -mx-6 -my-6 min-h-[calc(100vh-4rem)] bg-neutral-950 text-neutral-100">
    <section
      data-testid="detail-hero"
      class="relative h-[45vh] min-h-[360px] overflow-hidden bg-neutral-950"
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
        class="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent to-neutral-950"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-neutral-950/90 via-neutral-950/45 to-transparent md:w-2/3"
        aria-hidden="true"
      />

      <div class="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-between px-6 py-6">
        <button
          class="w-fit rounded-full bg-black/45 px-3 py-1 text-sm text-white shadow-lg shadow-black/30 hover:bg-black/70"
          @click="router.push('/')"
        >
          ← Back
        </button>

        <div class="max-w-4xl pb-8">
          <h1 class="text-3xl font-bold text-white drop-shadow-lg">
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
          <div class="mt-5 flex flex-wrap items-center gap-2">
            <button
              class="inline-flex items-center gap-1 rounded-full bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="movie.fileMissing"
              @click="play"
            >
              ▶ Play
            </button>
            <button
              class="rounded-full bg-neutral-900/80 px-4 py-2 text-sm text-neutral-100 ring-1 ring-white/10 hover:bg-neutral-800"
              @click="fixing = true"
            >
              Fix match
            </button>
            <button
              v-if="movie.fetchFailed"
              class="rounded-full bg-neutral-900/80 px-4 py-2 text-sm text-neutral-100 ring-1 ring-white/10 hover:bg-neutral-800"
              @click="retry"
            >
              Retry fetch
            </button>
          </div>
        </div>
      </div>
    </section>

    <div
      data-testid="detail-body"
      class="relative z-10 mx-auto grid max-w-7xl gap-6 bg-neutral-950 px-6 pb-10 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]"
    >
      <div class="space-y-4 md:-mt-24">
        <img
          v-if="poster"
          :src="poster"
          :alt="title"
          class="aspect-[2/3] w-full rounded-lg object-cover shadow-xl"
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
          <span>{{ sizeGb }}</span>
          <span aria-hidden="true">·</span>
          <button class="text-sky-400 hover:text-sky-300" @click="reveal">Reveal in Finder</button>
        </div>
      </div>

      <div class="min-w-0 space-y-5 py-8">
        <p class="text-xs text-neutral-500">
          Watched {{ movie.playCount }}× · last played: {{ lastWatched }}
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
            Watch on YouTube
          </a>
          <p v-else class="text-sm text-neutral-500">No trailer found for this movie.</p>
        </section>
      </div>
    </div>

    <FixMatchDialog v-if="fixing" :movie="movie" @close="fixing = false" />
  </div>
</template>
