<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLibraryStore } from '../stores/library'
import { artSrc } from '../lib/art'
import StarRating from '../components/StarRating.vue'
import FixMatchDialog from '../components/FixMatchDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useLibraryStore()
const api = window.api

const fixing = ref(false)

const movie = computed(() => store.movies[String(route.params.id)])
const title = computed(() => movie.value?.title ?? movie.value?.parsedTitle ?? '')
const year = computed(() => movie.value?.year ?? movie.value?.parsedYear ?? null)
const fanart = computed(() => artSrc(movie.value?.fanartPath ?? null))
const poster = computed(() => artSrc(movie.value?.posterPath ?? null))
const backgroundArt = computed(() => fanart.value || poster.value)
const sizeGb = computed(() =>
  movie.value ? `${(movie.value.fileSize / 1024 ** 3).toFixed(2)} GB` : ''
)
const lastWatched = computed(() =>
  movie.value?.lastPlayedAt ? new Date(movie.value.lastPlayedAt).toLocaleString() : 'never'
)

function play(): void {
  if (movie.value) void api.play(movie.value.id)
}
function reveal(): void {
  if (movie.value) void api.revealFile(movie.value.id)
}
function retry(): void {
  if (movie.value) void api.retryFetch(movie.value.id)
}
</script>

<template>
  <div v-if="!movie" class="mx-auto max-w-2xl py-16 text-center text-neutral-400">
    Movie not found.
    <button class="ml-1 underline hover:text-white" @click="router.push('/')">
      Back to library
    </button>
  </div>

  <div
    v-else
    class="relative -mx-6 -my-6 min-h-[calc(100vh-4rem)] overflow-hidden bg-neutral-950 px-6 py-6"
  >
    <div class="pointer-events-none fixed inset-0 z-0 bg-neutral-950" aria-hidden="true">
      <div
        data-testid="detail-art-background"
        class="pointer-events-none absolute inset-0 scale-[1.02] bg-cover bg-center opacity-45 blur-[1px]"
        :class="backgroundArt ? '' : 'bg-neutral-950'"
        :style="backgroundArt ? { backgroundImage: `url('${backgroundArt}')` } : undefined"
      />
      <div class="pointer-events-none absolute inset-0 bg-neutral-950/55" />
      <div
        class="pointer-events-none absolute inset-y-0 left-1/2 w-[min(1180px,88vw)] -translate-x-1/2 bg-neutral-950/85 shadow-[0_0_150px_110px_rgba(10,10,11,0.92)]"
      />
      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-b from-neutral-950/30 via-transparent to-neutral-950"
      />
    </div>

    <!-- Header: title metadata over the shared page artwork background -->
    <div class="relative z-10 mx-auto mb-8 max-w-7xl pt-2">
      <button
        class="rounded-full bg-black/60 px-3 py-1 text-sm text-white shadow-lg shadow-black/30 hover:bg-black/80"
        @click="router.push('/')"
      >
        ← Back
      </button>
      <div class="mt-40 max-w-4xl">
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
      </div>
    </div>

    <!-- Two-column body -->
    <div
      data-testid="detail-body"
      class="relative z-10 mx-auto grid max-w-7xl gap-6 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]"
    >
      <!-- Left: poster + tech-info card -->
      <div class="space-y-4">
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

        <div class="space-y-1 rounded-lg bg-neutral-800 p-3 text-xs text-neutral-300">
          <div class="flex justify-between gap-2">
            <span class="text-neutral-500">File Size</span>
            <span>{{ sizeGb }}</span>
          </div>
          <div class="break-all text-neutral-400">{{ movie.filePath }}</div>
          <button class="mt-1 text-sky-400 hover:text-sky-300" @click="reveal">
            Reveal in Finder
          </button>
        </div>
      </div>

      <!-- Right: actions, synopsis, cast, trailer -->
      <div class="min-w-0 space-y-5">
        <div class="flex flex-wrap items-center gap-2">
          <button
            class="inline-flex items-center gap-1 rounded-full bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="movie.fileMissing"
            @click="play"
          >
            ▶ Play
          </button>
          <button
            class="rounded-full bg-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-600"
            @click="fixing = true"
          >
            Fix match
          </button>
          <button
            v-if="movie.fetchFailed"
            class="rounded-full bg-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-600"
            @click="retry"
          >
            Retry fetch
          </button>
        </div>

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
            class="aspect-video w-full max-w-4xl overflow-hidden rounded-lg bg-black shadow-2xl shadow-black/40"
          >
            <iframe
              :src="`https://www.youtube.com/embed/${movie.trailerYoutubeKey}`"
              :title="`${title} trailer`"
              class="h-full w-full"
              frameborder="0"
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
          <p v-else class="text-sm text-neutral-500">No trailer found for this movie.</p>
        </section>
      </div>
    </div>

    <FixMatchDialog v-if="fixing" :movie="movie" @close="fixing = false" />
  </div>
</template>
