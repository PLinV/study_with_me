import { spotifyFetch } from './api';
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
  resume(): Promise<void>;
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

export interface NowPlaying {
  title: string;
  artist: string;
  cover: string | null;
  paused: boolean;
}

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

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

  private clientId: string;
  private onChange: (np: NowPlaying | null) => void;
  private onError: (message: string) => void;
  private player: SdkPlayer | null = null;
  private deviceId: string | null = null;
  private hasTrack = false;

  constructor(
    clientId: string,
    onChange: (np: NowPlaying | null) => void,
    onError: (message: string) => void,
  ) {
    this.clientId = clientId;
    this.onChange = onChange;
    this.onError = onError;
  }

  async connect(volume: number): Promise<void> {
    await loadSdk();
    const player = new window.Spotify!.Player({
      name: 'Study with me',
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
      // Fait de ce navigateur l'appareil de lecture actif, sans lancer la musique.
      void this.api('PUT', '/me/player', { device_ids: [device_id], play: false });
    });
    player.addListener('not_ready', () => {
      this.deviceId = null;
    });
    player.addListener('player_state_changed', (state: SdkState | null) => {
      const track = state?.track_window.current_track;
      this.hasTrack = Boolean(track);
      this.paused = state?.paused ?? true;
      this.onChange(
        track
          ? {
              title: track.name,
              artist: track.artists.map((a) => a.name).join(', '),
              cover: track.album.images.at(-1)?.url ?? null,
              paused: this.paused,
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
    this.player?.disconnect();
    this.player = null;
    this.deviceId = null;
    this.hasTrack = false;
    this.paused = true;
    this.onChange(null);
  }

  get ready(): boolean {
    return this.deviceId !== null;
  }

  /** Reprend la lecture, ou démarre la playlist si rien n'est chargé. */
  async play(contextUri: string | null): Promise<void> {
    if (!this.player) return;
    await this.player.activateElement();
    if (this.hasTrack) return this.player.resume();
    if (!contextUri) return this.onError('Ajoute une playlist Spotify dans les réglages');
    await this.playContext(contextUri);
  }

  async playContext(contextUri: string): Promise<void> {
    if (!this.deviceId) return this.onError('Le lecteur Spotify n’est pas encore prêt');
    await this.api('PUT', `/me/player/play?device_id=${this.deviceId}`, { context_uri: contextUri });
  }

  async pause(): Promise<void> {
    await this.player?.pause();
  }

  async toggle(contextUri: string | null): Promise<void> {
    if (this.paused) await this.play(contextUri);
    else await this.pause();
  }

  async next(): Promise<void> {
    await this.player?.nextTrack();
  }

  async previous(): Promise<void> {
    await this.player?.previousTrack();
  }

  async setVolume(volume: number): Promise<void> {
    await this.player?.setVolume(volume);
  }

  private async api(method: string, path: string, body?: unknown): Promise<void> {
    try {
      await spotifyFetch(this.clientId, method, path, body);
    } catch (err) {
      this.onError((err as Error).message);
    }
  }
}
