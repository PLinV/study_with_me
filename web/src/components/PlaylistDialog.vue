<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { getMyPlaylists, searchPlaylists, type PlaylistSummary } from '../spotify/api';
import { toSpotifyUri } from '../spotify/player';
import BaseDialog from './BaseDialog.vue';

const props = defineProps<{ open: boolean; clientId: string; current: string; needsReconnect: boolean }>();
const emit = defineEmits<{ close: []; select: [playlist: { uri: string; name: string }]; reconnect: [] }>();

const SEARCH_DEBOUNCE_MS = 350;

type Tab = 'mine' | 'search';
const tab = ref<Tab>('mine');
const query = ref('');
const link = ref('');
const results = ref<PlaylistSummary[]>([]);
const hasMore = ref(false);
const loading = ref(false);
const error = ref('');

let mine: PlaylistSummary[] | null = null;
let debounce: number | undefined;
// Ignore les réponses d'une recherche dépassée par une plus récente.
let requestId = 0;

async function run<T>(fn: () => Promise<T>): Promise<T | null> {
  const id = ++requestId;
  loading.value = true;
  error.value = '';
  try {
    const result = await fn();
    return id === requestId ? result : null;
  } catch (err) {
    if (id === requestId) error.value = (err as Error).message;
    return null;
  } finally {
    if (id === requestId) loading.value = false;
  }
}

async function showMine(): Promise<void> {
  if (props.needsReconnect) {
    results.value = [];
    return;
  }
  mine ??= await run(() => getMyPlaylists(props.clientId));
  if (tab.value === 'mine') {
    results.value = mine ?? [];
    hasMore.value = false;
  }
}

async function search(more = false): Promise<void> {
  const q = query.value.trim();
  if (!q) {
    requestId++;
    results.value = [];
    hasMore.value = false;
    return;
  }
  const offset = more ? results.value.length : 0;
  const page = await run(() => searchPlaylists(props.clientId, q, offset));
  if (!page) return;
  results.value = more ? [...results.value, ...page.playlists] : page.playlists;
  hasMore.value = page.hasMore;
}

watch(tab, (t) => {
  results.value = [];
  if (t === 'mine') void showMine();
  else void search();
});

watch(query, () => {
  window.clearTimeout(debounce);
  debounce = window.setTimeout(() => void search(), SEARCH_DEBOUNCE_MS);
});

watch(
  () => props.open,
  (open) => {
    if (open && tab.value === 'mine') void showMine();
  },
);
onMounted(() => {
  if (props.open) void showMine();
});

function pick(p: PlaylistSummary): void {
  emit('select', { uri: p.uri, name: p.name });
}

function pickLink(): void {
  const uri = toSpotifyUri(link.value);
  if (!uri) {
    error.value = 'Lien non reconnu : colle un lien de playlist, d’album ou d’artiste Spotify';
    return;
  }
  emit('select', { uri, name: '' });
  link.value = '';
}
</script>

<template>
  <BaseDialog :open="open" wide @close="emit('close')">
    <h2>Choisir une playlist</h2>

    <div class="tabs" role="tablist">
      <button class="btn" role="tab" :class="{ active: tab === 'mine' }" :aria-selected="tab === 'mine'" @click="tab = 'mine'">
        Mes playlists
      </button>
      <button class="btn" role="tab" :class="{ active: tab === 'search' }" :aria-selected="tab === 'search'" @click="tab = 'search'">
        Rechercher
      </button>
    </div>

    <input
      v-if="tab === 'search'"
      v-model="query"
      class="field search-field"
      type="search"
      placeholder="lofi, chill, minecraft, c418…"
      autofocus
    />

    <div v-if="tab === 'mine' && needsReconnect" class="hint">
      Pour voir tes playlists, Spotify doit te redonner l'autorisation.
      <button class="btn" @click="emit('reconnect')">Reconnecter Spotify</button>
    </div>

    <p v-if="error" class="hint error">{{ error }}</p>

    <ul class="playlists" :aria-busy="loading">
      <li v-for="p in results" :key="p.uri">
        <button class="playlist" :class="{ current: p.uri === current }" @click="pick(p)">
          <img v-if="p.image" :src="p.image" alt="" loading="lazy" />
          <span v-else class="placeholder">♪</span>
          <span class="meta">
            <span class="name ellipsis">{{ p.name }}</span>
            <span class="owner ellipsis">
              {{ p.owner }}<template v-if="p.tracks !== null"> · {{ p.tracks }} titres</template>
            </span>
          </span>
        </button>
      </li>
    </ul>

    <p v-if="loading" class="hint">Chargement…</p>
    <p v-else-if="!error && results.length === 0 && (tab === 'mine' ? !needsReconnect : query.trim())" class="hint">
      Aucune playlist trouvée.
    </p>
    <button v-if="hasMore && !loading" class="btn" @click="search(true)">Voir plus</button>

    <form class="row link-row" @submit.prevent="pickLink">
      <input v-model="link" class="field" type="text" placeholder="…ou colle un lien open.spotify.com" />
      <button class="btn" type="submit">OK</button>
    </form>

    <div class="row actions">
      <span class="spacer" />
      <button class="btn" @click="emit('close')">Fermer</button>
    </div>
  </BaseDialog>
</template>
