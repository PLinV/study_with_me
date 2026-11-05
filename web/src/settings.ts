import type { PlaybackMode } from './spotify/player';
import type { TimerConfig } from './timer';

export interface Settings extends TimerConfig {
  /** Volume du son de fin de phase, 0..1 */
  alertVolume: number;
  /** URL d'une vidéo de /scenes, '' = aléatoire, 'none' = aucune */
  scene: string;
  /** Lien ou URI Spotify d'une playlist / d'un album */
  playlist: string;
  /** Nom affiché de la playlist choisie */
  playlistName: string;
  musicVolume: number;
  pauseMusicOnBreak: boolean;
  /** Où sort le son Spotify : ce navigateur, ou un autre appareil piloté à distance */
  playbackMode: PlaybackMode;
}

const KEY = 'swm.settings';

export const DEFAULT_SETTINGS: Settings = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  pomodorosPerSet: 4,
  autoStart: false,
  alertVolume: 0.6,
  scene: 'builtin:campfire',
  playlist: '',
  playlistName: '',
  musicVolume: 0.5,
  pauseMusicOnBreak: true,
  playbackMode: 'here',
};

export function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

export function sanitize(s: Settings): Settings {
  return {
    ...s,
    focusMin: Math.round(clamp(s.focusMin, 1, 180)),
    shortBreakMin: Math.round(clamp(s.shortBreakMin, 1, 60)),
    longBreakMin: Math.round(clamp(s.longBreakMin, 1, 90)),
    pomodorosPerSet: Math.round(clamp(s.pomodorosPerSet, 1, 12)),
    alertVolume: clamp(s.alertVolume, 0, 1),
    musicVolume: clamp(s.musicVolume, 0, 1),
    playbackMode: s.playbackMode === 'remote' ? 'remote' : 'here',
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
  } catch {
    // stockage indisponible ou corrompu : valeurs par défaut
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // pas grave, les réglages vivront le temps de la page
  }
}
