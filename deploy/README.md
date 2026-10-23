# Despliegue en un servidor (VPS)

Esta carpeta instala el portal en un servidor Linux con tres contenedores:

- **db:** PostgreSQL 16.
- **app:** el portal.
- **caddy:** sirve el portal por HTTPS y renueva solo el certificado (Let's Encrypt).

Los datos y los adjuntos viven en volúmenes de Docker. Un respaldo diario queda en `deploy/backups/`.

## 1. Contratar el servidor

| | Mínimo | Recomendado |
|---|---|---|
| Sistema | Ubuntu 22.04 o 24.04 LTS (también Debian 12) | Ubuntu 24.04 LTS |
| CPU / RAM | 1 vCPU / 2 GB | 2 vCPU / 4 GB |
| Disco | 25 GB | 50 GB (adjuntos y respaldos) |

Sirve cualquier proveedor (DigitalOcean, Hetzner, AWS Lightsail/EC2, Contabo, Vultr…). Al crearlo:

- Agregue su llave SSH o anote la contraseña de root.
- Si el proveedor tiene firewall propio (security group, cloud firewall), abra los puertos **22, 80 y 443**.

## 2. Entrar al servidor

```bash
ssh root@IP_DEL_SERVIDOR
```

## 3. Descargar el código

Si el repositorio es privado, el servidor necesita permiso de lectura. Lo más seguro es una *deploy key* de solo lectura:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Copie la línea que se imprime y agréguela en GitHub: repositorio → **Settings → Deploy keys → Add deploy key**, sin marcar "Allow write access". Después:

```bash
apt-get update && apt-get install -y git
git clone -b claude/zealous-sagan-wqsnbk git@github.com:benavidesguie/sudeaseg-sig-discovery.git /opt/relevamiento
cd /opt/relevamiento
```

> Cuando la rama se fusione a `main`, use `-b main` (o `git checkout main` en un servidor ya instalado).

## 4. Instalar

```bash
sudo bash deploy/install.sh
```

El script:

1. Instala Docker si hace falta y agrega memoria swap si el servidor tiene menos de 3 GB de RAM.
2. Configura el firewall (`ufw`) para permitir SSH, HTTP y HTTPS.
3. Le pregunta el correo y nombre del administrador y el dominio.
4. Genera secretos aleatorios y la contraseña del admin en `deploy/.env` (permisos 600).
5. Construye y levanta los contenedores. La primera vez tarda entre 3 y 8 minutos.
6. Programa el respaldo diario a las 02:30.

Al terminar muestra la dirección y la contraseña del administrador. **Guárdela.**

### Sin dominio todavía

Si deja el dominio vacío, el script usa la IP pública con [sslip.io](https://sslip.io): por ejemplo, la IP `203.0.113.5` queda como `https://203-0-113-5.sslip.io`. Ese nombre apunta automáticamente a su servidor y obtiene un certificado HTTPS válido, sin configurar nada. Sirve para empezar a trabajar con el cliente; cuando tengan dominio, cámbielo (sección 6).

## 5. Primeros pasos en el portal

1. Entre con el administrador.
2. Vaya a **Usuarios y roles** y cree los usuarios de negocio y de TI.
3. Vaya a **Catálogo semilla**, cargue los 22 sistemas con sus SPOC y presione **Confirmar catálogo**.
4. Comparta la dirección y las credenciales con cada usuario por un canal seguro.

No cargue los datos de demostración en este servidor.

## 6. Usar un dominio propio

1. En el DNS del dominio, cree un registro **A** que apunte al servidor (por ejemplo, `relevamiento.empresa.com → IP_DEL_SERVIDOR`). Espere a que propague (`ping relevamiento.empresa.com` debe responder con la IP).
2. En el servidor, cambie el dominio y reinicie Caddy:

```bash
cd /opt/relevamiento
sed -i 's/^SITE_ADDRESS=.*/SITE_ADDRESS=relevamiento.empresa.com/' deploy/.env
docker compose -f deploy/docker-compose.yml up -d
```

Caddy obtiene el certificado nuevo solo.

## 7. Operación diaria

Todos los comandos se ejecutan desde `/opt/relevamiento`.

| Tarea | Comando |
|---|---|
| Ver estado | `docker compose -f deploy/docker-compose.yml ps` |
| Ver logs del portal | `docker compose -f deploy/docker-compose.yml logs -f app` |
| Actualizar a la última versión | `sudo bash deploy/update.sh` (hace un respaldo antes) |
| Respaldo manual | `sudo bash deploy/backup.sh` |
| Restaurar un respaldo | `sudo bash deploy/restore.sh deploy/backups/db-FECHA.dump deploy/backups/uploads-FECHA.tar.gz` |
| Reiniciar | `docker compose -f deploy/docker-compose.yml restart` |

- **Respaldos:** quedan en `deploy/backups/` y se conservan 14 días. Para resistir la pérdida del servidor, cópielos periódicamente fuera de él (por ejemplo, con `rsync` a otro equipo o a un almacenamiento S3). Además, active los *snapshots* del proveedor si los ofrece.
- **Contraseña del admin:** la que está en `deploy/.env` solo se usa para crear el admin la primera vez. Después, cámbiela desde **Usuarios y roles → Contraseña**.

## 8. Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| El navegador no conecta o el certificado falla | Los puertos 80/443 están cerrados en el firewall del proveedor, o el DNS aún no apunta al servidor. Revise con `docker compose -f deploy/docker-compose.yml logs caddy`. |
| La instalación se detiene durante el build | Falta de memoria. Use un servidor con al menos 2 GB de RAM (el script agrega swap) y vuelva a ejecutar `install.sh`. |
| "el portal no quedó saludable" | Revise `logs app`. Suele ser un valor faltante o mal escrito en `deploy/.env`. |
| No puedo iniciar sesión por HTTP (sin HTTPS) | La cookie de sesión exige HTTPS. Use el dominio o la dirección sslip.io con `https://`. |
