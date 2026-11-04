<script setup lang="ts">
import { computed } from 'vue';
import * as icons from '../icons';
import { formatClock } from '../stats';
import PixelIcon from './PixelIcon.vue';
import ProgressBar from './ProgressBar.vue';

const props = defineProps<{ remaining: number; progress: number; running: boolean; started: boolean }>();
defineEmits<{ toggle: []; restart: []; skip: [] }>();

const clock = computed(() => formatClock(props.remaining));
</script>

<template>
  <main class="hud bottom-center">
    <div class="time">{{ clock }}</div>
    <ProgressBar :progress="progress" />
    <div class="chrome row controls">
      <button class="btn icon-btn" title="Recommencer la phase (R)" @click="$emit('restart')">
        <PixelIcon :svg="icons.restart" />
      </button>
      <button class="btn btn-main" title="Démarrer / pause (Espace)" @click="$emit('toggle')">
        <PixelIcon :svg="running ? icons.pause : icons.play" />
        {{ running ? 'Pause' : started ? 'Reprendre' : 'Go' }}
      </button>
      <button class="btn icon-btn" title="Passer (N)" @click="$emit('skip')">
        <PixelIcon :svg="icons.next" />
      </button>
    </div>
  </main>
</template>
