import { getAccessToken } from './auth';

const API = 'https://api.spotify.com/v1';

// Depuis février 2026, les apps en "Development Mode" sont limitées à 10 résultats par recherche.
const SEARCH_PAGE_SIZE = 10;

export class SpotifyError extends Error {
  status: number;

  constructor(status: number, path: string) {
    super(`Spotify a répondu ${status} sur ${path.split('?')[0]}`);
    this.status = status;
  }
}

/** Appel authentifié à la Web API. Renvoie le JSON, ou null pour une réponse vide (204). */
export async function spotifyFetch<T>(
  clientId: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  const token = await getAccessToken(clientId);
  if (!token) throw new Error('Session Spotify expirée, reconnecte-toi');
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new SpotifyError(res.status, path);
  // Les commandes du lecteur (play, pause, next…) répondent parfois par un simple identifiant
  // en texte brut : on ne lit le corps que s'il s'agit vraiment de JSON.
  if (!res.headers.get('content-type')?.includes('application/json')) return null;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

export interface PlaylistSummary {
  uri: string;
  name: string;
  owner: string;
  image: string | null;
  tracks: number | null;
}

interface RawPlaylist {
  uri: string;
  name: string;
  owner?: { display_name?: string };
  images?: { url: string }[] | null;
  // `tracks` a été renommé `items` en 2026 ; on accepte les deux.
  items?: { total: number };
  tracks?: { total: number };
}

interface Page<T> {
  items: (T | null)[];
  next: string | null;
}

function toSummary(p: RawPlaylist): PlaylistSummary {
  return {
    uri: p.uri,
    name: p.name,
    owner: p.owner?.display_name ?? '',
    // Les images sont triées de la plus grande à la plus petite : on prend la plus petite.
    image: p.images?.at(-1)?.url ?? null,
    tracks: p.items?.total ?? p.tracks?.total ?? null,
  };
}

function summaries(page: Page<RawPlaylist> | null | undefined): PlaylistSummary[] {
  // Spotify renvoie parfois des entrées null dans les listes.
  return (page?.items ?? []).filter((p): p is RawPlaylist => p !== null).map(toSummary);
}

export async function getMyPlaylists(clientId: string): Promise<PlaylistSummary[]> {
  const page = await spotifyFetch<Page<RawPlaylist>>(clientId, 'GET', '/me/playlists?limit=50');
  return summaries(page);
}

export async function searchPlaylists(
  clientId: string,
  query: string,
  offset = 0,
): Promise<{ playlists: PlaylistSummary[]; hasMore: boolean }> {
  const params = new URLSearchParams({
    q: query,
    type: 'playlist',
    limit: String(SEARCH_PAGE_SIZE),
    offset: String(offset),
  });
  const res = await spotifyFetch<{ playlists: Page<RawPlaylist> }>(clientId, 'GET', `/search?${params}`);
  return { playlists: summaries(res?.playlists), hasMore: Boolean(res?.playlists.next) };
}
