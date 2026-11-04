<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ progress: number; segments?: number }>(), { segments: 16 });

// Chaque case se remplit progressivement, de gauche à droite.
const fills = computed(() =>
  Array.from({ length: props.segments }, (_, i) =>
    Math.min(1, Math.max(0, props.progress * props.segments - i)),
  ),
);
</script>

<template>
  <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(progress * 100)">
    <div v-for="(fill, i) in fills" :key="i" class="seg">
      <div class="seg-fill" :style="{ transform: `scaleX(${fill})` }" />
    </div>
  </div>
</template>
