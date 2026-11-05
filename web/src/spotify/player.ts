import { spotifyFetch, SpotifyError } from './api';
import { getAccessToken } from './auth';

// Types minimaux du Web Playback SDK (https://developer.spotify.com/documentation/web-playback-sdk)
interface SdkTrack {
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
}

interface SdkState {
  paused: boolean;
  track_window: { current_track: SdkTrack | null };
}

interface SdkPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (arg: any) => void): void;
  pause(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  activateElement(): Promise<void>;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        volume: number;
        getOAuthToken: (cb: (token: string) => void) => void;
      }) => SdkPlayer;
    };
  }
}

// Types minimaux de la Web API (/me/player)
interface ApiPlaybackState {
  is_playing: boolean;
  device: { id: string | null; name: string } | null;
  item: {
    name: string;
    artists?: { name: string }[];
    album?: { images: { url: string }[] };
    show?: { name: string };
    images?: { url: string }[];
  } | null;
}

interface ApiDevice {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted: boolean;
}

/** "here" : le son sort de ce navigateur. "remote" : on pilote un autre appareil (ex. le téléphone). */
export type PlaybackMode = 'here' | 'remote';

export interface NowPlaying {
  title: string;
  artist: string;
  cover: string | null;
  paused: boolean;
  /** Nom de l'appareil piloté en mode "remote" */
  device: string | null;
}

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
const PLAYER_NAME = 'Study with me';
const POLL_MS = 4000;
const VOLUME_DEBOUNCE_MS = 300;

let sdkLoading: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  sdkLoading ??= new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onerror = () => reject(new Error('Impossible de charger le lecteur Spotify'));
    document.head.append(script);
  });
  return sdkLoading;
}

/** Accepte un lien open.spotify.com ou une URI spotify:… (playlist, album, artiste). */
export function toSpotifyUri(input: string): string | null {
  const s = input.trim();
  if (/^spotify:(playlist|album|artist):[A-Za-z0-9]+$/.test(s)) return s;
  const m = s.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album|artist)\/([A-Za-z0-9]+)/);
  return m ? `spotify:${m[1]}:${m[2]}` : null;
}

export class SpotifyController {
  paused = true;
  mode: PlaybackMode;

  private clientId: string;
  private onChange: (np: NowPlaying | null) => void;
  private onError: (message: string) => void;
  private player: SdkPlayer | null = null;
  private deviceId: string | null = null;
  private hasTrack = false;
  private current: NowPlaying | null = null;
  private pollTimer: number | undefined;
  private volumeTimer: number | undefined;

  constructor(
    clientId: string,
    mode: PlaybackMode,
    onChange: (np: NowPlaying | null) => void,
    onError: (message: string) => void,
  ) {
    this.clientId = clientId;
    this.mode = mode;
    this.onChange = onChange;
    this.onError = onError;
  }

  async connect(volume: number): Promise<void> {
    if (this.mode === 'remote') this.startPolling();
    await loadSdk();
    const player = new window.Spotify!.Player({
      name: PLAYER_NAME,
      volume,
      getOAuthToken: (cb) => {
        void getAccessToken(this.clientId).then((token) => {
          if (token) cb(token);
          else this.onError('Session Spotify expirée, reconnecte-toi');
        });
      },
    });

    player.addListener('ready', ({ device_id }: { device_id: string }) => {
      this.deviceId = device_id;
      // En mode "ici", ce navigateur devient l'appareil actif (sans lancer la musique).
      // En mode "remote", surtout pas : on couperait le son du téléphone.
      if (this.mode === 'here') void this.api('PUT', '/me/player', { device_ids: [device_id], play: false });
    });
    player.addListener('not_ready', () => {
      this.deviceId = null;
    });
    player.addListener('player_state_changed', (state: SdkState | null) => {
      if (this.mode !== 'here') return;
      const track = state?.track_window.current_track;
      this.emit(
        track
          ? {
              title: track.name,
              artist: track.artists.map((a) => a.name).join(', '),
              cover: track.album.images.at(-1)?.url ?? null,
              paused: state?.paused ?? true,
              device: null,
            }
          : null,
      );
    });
    player.addListener('initialization_error', ({ message }) =>
      this.onError(`Lecteur Spotify indisponible dans ce navigateur (${message})`),
    );
    player.addListener('authentication_error', () => this.onError('Session Spotify expirée, reconnecte-toi'));
    player.addListener('account_error', () => this.onError('Spotify Premium est nécessaire pour la lecture'));
    player.addListener('playback_error', ({ message }) => this.onError(`Lecture impossible : ${message}`));

    this.player = player;
    if (!(await player.connect())) this.onError('Connexion au lecteur Spotify impossible');
  }

  disconnect(): void {
    this.stopPolling();
    this.player?.disconnect();
    this.player = null;
    this.deviceId = null;
    this.emit(null);
  }

  get ready(): boolean {
    return this.mode === 'remote' || this.deviceId !== null;
  }

