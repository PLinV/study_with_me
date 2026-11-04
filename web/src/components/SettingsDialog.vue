<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { Scene } from '../scenes';
import { sanitize, type Settings } from '../settings';
import BaseDialog from './BaseDialog.vue';

const props = defineProps<{
  open: boolean;
  settings: Settings;
  scenes: Scene[];
  spotifyConfigured: boolean;
  spotifyConnected: boolean;
}>();
const emit = defineEmits<{
  close: [];
  save: [settings: Settings];
  newSet: [];
  pickPlaylist: [];
  logout: [];
}>();

// On édite une copie : rien ne change tant qu'on n'a pas cliqué sur Enregistrer.
const draft = reactive<Settings>({ ...props.settings });
watch(
  () => props.open,
  (open) => {
    if (open) Object.assign(draft, props.settings);
  },
);

function save(): void {
  emit('save', sanitize({ ...draft }));
}
</script>

<template>
  <BaseDialog :open="open" @close="emit('close')">
    <form @submit.prevent="save">
      <h2>Réglages</h2>

      <fieldset>
        <legend>Chrono</legend>
        <label>Travail (min) <input v-model.number="draft.focusMin" class="field" type="number" min="1" max="180" required /></label>
        <label>Pause courte (min) <input v-model.number="draft.shortBreakMin" class="field" type="number" min="1" max="60" required /></label>
        <label>Pause longue (min) <input v-model.number="draft.longBreakMin" class="field" type="number" min="1" max="90" required /></label>
        <label>Pomodoros par série <input v-model.number="draft.pomodorosPerSet" class="field" type="number" min="1" max="12" required /></label>
        <label class="check"><input v-model="draft.autoStart" type="checkbox" /> Enchaîner automatiquement les phases</label>
        <label>Volume du son de fin <input v-model.number="draft.alertVolume" type="range" min="0" max="1" step="0.01" /></label>
      </fieldset>

      <fieldset>
        <legend>Scène</legend>
        <label>
          Vidéo
          <select v-model="draft.scene" class="field">
            <option value="">Aléatoire</option>
            <option v-for="s in scenes" :key="s.url" :value="s.url">{{ s.private ? `${s.label} (perso)` : s.label }}</option>
            <option value="none">Aucune</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>Spotify</legend>
        <template v-if="spotifyConnected">
          <div class="row">
            <span class="grow ellipsis">{{ settings.playlistName || (settings.playlist ? 'Playlist choisie' : 'Aucune playlist') }}</span>
            <button type="button" class="btn" @click="emit('pickPlaylist')">Choisir…</button>
          </div>
          <label class="check"><input v-model="draft.pauseMusicOnBreak" type="checkbox" /> Couper la musique pendant les pauses</label>
          <div class="row">
            <button type="button" class="btn" @click="emit('logout')">Déconnecter Spotify</button>
          </div>
          <p class="hint">Le lecteur apparaît dans Spotify sous le nom « Study with me ».</p>
        </template>
        <p v-else-if="spotifyConfigured" class="hint">Non connecté : utilise le bouton « Connecter Spotify » en haut à gauche.</p>
        <p v-else class="hint">Ajoute SPOTIFY_CLIENT_ID dans le fichier .env puis relance docker compose.</p>
      </fieldset>

      <div class="row actions">
        <button type="button" class="btn" title="Repart au pomodoro 1" @click="emit('newSet')">Nouvelle série</button>
        <span class="spacer" />
        <button type="button" class="btn" @click="emit('close')">Annuler</button>
        <button type="submit" class="btn btn-accent">Enregistrer</button>
      </div>
    </form>
  </BaseDialog>
</template>
