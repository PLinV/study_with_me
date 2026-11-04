# study_with_me

Petit projet pour avoir un lieu pour me concentrer en utilisant la méthode pomodoro :
une scène vidéo en boucle, un chrono pixel art, des stats et de la musique Spotify.

## Lancer

```bash
cp .env.example .env        # puis remplis SPOTIFY_CLIENT_ID
./scenes/download.sh        # récupère les scènes libres de droit (Mixkit)
docker compose up -d --build
```

Puis ouvre **http://127.0.0.1:8080** (et pas `localhost` : Spotify ne l'accepte pas).

## Architecture

| Service | Rôle |
|---|---|
| `web` | nginx : sert le front (Vue 3 + Vite + TypeScript) et le dossier `scenes/` |
| `api` | Node : `/api/config`, `/api/stats`, `POST /api/sessions` |
| `db`  | PostgreSQL, données dans le volume `pgdata` |

Les stats survivent aux `docker compose down` / rebuild. Seul `docker compose down -v` efface le volume.

## Scènes

- **Feu de camp pixel (renard)** : scène dessinée dans le code (`web/src/pixelScenes/`), disponible sans rien télécharger.
- `scenes/*.mp4` : scènes libres de droit (Pixabay), téléchargées par `scenes/download.sh` (pas versionnées).
- `scenes/private/` : tes vidéos perso, **ignorées par git**.

Dépose n'importe quel `.mp4` / `.webm` dans un de ces dossiers, il apparaît dans les réglages (pas besoin de rebuild).

```bash
yt-dlp -f "bv*[height<=1440][fps<=60]" -S "res,fps" --download-sections "*00:00:00-01:00:00" -o "scenes/private/%(title)s.%(ext)s" "URL_DE_LA_VIDEO" 
```

## Spotify

1. Crée une app sur https://developer.spotify.com/dashboard
2. Redirect URI : `http://127.0.0.1:8080/callback`
3. Coche **Web API** et **Web Playback SDK**
4. *User Management* : ajoute l'email de ton compte Spotify
5. Mets le Client ID dans `.env` (`SPOTIFY_CLIENT_ID=...`) et relance `docker compose up -d`

Le bouton 🔍 (ou la touche **P**) ouvre le choix de playlist : tes playlists ou une recherche Spotify.
Si tu t'étais connecté avant l'ajout de cette fonction, clique sur « Reconnecter Spotify » pour donner l'accès à tes playlists.

Lecture uniquement avec un compte Premium, dans un navigateur qui gère les DRM (Chrome, Firefox avec DRM activé).

## Raccourcis

| Touche | Action |
|---|---|
| Espace | Démarrer / pause |
| N | Passer la phase |
| R | Recommencer la phase |
| M | Musique lecture / pause |
| P | Choisir une playlist |
| S | Réglages |
| F | Plein écran |
