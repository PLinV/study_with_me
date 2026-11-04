#!/usr/bin/env bash
# Télécharge les scènes libres de droit (licence Pixabay : https://pixabay.com/service/license-summary/).
# Les vidéos ne sont pas versionnées : la licence n'autorise pas à redistribuer
# les fichiers tels quels, donc chacun les récupère depuis la source avec ce script.
set -euo pipefail
cd "$(dirname "$0")"

# nom-du-fichier  url
SCENES=(
  # Pixabay : lofi / pixel art
  "chat-coucher-de-soleil https://cdn.pixabay.com/video/2025/04/07/270507_large.mp4"
)

for entry in "${SCENES[@]}"; do
  read -r name url <<<"$entry"
  file="$name.mp4"
  if [[ -f "$file" ]]; then
    echo "✓ $file (déjà là)"
    continue
  fi
  echo "↓ $file"
  curl -fL --progress-bar -o "$file.part" "$url"
  mv "$file.part" "$file"
done
