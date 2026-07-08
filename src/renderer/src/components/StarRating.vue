<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ voteAverage: number | null }>()

// voteAverage is a 0–10 TMDB score; render it as 0–5 stars with half-star rounding.
const stars = computed(() => (props.voteAverage == null ? 0 : Math.round(props.voteAverage) / 2))
</script>

<template>
  <span
    v-if="voteAverage != null"
    class="inline-flex items-center gap-0.5 text-amber-400"
    :title="`${voteAverage.toFixed(1)} / 10`"
  >
    <span v-for="i in 5" :key="i">{{ i <= stars ? '★' : i - 0.5 === stars ? '⯨' : '☆' }}</span>
  </span>
  <span v-else class="text-neutral-500">—</span>
</template>
