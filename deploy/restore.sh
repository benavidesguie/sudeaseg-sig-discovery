#!/usr/bin/env bash
# Restaura un respaldo generado por backup.sh. REEMPLAZA los datos actuales.
# Uso: sudo bash deploy/restore.sh deploy/backups/db-AAAAMMDD-HHMMSS.dump [deploy/backups/uploads-AAAAMMDD-HHMMSS.tar.gz]
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE=(docker compose -f "$DEPLOY_DIR/docker-compose.yml")
db_dump="${1:?Indique el archivo db-*.dump}"
uploads="${2:-}"
[ -f "$db_dump" ] || { echo "No existe $db_dump"; exit 1; }

read -rp "Esto reemplaza la base de datos actual${uploads:+ y los adjuntos}. Escriba RESTAURAR para continuar: " ok
[ "$ok" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

"${COMPOSE[@]}" stop app
"${COMPOSE[@]}" exec -T db pg_restore -U relevamiento -d relevamiento --clean --if-exists --no-owner < "$db_dump"
if [ -n "$uploads" ]; then
  "${COMPOSE[@]}" run --rm --no-deps -T --entrypoint sh app -c 'rm -rf /app/storage/uploads && tar xzf - -C /app/storage' < "$uploads"
fi
"${COMPOSE[@]}" start app
echo "Restauración completada."
