# study_with_me

[![CI](https://github.com/PLinV/study_with_me/actions/workflows/ci.yml/badge.svg)](https://github.com/PLinV/study_with_me/actions/workflows/ci.yml)

Petit projet pour avoir un lieu pour me concentrer en utilisant la méthode pomodoro :
une scène vidéo en boucle, un chrono pixel art, des stats et de la musique Spotify.

## Lancer

```bash
cp .env.example .env        # puis remplis SPOTIFY_CLIENT_ID
./scenes/download.sh        # récupère les scènes libres de droit (Pixabay)
docker compose up -d --build
```

Puis ouvre **http://127.0.0.1:8080** (et pas `localhost` : Spotify ne l'accepte pas).

## Installer sur un homelab (images GHCR)

Pas besoin du code : les images sont publiées sur GitHub Container Registry par la CI.

```bash
mkdir study-with-me && cd study-with-me
curl -fLO https://raw.githubusercontent.com/PLinV/study_with_me/main/deploy/docker-compose.yml
curl -fL -o .env https://raw.githubusercontent.com/PLinV/study_with_me/main/deploy/.env.example
# remplis POSTGRES_PASSWORD et SPOTIFY_CLIENT_ID dans .env
mkdir -p scenes/private      # tes vidéos .mp4 / .webm (optionnel)
docker compose pull && docker compose up -d
```

Mise à jour : `docker compose pull && docker compose up -d`. Pour figer une version, mets par exemple
`STUDY_WITH_ME_VERSION=1.0.0` dans `.env`.

Spotify (et les notifications) demandent une adresse **https** : mets le site derrière ton reverse proxy
(Caddy, Traefik, Nginx Proxy Manager…) et déclare `https://<ton-domaine>/callback` comme Redirect URI.
En simple `http://192.168.x.x:8080`, le chrono, les stats, les tâches et les scènes fonctionnent, mais pas Spotify.

## CI / CD

Le workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) :

1. **Vérifications** (à chaque push et PR) : typecheck de l'API et du front, build du front.
2. **Publication** (push sur `main` et tags `v*`) : images multi-architecture (`amd64` + `arm64`) poussées sur
   `ghcr.io/plinv/study-with-me-api` et `ghcr.io/plinv/study-with-me-web`.

| Événement | Tags publiés |
|---|---|
| push sur `main` | `latest`, `sha-<commit>` |
| tag `v1.2.3` | `1.2.3`, `1.2`, `sha-<commit>` |

## Architecture

| Service | Rôle |
|---|---|
| `web` | nginx : sert le front (Vue 3 + Vite + TypeScript) et le dossier `scenes/` |
| `api` | Node : `/api/config`, `/api/stats`, `/api/sessions`, `/api/tasks` (crée le schéma au démarrage) |
| `db`  | PostgreSQL, données dans le volume `pgdata` |

Les stats survivent aux `docker compose down` / rebuild. Seul `docker compose down -v` efface le volume.

## Scènes

- **Feu de camp pixel (renard)** : scène dessinée dans le code (`web/src/pixelScenes/`), disponible sans rien télécharger.
- `scenes/*.mp4` : scènes libres de droit (Pixabay), téléchargées par `scenes/download.sh` (pas versionnées).
- `scenes/private/` : tes vidéos perso, **ignorées par git**.

Dépose n'importe quel `.mp4` / `.webm` dans un de ces dossiers, il apparaît dans les réglages (pas besoin de rebuild).

Les vidéos bouclent avec un fondu enchaîné pour masquer le raccord.

Pour ajouter une scène depuis YouTube (usage perso, à lancer depuis la racine du projet ; nécessite `yt-dlp` et `ffmpeg`) :

```bash
yt-dlp --no-playlist -f "bv*[height<=1440][fps<=60]" -S "res,fps" --download-sections "*00:00:00-01:00:00" -o "scenes/private/%(title)s.%(ext)s" "URL_DE_LA_VIDEO"
```

## Spotify

1. Crée une app sur https://developer.spotify.com/dashboard
2. Redirect URI : `http://127.0.0.1:8080/callback`
3. Coche **Web API** et **Web Playback SDK**
4. *User Management* : ajoute l'email de ton compte Spotify
5. Mets le Client ID dans `.env` (`SPOTIFY_CLIENT_ID=...`) et relance `docker compose up -d`

Le bouton 🔍 (ou la touche **P**) ouvre le choix de playlist : tes playlists ou une recherche Spotify.
Si tu t'étais connecté avant l'ajout de cette fonction, clique sur « Reconnecter Spotify » pour donner l'accès à tes playlists.

Sous la musique, le switch **Son ici / Autre appareil** choisit où sort le son :
- **Son ici** : le navigateur joue la musique.
- **Autre appareil** : la musique continue sur ton téléphone (ou ailleurs) et l'app la pilote à distance
  (lecture, pause pendant les pauses, morceau suivant, volume si l'appareil l'autorise).

Changer de sortie met la musique en pause : appuie sur lecture pour la relancer sur la nouvelle sortie.

Les **touches multimédia** (boutons des écouteurs Bluetooth, touches du clavier, contrôles du système)
pilotent la musique : lecture, pause, morceau suivant / précédent.

Lecture uniquement avec un compte Premium, dans un navigateur qui gère les DRM (Chrome, Firefox avec DRM activé).

## Tâches

Le bouton **Tâches** (sous le compteur de pomodoros) ouvre la liste. Clique sur la case pour passer
une tâche de *à faire* → *en cours* → *terminée* ; double-clic sur le titre pour le renommer.
Une seule tâche peut être en cours : elle s'affiche en permanence sous le compteur.

## Raccourcis

| Touche | Action |
|---|---|
| Espace | Démarrer / pause |
| N | Passer la phase |
| R | Recommencer la phase |
| M | Musique lecture / pause |
| P | Choisir une playlist |
| T | Ouvrir / fermer les tâches |
| S | Réglages |
| F | Plein écran |
