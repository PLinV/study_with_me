<script setup lang="ts">
import * as icons from '../icons';
import type { Phase } from '../timer';
import PixelIcon from './PixelIcon.vue';

defineProps<{ phase: Phase; index: number; total: number }>();

const LABELS: Record<Phase, string> = {
  focus: 'Pomodoro',
  short_break: 'Pause',
  long_break: 'Longue pause',
};
</script>

<template>
  <section class="hud top-right">
    <div>
      <div class="title">{{ LABELS[phase] }}</div>
      <div class="subtitle">{{ index }}/{{ total }}</div>
    </div>
    <PixelIcon class="icon-lg" :svg="phase === 'focus' ? icons.tomato : icons.cup" />
  </section>
</template>