  /** Bascule la sortie du son entre ce navigateur et un autre appareil, en gardant la lecture en cours. */
  async setMode(mode: PlaybackMode): Promise<void> {
    if (mode === this.mode) return;
    const wasPlaying = !this.paused;
    this.mode = mode;

    if (mode === 'here') {
      this.stopPolling();
      if (!this.deviceId) return this.onError('Le lecteur Spotify n’est pas encore prêt');
      await this.api('PUT', '/me/player', { device_ids: [this.deviceId], play: wasPlaying });
      return;
    }

    // Si le son sort d'ici, on l'envoie vers un autre appareil (de préférence un téléphone).
    const devices = await this.devices();
    const active = devices.find((d) => d.is_active);
    if (!active || active.id === this.deviceId) {
      const target = devices
        .filter((d) => d.id && d.id !== this.deviceId && !d.is_restricted)
        .sort((a, b) => Number(b.type === 'Smartphone') - Number(a.type === 'Smartphone'))[0];
      if (target) await this.api('PUT', '/me/player', { device_ids: [target.id], play: wasPlaying });
      else this.onError('Aucun autre appareil trouvé : ouvre Spotify sur ton téléphone');
    }
    this.startPolling();
  }

  /**
   * Reprend la lecture, ou démarre la playlist si rien n'est en cours.
   * On passe par la Web API plutôt que par le SDK : ça marche même si Spotify
   * a mis le lecteur du navigateur en veille pendant une longue pause.
   */
  async play(contextUri: string | null): Promise<void> {
    if (this.mode === 'here') {
      if (!this.deviceId) return this.onError('Le lecteur Spotify n’est pas encore prêt');
      await this.player?.activateElement();
    }
    try {
      await spotifyFetch(this.clientId, 'PUT', `/me/player/play${this.deviceQuery()}`);
      this.optimistic(false);
    } catch (err) {
      // 404 : aucune lecture à reprendre (ou aucun appareil actif) → on lance la playlist.
      if (!(err instanceof SpotifyError && err.status === 404)) return this.onError((err as Error).message);
      if (!contextUri) return this.onError('Ajoute une playlist Spotify dans les réglages');
      await this.playContext(contextUri);
    }
  }

  async playContext(contextUri: string): Promise<void> {
    if (this.mode === 'here' && !this.deviceId) return this.onError('Le lecteur Spotify n’est pas encore prêt');
    await this.api('PUT', `/me/player/play${this.deviceQuery()}`, { context_uri: contextUri });
    this.optimistic(false);
  }

  async pause(): Promise<void> {
    if (this.mode === 'here' && this.hasTrack) await this.player?.pause();
    else await this.api('PUT', '/me/player/pause');
    this.optimistic(true);
  }

  async toggle(contextUri: string | null): Promise<void> {
    if (this.paused) await this.play(contextUri);
    else await this.pause();
  }

  async next(): Promise<void> {
    if (this.mode === 'here') await this.player?.nextTrack();
    else await this.api('POST', '/me/player/next');
    this.refreshSoon();
  }

  async previous(): Promise<void> {
    if (this.mode === 'here') await this.player?.previousTrack();
    else await this.api('POST', '/me/player/previous');
    this.refreshSoon();
  }

  async setVolume(volume: number): Promise<void> {
    if (this.mode === 'here') {
      await this.player?.setVolume(volume);
      return;
    }
    // Certains téléphones refusent qu'on règle leur volume (403) : on l'ignore sans bruit.
    window.clearTimeout(this.volumeTimer);
    this.volumeTimer = window.setTimeout(() => {
      void spotifyFetch(this.clientId, 'PUT', `/me/player/volume?volume_percent=${Math.round(volume * 100)}`).catch(
        () => {},
      );
    }, VOLUME_DEBOUNCE_MS);
  }

  // ---------- Mode "remote" : on lit l'état de l'autre appareil régulièrement ----------

  private startPolling(): void {
    this.stopPolling();
    void this.poll();
    this.pollTimer = window.setInterval(() => {
      if (!document.hidden) void this.poll();
    }, POLL_MS);
  }

  private stopPolling(): void {
    window.clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }

  private refreshSoon(): void {
    if (this.mode === 'remote') window.setTimeout(() => void this.poll(), 600);
  }

  private async poll(): Promise<void> {
    let state: ApiPlaybackState | null;
    try {
      state = await spotifyFetch<ApiPlaybackState>(this.clientId, 'GET', '/me/player');
    } catch {
      return; // on réessaiera au prochain tour
    }
    if (this.mode !== 'remote') return;
    const item = state?.item;
    this.emit(
      item
        ? {
            title: item.name,
            artist: item.artists?.map((a) => a.name).join(', ') ?? item.show?.name ?? '',
            cover: (item.album?.images ?? item.images ?? []).at(-1)?.url ?? null,
            paused: !state!.is_playing,
            device: state!.device?.name ?? null,
          }
        : null,
    );
  }

  private async devices(): Promise<ApiDevice[]> {
    try {
      const res = await spotifyFetch<{ devices: ApiDevice[] }>(this.clientId, 'GET', '/me/player/devices');
      return res?.devices ?? [];
    } catch (err) {
      this.onError((err as Error).message);
      return [];
    }
  }

  // ---------- Outils ----------

  private deviceQuery(): string {
    return this.mode === 'here' && this.deviceId ? `?device_id=${this.deviceId}` : '';
  }

  private emit(np: NowPlaying | null): void {
    this.current = np;
    this.hasTrack = np !== null;
    this.paused = np?.paused ?? true;
    this.onChange(np);
  }

  /** Met l'affichage à jour tout de suite, sans attendre la confirmation de Spotify. */
  private optimistic(paused: boolean): void {
    this.paused = paused;
    if (this.current) this.emit({ ...this.current, paused });
    this.refreshSoon();
  }

  private async api(method: string, path: string, body?: unknown): Promise<void> {
    try {
      await spotifyFetch(this.clientId, method, path, body);
    } catch (err) {
      this.onError((err as Error).message);
    }
  }
}
