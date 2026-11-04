<script setup lang="ts">
import * as icons from '../icons';
import type { NowPlaying } from '../spotify/player';
import PixelIcon from './PixelIcon.vue';

defineProps<{
  configured: boolean;
  connected: boolean;
  nowPlaying: NowPlaying | null;
  playlistName: string;
}>();
defineEmits<{ login: []; toggle: []; prev: []; next: []; pickPlaylist: [] }>();
const volume = defineModel<number>('volume', { required: true });
</script>

<template>
  <section class="hud top-left">
    <div class="now-playing">
      <img v-if="nowPlaying?.cover" class="icon-lg cover" :src="nowPlaying.cover" alt="" />
      <PixelIcon v-else class="icon-lg" :svg="icons.noteBlock" />
      <div>
        <div class="title ellipsis">
          {{ nowPlaying?.title ?? (connected ? playlistName || 'Spotify prêt' : 'Pas de musique') }}
        </div>
        <div class="subtitle ellipsis">
          {{ nowPlaying?.artist ?? (connected ? 'Appuie sur lecture' : '') }}
        </div>
      </div>
    </div>

    <div class="chrome row">
      <button v-if="configured && !connected" class="btn" @click="$emit('login')">Connecter Spotify</button>
      <template v-if="connected">
        <button class="btn icon-btn" title="Morceau précédent" @click="$emit('prev')">
          <PixelIcon :svg="icons.prev" />
        </button>
        <button class="btn icon-btn" title="Lecture / pause (M)" @click="$emit('toggle')">
          <PixelIcon :svg="nowPlaying && !nowPlaying.paused ? icons.pause : icons.play" />
        </button>
        <button class="btn icon-btn" title="Morceau suivant" @click="$emit('next')">
          <PixelIcon :svg="icons.next" />
        </button>
        <button class="btn icon-btn" title="Choisir une playlist (P)" @click="$emit('pickPlaylist')">
          <PixelIcon :svg="icons.search" />
        </button>
        <label class="volume" title="Volume de la musique">
          <PixelIcon :svg="icons.speaker" />
          <input v-model.number="volume" type="range" min="0" max="1" step="0.01" />
        </label>
      </template>
    </div>
  </section>
</template>
