<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch, watchEffect } from 'vue';
import * as icons from './icons';
import { listScenes, pickScene, type Scene } from './scenes';
import { loadSettings, saveSettings, type Settings } from './settings';
import { notify, playChime, requestNotifications, unlockAudio } from './sound';
import { fetchStats, flushSessions, formatClock, recordSession, type Stats } from './stats';
import type { Phase } from './timer';
import { toSpotifyUri } from './spotify/player';
import { usePomodoro } from './composables/usePomodoro';
import { useSpotify } from './composables/useSpotify';
import { useTasks } from './composables/useTasks';
import { useMediaSession } from './composables/useMediaSession';
import MusicHud from './components/MusicHud.vue';
import PhaseHud from './components/PhaseHud.vue';
import PixelIcon from './components/PixelIcon.vue';
import PlaylistDialog from './components/PlaylistDialog.vue';
import SceneBackground from './components/SceneBackground.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import StatsPanel from './components/StatsPanel.vue';
import TasksPanel from './components/TasksPanel.vue';
import TimerPanel from './components/TimerPanel.vue';

const IDLE_MS = 3500;
const STATS_REFRESH_MS = 60_000;
const TOAST_MS = 5000;

const PHASE_TITLES: Record<Phase, string> = {
  focus: 'Pomodoro',
  short_break: 'Pause',
  long_break: 'Longue pause',
};

const settings = reactive<Settings>(loadSettings());
const scenes = ref<Scene[]>([]);
const sceneUrl = ref<string | null>(null);
const stats = ref<Stats | null>(null);
const settingsOpen = ref(false);
const playlistOpen = ref(false);
const tasksOpen = ref(false);
const idle = ref(false);
const toastMessage = ref('');

// ---------- Toast ----------

let toastTimer: number | undefined;
function toast(message: string): void {
  toastMessage.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastMessage.value = ''), TOAST_MS);
}

// ---------- Spotify ----------

const spotify = useSpotify(toast);
const spotifyConnected = computed(() => spotify.controller.value !== null);
let musicPausedByBreak = false;

function playlistUri(): string | null {
  return toSpotifyUri(settings.playlist);
}

function toggleMusic(): void {
  musicPausedByBreak = false;
  void spotify.controller.value?.toggle(playlistUri());
}

function selectPlaylist(p: { uri: string; name: string }): void {
  settings.playlist = p.uri;
  settings.playlistName = p.name;
  playlistOpen.value = false;
  musicPausedByBreak = false;
  void spotify.controller.value?.playContext(p.uri);
}

watch(
  () => settings.musicVolume,
  (v) => void spotify.controller.value?.setVolume(v),
);

// Boutons des écouteurs / touches multimédia
useMediaSession(spotify.nowPlaying, {
  play: () => {
    musicPausedByBreak = false;
    void spotify.controller.value?.play(playlistUri());
  },
  pause: () => void spotify.controller.value?.pause(),
  next: () => void spotify.controller.value?.next(),
  previous: () => void spotify.controller.value?.previous(),
});

watch(
  () => settings.playbackMode,
  (mode) => void spotify.controller.value?.setMode(mode),
);

// ---------- Tâches ----------

const tasks = useTasks(toast);

// ---------- Chrono ----------

const pomodoro = usePomodoro(settings, {
  onSessionEnd: (record) => void recordSession(record).then(refreshStats),
  onPhaseChange: handlePhaseChange,
});

function handlePhaseChange(next: Phase, finished: Phase, completed: boolean): void {
  if (completed) {
    playChime(next === 'focus' ? 'focus' : 'break', settings.alertVolume);
    if (finished === 'focus') {
      notify('Pomodoro terminé 🍅', next === 'long_break' ? 'Longue pause bien méritée !' : 'Petite pause !');
    } else {
      notify('Pause terminée', 'On s’y remet ✏️');
    }
  }
  const player = spotify.controller.value;
  if (next !== 'focus' && settings.pauseMusicOnBreak && player && !player.paused) {
    musicPausedByBreak = true;
    void player.pause();
  }
}

// Relance la musique coupée par la pause dès que le focus repart,
// que ce soit au clic sur Go ou quand les phases s'enchaînent toutes seules.
watch([pomodoro.running, pomodoro.phase], ([running, phase]) => {
  if (running && phase === 'focus' && musicPausedByBreak) {
    musicPausedByBreak = false;
    void spotify.controller.value?.play(playlistUri());
  }
});

function toggleTimer(): void {
  unlockAudio();
  requestNotifications();
  pomodoro.timer.toggle();
  wake();
}

// ---------- Réglages ----------

function saveSettingsFromDialog(next: Settings): void {
  // La playlist et le volume se règlent ailleurs : on garde les valeurs actuelles.
  Object.assign(settings, {
    ...next,
    playlist: settings.playlist,
    playlistName: settings.playlistName,
    musicVolume: settings.musicVolume,
    playbackMode: settings.playbackMode,
  });
  pomodoro.timer.setConfig(settings);
  applyScene();
  settingsOpen.value = false;
}

function newSet(): void {
  pomodoro.timer.newSet();
  settingsOpen.value = false;
}

