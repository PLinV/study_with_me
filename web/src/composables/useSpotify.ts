import { ref, shallowRef } from 'vue';
import { handleCallback, hasAllScopes, isLoggedIn, login as spotifyLogin, logout as spotifyLogout } from '../spotify/auth';
import { SpotifyController, type NowPlaying, type PlaybackMode } from '../spotify/player';

export function useSpotify(toast: (message: string) => void) {
  const clientId = ref('');
  const controller = shallowRef<SpotifyController | null>(null);
  const nowPlaying = ref<NowPlaying | null>(null);
  /** Connecté avec une ancienne version de l'app qui ne demandait pas l'accès aux playlists. */
  const needsReconnect = ref(false);

  async function init(volume: number, mode: PlaybackMode): Promise<void> {
    try {
      const res = await fetch('/api/config');
      clientId.value = res.ok ? ((await res.json()).spotifyClientId ?? '') : '';
    } catch {
      clientId.value = '';
    }
    if (!clientId.value) return;

    try {
      if (await handleCallback(clientId.value)) toast('Spotify connecté 🎵');
    } catch (err) {
      toast((err as Error).message);
    }
    if (!isLoggedIn()) return;

    needsReconnect.value = !hasAllScopes();
    const player = new SpotifyController(clientId.value, mode, (np) => (nowPlaying.value = np), toast);
    controller.value = player;
    try {
      await player.connect(volume);
    } catch (err) {
      toast((err as Error).message);
    }
  }

  function login(): void {
    spotifyLogin(clientId.value).catch((err: Error) => toast(err.message));
  }

  function logout(): void {
    controller.value?.disconnect();
    controller.value = null;
    nowPlaying.value = null;
    needsReconnect.value = false;
    spotifyLogout();
  }

  return { clientId, controller, nowPlaying, needsReconnect, init, login, logout };
}
