// Connexion Spotify en "Authorization Code + PKCE" : aucun client secret,
// tout se passe dans le navigateur. Les jetons restent dans le localStorage.

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
];

const TOKEN_KEY = 'swm.spotify.token';
const VERIFIER_KEY = 'swm.spotify.verifier';
const STATE_KEY = 'swm.spotify.state';
const CALLBACK_PATH = '/callback';

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

export function redirectUri(): string {
  return window.location.origin + CALLBACK_PATH;
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function readToken(): StoredToken | null {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function storeToken(res: TokenResponse, previous?: StoredToken): void {
  const token: StoredToken = {
    accessToken: res.access_token,
    refreshToken: res.refresh_token ?? previous?.refreshToken ?? '',
    expiresAt: Date.now() + res.expires_in * 1000,
    scope: res.scope ?? previous?.scope ?? '',
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new Error(`Spotify a refusé le jeton (${res.status})`);
  return res.json();
}

export function isLoggedIn(): boolean {
  return readToken() !== null;
}

/** Vrai si la connexion actuelle a toutes les permissions demandées (sinon il faut se reconnecter). */
export function hasAllScopes(): boolean {
  const granted = new Set((readToken()?.scope ?? '').split(' '));
  return SCOPES.every((s) => granted.has(s));
}

export async function login(clientId: string): Promise<void> {
  const verifier = randomString(64);
  const state = randomString(16);
  localStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(STATE_KEY, state);
  const url = new URL('https://accounts.spotify.com/authorize');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES.join(' '),
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await codeChallenge(verifier),
    state,
  }).toString();
  window.location.assign(url);
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Traite le retour de Spotify sur /callback. Renvoie false si on n'est pas sur le callback. */
export async function handleCallback(clientId: string): Promise<boolean> {
  if (window.location.pathname !== CALLBACK_PATH) return false;
  const params = new URLSearchParams(window.location.search);
  const verifier = localStorage.getItem(VERIFIER_KEY);
  const expectedState = localStorage.getItem(STATE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
  window.history.replaceState({}, '', '/');

  const error = params.get('error');
  if (error) throw new Error(error === 'access_denied' ? 'Connexion Spotify annulée' : `Spotify : ${error}`);
  const code = params.get('code');
  if (!code || !verifier || params.get('state') !== expectedState) {
    throw new Error('Retour Spotify invalide, réessaie de te connecter');
  }
  storeToken(
    await requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: clientId,
      code_verifier: verifier,
    }),
  );
  return true;
}

let refreshing: Promise<string | null> | null = null;

/** Jeton valide (rafraîchi si besoin), ou null s'il faut se reconnecter. */
export async function getAccessToken(clientId: string): Promise<string | null> {
  const token = readToken();
  if (!token) return null;
  if (token.expiresAt - Date.now() > 60_000) return token.accessToken;

  refreshing ??= requestToken({
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
    client_id: clientId,
  })
    .then((res) => {
      storeToken(res, token);
      return res.access_token;
    })
    .catch(() => {
      logout();
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}
