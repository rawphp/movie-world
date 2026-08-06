<script setup lang="ts">
import { useLibraryStore } from './stores/library'

const store = useLibraryStore()
</script>

<template>
  <div class="min-h-screen bg-neutral-900 text-white">
    <header
      class="sticky top-0 z-10 flex items-center gap-4 border-b border-neutral-800 bg-neutral-900/80 px-6 py-4 backdrop-blur-xl"
    >
      <RouterLink to="/" class="text-xl font-bold">🎬 Movie World</RouterLink>
      <nav class="ml-auto flex items-center gap-4 text-sm">
        <RouterLink
          to="/"
          class="text-neutral-300 hover:text-white"
          exact-active-class="text-sky-400"
        >
          Library
        </RouterLink>
        <RouterLink
          to="/settings"
          class="inline-flex items-center gap-1.5 text-neutral-300 hover:text-white"
          exact-active-class="text-sky-400"
          aria-label="Settings"
          title="Settings"
        >
          <span aria-hidden="true">⚙️</span>
          <span>Settings</span>
        </RouterLink>
      </nav>
    </header>
    <div
      v-if="store.pendingCount > 0"
      class="mx-auto max-w-[1440px] px-6 pt-4 text-sm text-sky-200"
    >
      <div class="rounded-lg bg-sky-900/40 px-3 py-2">
        Fetching metadata for {{ store.pendingCount }} movies…
      </div>
    </div>
    <main class="mx-auto max-w-[1440px] px-6 py-6"><RouterView /></main>
  </div>
</template>
