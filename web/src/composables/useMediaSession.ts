import { onUnmounted, watch, type Ref } from 'vue';
import type { NowPlaying } from '../spotify/player';

interface MediaActions {
  play(): void;
  pause(): void;
  next(): void;
  previous(): void;
}

const ACTIONS = ['play', 'pause', 'nexttrack', 'previoustrack'] as const;

/**
 * Branche les touches multimédia (boutons des écouteurs Bluetooth, clavier, contrôles du système)
 * sur le lecteur Spotify, et affiche le morceau en cours dans les contrôles média du système.
 */
export function useMediaSession(nowPlaying: Ref<NowPlaying | null>, actions: MediaActions): void {
  if (!('mediaSession' in navigator)) return;
  const session = navigator.mediaSession;

  const handlers: Record<(typeof ACTIONS)[number], () => void> = {
    play: actions.play,
    pause: actions.pause,
    nexttrack: actions.next,
    previoustrack: actions.previous,
  };
  for (const action of ACTIONS) {
    try {
      session.setActionHandler(action, handlers[action]);
    } catch {
      // action non gérée par ce navigateur
    }
  }

  watch(
    nowPlaying,
    (np) => {
      session.metadata = np
        ? new MediaMetadata({
            title: np.title,
            artist: np.artist,
            artwork: np.cover ? [{ src: np.cover }] : [],
          })
        : null;
      session.playbackState = np ? (np.paused ? 'paused' : 'playing') : 'none';
    },
    { immediate: true },
  );

  onUnmounted(() => {
    for (const action of ACTIONS) {
      try {
        session.setActionHandler(action, null);
      } catch {
        // idem
      }
    }
  });
}
