#!/usr/bin/env bash
# Actualiza el portal a la última versión de la rama actual. Hace un backup antes.
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE=(docker compose -f "$DEPLOY_DIR/docker-compose.yml")
cd "$DEPLOY_DIR/.."
bash "$DEPLOY_DIR/backup.sh"
git pull --ff-only
"${COMPOSE[@]}" up -d --build
docker image prune -f >/dev/null
echo "Actualizado a $(git log -1 --format='%h %s')"
