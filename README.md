# Inventario de Sistemas · Sistemas e indicadores de gestión

Aplicación web para capturar de forma asincrónica, guiada y validada la información de las Fases 0 a 3 del *Discovery & Assessment*: inventario de los 30 sistemas (`SIS-01`..`SIS-30`), KPI Canvas, metadatos técnicos, conectividad y homologación de maestros. Al final genera el dossier técnico y la matriz de trazabilidad.

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript · Prisma 6 · PostgreSQL 16 · Tailwind CSS 4.

## Puesta en marcha

### En un servidor (producción)

Siga la guía [`deploy/README.md`](deploy/README.md): un script instala Docker, genera los secretos, levanta PostgreSQL, el portal y Caddy (HTTPS automático) y programa respaldos diarios.

### Opción A: Docker Compose (prueba local)

```bash
export AUTH_SECRET="$(openssl rand -hex 32)"
export ADMIN_EMAIL="admin@su-dominio.com"
export ADMIN_PASSWORD="UnaClaveSegura123"
export POSTGRES_PASSWORD="otra-clave-segura"
docker compose up -d --build
```

El portal queda en `http://localhost:3000`. Al arrancar aplica las migraciones y crea el admin y los códigos del catálogo (sin sobrescribir datos existentes). Los adjuntos se guardan en el volumen `uploads`.

> La cookie de sesión es `Secure` en producción, así que el portal debe servirse por HTTPS (por ejemplo, detrás de un proxy inverso). Solo para pruebas en una red interna sin TLS se puede usar `INSECURE_COOKIES=1`.

### Opción B: local

Requiere Node.js 22 y PostgreSQL 14 o superior.

```bash
cp .env.example .env          # ajuste DATABASE_URL, AUTH_SECRET y el usuario admin
npm install
npx prisma migrate deploy
npm run db:seed               # admin + catálogo SIS-01..SIS-30
npm run db:seed:demo          # (opcional) datos ficticios de demostración
npm run dev                   # http://localhost:3000
```