function logoutSpotify(): void {
  spotify.logout();
  settingsOpen.value = false;
}

watch(settings, () => saveSettings({ ...settings }), { deep: true });

// ---------- Scène & stats ----------

function applyScene(): void {
  sceneUrl.value = pickScene(scenes.value, settings.scene)?.url ?? null;
}

async function refreshStats(): Promise<void> {
  stats.value = await fetchStats();
}

// ---------- Mode calme ----------

let idleTimer: number | undefined;
function wake(): void {
  idle.value = false;
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    idle.value = pomodoro.timer.running && !settingsOpen.value && !playlistOpen.value && !tasksOpen.value;
  }, IDLE_MS);
}

// ---------- Clavier ----------

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

function onKeydown(e: KeyboardEvent): void {
  wake();
  if (settingsOpen.value || playlistOpen.value || e.ctrlKey || e.metaKey || e.altKey) return;
  if ((e.target as HTMLElement).matches('input, select, textarea')) return;
  const actions: Record<string, () => void> = {
    ' ': toggleTimer,
    n: () => pomodoro.timer.skip(),
    r: () => pomodoro.timer.restartPhase(),
    f: toggleFullscreen,
    s: () => (settingsOpen.value = true),
    m: toggleMusic,
    p: () => {
      if (spotifyConnected.value) playlistOpen.value = true;
    },
    t: () => (tasksOpen.value = !tasksOpen.value),
  };
  const action = actions[e.key.toLowerCase()];
  if (action) {
    e.preventDefault();
    action();
  }
}

// ---------- Effets sur la page ----------

watchEffect(() => {
  document.body.dataset.phase = pomodoro.phase.value;
  document.body.classList.toggle('idle', idle.value);
  document.title = pomodoro.started.value
    ? `${formatClock(pomodoro.remaining.value)} · ${PHASE_TITLES[pomodoro.phase.value]}`
    : 'Study with me';
});

let statsInterval: number | undefined;

onMounted(async () => {
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('pointermove', wake);
  document.addEventListener('pointerdown', wake);
  statsInterval = window.setInterval(() => void flushSessions().then(refreshStats), STATS_REFRESH_MS);

  void flushSessions().then(refreshStats);
  void tasks.refresh();
  void spotify.init(settings.musicVolume, settings.playbackMode);
  scenes.value = await listScenes();
  applyScene();
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('pointermove', wake);
  document.removeEventListener('pointerdown', wake);
  window.clearInterval(statsInterval);
});
</script>

<template>
  <SceneBackground :src="sceneUrl" />

  <MusicHud
    v-model:volume="settings.musicVolume"
    v-model:mode="settings.playbackMode"
    :configured="spotify.clientId.value !== ''"
    :connected="spotifyConnected"
    :now-playing="spotify.nowPlaying.value"
    :playlist-name="settings.playlistName"
    @login="spotify.login"
    @toggle="toggleMusic"
    @prev="spotify.controller.value?.previous()"
    @next="spotify.controller.value?.next()"
    @pick-playlist="playlistOpen = true"
  />

  <PhaseHud :phase="pomodoro.phase.value" :index="pomodoro.index.value" :total="pomodoro.pomodorosPerSet.value" />

  <TasksPanel
    v-model:open="tasksOpen"
    :tasks="tasks.tasks.value"
    :in-progress="tasks.inProgress.value"
    :done-count="tasks.doneCount.value"
    @add="tasks.add"
    @cycle="tasks.cycle"
    @rename="tasks.rename"
    @remove="tasks.remove"
    @clear-done="tasks.clearDone"
  />

  <TimerPanel
    :remaining="pomodoro.remaining.value"
    :progress="pomodoro.progress.value"
    :running="pomodoro.running.value"
    :started="pomodoro.started.value"
    @toggle="toggleTimer"
    @restart="pomodoro.timer.restartPhase()"
    @skip="pomodoro.timer.skip()"
  />

  <StatsPanel :stats="stats" />

  <nav class="hud bottom-right chrome row">
    <button class="btn icon-btn" title="Réglages (S)" @click="settingsOpen = true">
      <PixelIcon :svg="icons.gear" />
    </button>
    <button class="btn icon-btn" title="Plein écran (F)" @click="toggleFullscreen">
      <PixelIcon :svg="icons.fullscreen" />
    </button>
  </nav>

  <div v-if="toastMessage" class="toast" role="status">{{ toastMessage }}</div>

  <SettingsDialog
    :open="settingsOpen"
    :settings="settings"
    :scenes="scenes"
    :spotify-configured="spotify.clientId.value !== ''"
    :spotify-connected="spotifyConnected"
    @close="settingsOpen = false"
    @save="saveSettingsFromDialog"
    @new-set="newSet"
    @pick-playlist="playlistOpen = true"
    @logout="logoutSpotify"
  />

  <PlaylistDialog
    v-if="spotifyConnected"
    :open="playlistOpen"
    :client-id="spotify.clientId.value"
    :current="settings.playlist"
    :needs-reconnect="spotify.needsReconnect.value"
    @close="playlistOpen = false"
    @select="selectPlaylist"
    @reconnect="spotify.login"
  />
</template>
