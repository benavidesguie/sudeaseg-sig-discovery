#!/usr/bin/env bash
# Instalación del Portal de Relevamiento en un VPS Ubuntu 22.04/24.04 (o Debian 12).
# Ejecutar como root desde la carpeta del repositorio clonado:  sudo bash deploy/install.sh
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"
COMPOSE=(docker compose -f "$DEPLOY_DIR/docker-compose.yml")

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mError: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "ejecute como root: sudo bash deploy/install.sh"

# 1. Docker
if ! command -v docker >/dev/null 2>&1; then
  say "Instalando Docker"
  apt-get update -y
  apt-get install -y ca-certificates curl
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 no está disponible"
systemctl enable --now docker >/dev/null 2>&1 || true

# 2. Memoria de intercambio: el build de Next.js necesita ~2 GB de RAM.
mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if [ "$mem_kb" -lt 3000000 ] && ! swapon --show | grep -q .; then
  say "Creando swap de 2 GB (el servidor tiene menos de 3 GB de RAM)"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 3. Firewall
if command -v ufw >/dev/null 2>&1; then
  say "Configurando firewall (SSH, HTTP, HTTPS)"
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
fi

# 4. Configuración (solo la primera vez)
if [ ! -f "$ENV_FILE" ]; then
  say "Configuración inicial"
  read -rp "Correo del administrador: " admin_email
  [ -n "$admin_email" ] || die "el correo es obligatorio"
  read -rp "Nombre del administrador [Consultor BI]: " admin_name
  admin_name=${admin_name:-Consultor BI}
  read -rp "Dominio del portal (deje vacío si aún no tiene): " domain
  if [ -z "$domain" ]; then
    ip=$(curl -fsS4 https://api.ipify.org || curl -fsS4 https://ifconfig.me || true)
    [ -n "$ip" ] || die "no se pudo detectar la IP pública; indique un dominio"
    domain="${ip//./-}.sslip.io"
    echo "Sin dominio: se usará $domain (apunta a $ip y obtiene certificado HTTPS válido)."
  fi
  admin_password=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)
  umask 077
  cat > "$ENV_FILE" <<CONF
SITE_ADDRESS=$domain
ACME_EMAIL=$admin_email
ADMIN_EMAIL=$admin_email
ADMIN_NAME=$admin_name
ADMIN_PASSWORD=$admin_password
AUTH_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
MAX_UPLOAD_MB=25
INSECURE_COOKIES=0
CONF
  chmod 600 "$ENV_FILE"
  echo "Configuración guardada en $ENV_FILE"
fi

# 5. Construcción y arranque
say "Construyendo y levantando los contenedores (la primera vez tarda unos minutos)"
"${COMPOSE[@]}" up -d --build

say "Esperando a que el portal responda"
for _ in $(seq 1 60); do
  status=$(docker inspect -f '{{.State.Health.Status}}' relevamiento-app-1 2>/dev/null || echo starting)
  [ "$status" = "healthy" ] && break
  sleep 5
done
[ "${status:-}" = "healthy" ] || { "${COMPOSE[@]}" logs --tail 50 app; die "el portal no quedó saludable; revise los logs de arriba"; }

# 6. Backup diario a las 02:30
cat > /etc/cron.d/relevamiento-backup <<CRON
30 2 * * * root bash $DEPLOY_DIR/backup.sh >> /var/log/relevamiento-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/relevamiento-backup

# shellcheck disable=SC1090
. "$ENV_FILE"
say "Listo"
cat <<MSG
  Portal:         https://$SITE_ADDRESS
  Administrador:  $ADMIN_EMAIL
  Contraseña:     $ADMIN_PASSWORD   (guárdela; también está en $ENV_FILE)

  El certificado HTTPS puede tardar un minuto en emitirse la primera vez.
  Backups diarios en $DEPLOY_DIR/backups (02:30).
MSG
