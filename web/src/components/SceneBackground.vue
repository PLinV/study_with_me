<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { BUILTIN_PREFIX } from '../scenes';
import { startCampfireScene } from '../pixelScenes/campfire';

const props = defineProps<{ src: string | null }>();
const canvas = ref<HTMLCanvasElement>();

const BUILTIN_SCENES: Record<string, (canvas: HTMLCanvasElement) => () => void> = {
  campfire: startCampfireScene,
};

// Fondu enchaîné entre deux copies de la vidéo pour masquer le raccord de la boucle.
const FADE_S = 1.5;
const videos: (HTMLVideoElement | null)[] = [null, null];
const front = ref(0);
const fading = ref(false);
let fadeTimer: number | undefined;

let stopBuiltin: (() => void) | null = null;

function builtinName(src: string | null): string | null {
  return src?.startsWith(BUILTIN_PREFIX) ? src.slice(BUILTIN_PREFIX.length) : null;
}

function startCrossfade(): void {
  if (fading.value) return;
  const next = 1 - front.value;
  const incoming = videos[next];
  if (!incoming) return;
  fading.value = true;
  incoming.currentTime = 0;
  void incoming.play().catch(() => {});
  front.value = next;
  fadeTimer = window.setTimeout(() => {
    videos[1 - next]?.pause();
    fading.value = false;
  }, FADE_S * 1000);
}

function onTimeUpdate(i: number): void {
  const v = videos[i];
  if (i !== front.value || !v?.duration) return;
  if (v.duration - v.currentTime <= FADE_S) startCrossfade();
}

function onEnded(i: number): void {
  // filet de sécurité si timeupdate est arrivé trop tard
  if (i === front.value) startCrossfade();
}

function resetVideos(): void {
  window.clearTimeout(fadeTimer);
  fading.value = false;
  front.value = 0;
  videos[1]?.pause();
  void videos[0]?.play().catch(() => {});
}

watch(
  [() => props.src, canvas],
  () => {
    stopBuiltin?.();
    stopBuiltin = null;
    const name = builtinName(props.src);
    if (name && canvas.value && BUILTIN_SCENES[name]) {
      stopBuiltin = BUILTIN_SCENES[name](canvas.value);
    } else if (props.src && !name) {
      resetVideos();
    }
  },
  { flush: 'post' },
);

onUnmounted(() => {
  stopBuiltin?.();
  window.clearTimeout(fadeTimer);
});
</script>

<template>
  <canvas v-if="builtinName(src)" ref="canvas" class="scene pixel-scene" />
  <div v-else-if="src" class="scene video-stack">
    <video
      v-for="i in [0, 1]"
      :key="i"
      :ref="(el) => (videos[i] = el as HTMLVideoElement | null)"
      class="video-layer"
      :class="{ front: front === i, under: front !== i && fading }"
      :style="{ '--fade': `${FADE_S}s` }"
      :src="src"
      muted
      playsinline
      preload="auto"
      @timeupdate="onTimeUpdate(i)"
      @ended="onEnded(i)"
    />
  </div>
  <div class="vignette" />
</template>