Los datos de demostración crean `admin@demo.local`, `negocio@demo.local` y `ti@demo.local` con la clave `Demo12345!`. **No ejecute el seed de demo en el ambiente del cliente.**

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm test` | Pruebas unitarias (oleadas, validaciones, parser de esquemas, códigos KPI) |
| `npm run typecheck` | Verificación de tipos |
| `npm run db:migrate` | Aplica migraciones pendientes |

## Flujo de uso

1. **Fase 0 · Catálogo semilla** (Admin → *Catálogo semilla*): cree usuarios, cargue el nombre común de los 30 sistemas y asigne el responsable funcional y técnico de cada uno. Al **confirmar el catálogo** se habilitan los formularios para el resto de los roles; antes de eso los ven en solo lectura. Para ampliar el inventario, cambie `TOTAL_SYSTEMS` en `src/lib/catalogs.ts` y reconstruya: al arrancar se crean los códigos nuevos sin tocar los existentes.
2. **Módulo 1 · Ficha de sistema** (Fase 1): wizard de 3 bloques con borrador y completado. Negocio edita el Bloque A y el dueño funcional; TI edita el custodio, tipo de solución, nivel de acceso, proveedor y el Bloque C. Si el acceso es `RESTRICTED_VENDOR`, se exige el bloque del proveedor y el sistema aparece con **alerta roja** en el dashboard.
3. **Módulo 2 · KPI Canvas** (Fase 2A): definición, fórmula, reglas, dimensiones, variables vinculadas al selector oficial `SIS-XX` con ID de transacción de ejemplo, y evidencias (Excel obligatorio si el cálculo es un cruce manual en Excel, más las capturas de transacción y de reporte). El código `KPI-<DOM>-NN` se asigna automáticamente.
4. **Módulo 3 · Metadatos** (Fase 2B): solo se habilita para sistemas vinculados a por lo menos un KPI (*KPI-Driven Discovery*). Muestra el script de extracción según el motor declarado en el Módulo 1 (PostgreSQL, SQL Server, MySQL, Oracle, MongoDB, archivos planos/Excel, o una plantilla para SaaS). TI sube el CSV/JSON resultante, usa el buscador de tablas y columnas, y en la mesa *Follow the Data* vincula cada variable con su tabla, columna, llave primaria y campo incremental. El portal valida que las tablas y columnas existan en el esquema cargado.
5. **Módulo 4 · Conectividad** (Fase 3): patrón de integración (Tipo A a D), requisitos de red, carga incremental, volumetría y ventana de extracción.
6. **Módulo 5 · Homologación**: grilla editable por entidad maestra (sucursales, centros de costo, líneas de negocio, monedas) con el código canónico y su equivalencia en cada sistema.
7. **Exportables** (Admin): dossier técnico (JSON, Markdown y vista de impresión para PDF) y matriz de trazabilidad KPI → Variable → Sistema → Tabla → Columna → Regla (Excel y CSV).

### Roles

| Rol | Acceso |
|---|---|
| Admin / Consultor BI | Todo: catálogo, usuarios, todos los módulos, exportables y bitácora |
| Líder funcional / Key User | Dashboard, Módulo 1 (sección funcional), Módulo 2, Módulo 5 |
| Custodio técnico / DBA | Dashboard, Módulo 1 (sección técnica), Módulo 3, Módulo 4 |

### Clasificación de oleadas

Se recalcula al guardar los Módulos 1 y 4 (`src/lib/waves.ts`):

| Condición | Oleada |
|---|---|
| Criticidad `BAJA`, o patrón `TYPE_D_CONTROLLED_MANUAL` | 3 |
| `ALTA` y acceso directo (`TOTAL`, `DB_ONLY`, `API_ONLY`) | 1 |
| `ALTA` y acceso `RESTRICTED_VENDOR` o `MANUAL_EXPORT` | 2 |
| `MEDIA` y acceso directo | 2 |
| `MEDIA` y acceso restringido o manual | 3 |
| Sin criticidad o sin nivel de acceso | Sin clasificar |

El PRD no define los casos `ALTA + MANUAL_EXPORT` y `MEDIA` con acceso restringido o manual; se resolvieron como se indica arriba. El patrón Tipo D tiene precedencia: un sistema crítico que se alimentará por plantilla manual va a la Oleada 3.

## Decisiones respecto del PRD

- **Campos obligatorios y borradores:** en la base de datos los campos "obligatorios" del PRD son opcionales para permitir el guardado parcial. La obligatoriedad se exige al marcar la ficha como completada (`src/lib/validation.ts`). Si alguien pide completar y faltan campos, lo cargado se guarda igual como borrador.
- **Adjuntos:** en lugar de `evidence_files JSONB` se usa una tabla `attachments` (documentación de sistemas, evidencias de KPI, esquemas subidos). Los archivos se guardan en disco (`UPLOAD_DIR`); solo se aceptan extensiones permitidas por tipo y se sirven con el MIME deducido de la extensión.
- **Estado del KPI:** `DRAFT` → `BUSINESS_COMPLETED` (negocio completo con evidencias) → `TECH_MAPPED` (todas las variables con tabla, columna y llave primaria). Si cambia el sistema fuente de una variable, se borra su mapeo físico.
- **Campos agregados:** `exists_in_other_system` en las variables (está en el formulario del PRD pero no en su SQL), `common_name` y SPOC en `systems_inventory` (Fase 0), `vendor_risk_alert`, y la bitácora `activity_log`.
- **PDF del dossier:** se genera desde la vista de impresión del navegador ("Guardar como PDF").

## Estructura

```
prisma/                  esquema, migraciones y seeds
src/lib/                 lógica de dominio sin dependencias de servidor (catálogos, validaciones,
                         oleadas, parser de esquemas, scripts SQL) + pruebas *.test.ts
src/lib/server/          acceso a BD, sesión, almacenamiento, exportables
src/app/actions/         server actions por módulo (con control de rol y Fase 0)
src/app/api/             adjuntos, carga/búsqueda de esquemas, exportables
src/app/(portal)/        páginas del portal
```
