<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div
    data-testid="not-found"
    class="mx-auto max-w-md space-y-4 py-16 text-center text-neutral-300"
  >
    <p class="text-lg text-white">That page doesn’t exist.</p>
    <p class="text-sm text-neutral-400">
      The link may be outdated, or the movie was removed from your library.
    </p>
    <button
      type="button"
      data-testid="not-found-home"
      class="rounded bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500"
      @click="router.push('/')"
    >
      Back to library
    </button>
  </div>
</template>
