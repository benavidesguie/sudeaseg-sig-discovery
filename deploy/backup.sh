#!/usr/bin/env bash
# Respaldo de la base de datos y de los archivos adjuntos. Conserva los últimos RETENTION_DAYS días.
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$DEPLOY_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE=(docker compose -f "$DEPLOY_DIR/docker-compose.yml")
stamp=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
"${COMPOSE[@]}" exec -T db pg_dump -U relevamiento -d relevamiento -Fc > "$BACKUP_DIR/db-$stamp.dump"
"${COMPOSE[@]}" exec -T app tar czf - -C /app/storage uploads > "$BACKUP_DIR/uploads-$stamp.tar.gz"
find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime +"$RETENTION_DAYS" -delete
echo "$(date -Is) backup OK: db-$stamp.dump, uploads-$stamp.tar.gz"
