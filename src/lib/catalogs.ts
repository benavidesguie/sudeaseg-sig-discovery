// Catálogos cerrados del PRD (§4). Cada catálogo es una lista de [valor, etiqueta].
// Los valores son los que se guardan en BD; las etiquetas son las que ve el usuario.

type Catalog = readonly (readonly [string, string])[];

function values<T extends Catalog>(c: T) {
  return c.map(([v]) => v) as unknown as [T[number][0], ...T[number][0][]];
}

export function labelOf(c: Catalog, value: string | null | undefined): string {
  if (!value) return "—";
  return c.find(([v]) => v === value)?.[1] ?? value;
}

export const TOTAL_SYSTEMS = 30;
export const SYSTEM_CODES = Array.from(
  { length: TOTAL_SYSTEMS },
  (_, i) => `SIS-${String(i + 1).padStart(2, "0")}`,
);
/** Rango legible del catálogo, p. ej. "SIS-01..SIS-30". */
export const SYSTEM_RANGE = `${SYSTEM_CODES[0]}..${SYSTEM_CODES[TOTAL_SYSTEMS - 1]}`;

export const BUSINESS_DOMAINS = [
  ["FINANZAS", "Finanzas"],
  ["COMERCIAL", "Comercial"],
  ["OPERACIONES", "Operaciones"],
  ["LOGISTICA", "Logística"],
  ["RRHH", "Recursos Humanos"],
  ["ATENCION_CLIENTE", "Atención al Cliente"],
  ["TRANSVERSAL", "Transversal"],
] as const;
export const BUSINESS_DOMAIN_VALUES = values(BUSINESS_DOMAINS);

// Prefijo usado en el código autogenerado de KPI (KPI-FIN-01).
export const DOMAIN_PREFIX: Record<string, string> = {
  FINANZAS: "FIN",
  COMERCIAL: "COM",
  OPERACIONES: "OPE",
  LOGISTICA: "LOG",
  RRHH: "RRHH",
  ATENCION_CLIENTE: "ATC",
  TRANSVERSAL: "TRV",
};

export const ACTIVE_USERS_RANGES = [
  ["1-10", "1 - 10"],
  ["11-50", "11 - 50"],
  ["51-200", "51 - 200"],
  ["200+", "Más de 200"],
] as const;
export const ACTIVE_USERS_RANGE_VALUES = values(ACTIVE_USERS_RANGES);

export const KPI_CRITICALITIES = [
  ["ALTA", "Alta — fuente primaria para indicadores estratégicos inmediatos (Oleada 1)"],
  ["MEDIA", "Media — fuente táctica o secundaria (Oleada 2)"],
  ["BAJA", "Baja — consulta histórica o baja prioridad (Oleada 3)"],
] as const;
export const KPI_CRITICALITY_VALUES = values(KPI_CRITICALITIES);
export const CRITICALITY_SHORT: Record<string, string> = { ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" };

export const SOLUTION_TYPES = [
  ["ERP", "ERP"],
  ["CRM", "CRM"],
  ["CUSTOM_INHOUSE", "Desarrollo a medida (in-house)"],
  ["THIRD_PARTY_ONPREM", "Software de terceros on-premise"],
  ["SAAS", "SaaS"],
  ["CRITICAL_SPREADSHEET", "Hoja de cálculo crítica"],
] as const;
export const SOLUTION_TYPE_VALUES = values(SOLUTION_TYPES);

// Ordenados de mayor a menor facilidad de acceso (eje X de la matriz de oleadas).
export const ACCESS_LEVELS = [
  ["TOTAL", "Total — control interno de código y base de datos"],
  ["DB_ONLY", "Solo BD — software cerrado con lectura directa a la BD"],
  ["API_ONLY", "Solo API — sin BD, con API documentada o webhooks"],
  ["RESTRICTED_VENDOR", "Restringido por proveedor externo"],
  ["MANUAL_EXPORT", "Solo exportación manual (Excel/CSV)"],
] as const;
export const ACCESS_LEVEL_VALUES = values(ACCESS_LEVELS);
export const ACCESS_SHORT: Record<string, string> = {
  TOTAL: "Total",
  DB_ONLY: "Solo BD",
  API_ONLY: "Solo API",
  RESTRICTED_VENDOR: "Restringido proveedor",
  MANUAL_EXPORT: "Exportación manual",
};

export const EXTRA_FEE_OPTIONS = [
  ["SI", "Sí"],
  ["NO", "No"],
  ["POR_CONFIRMAR", "Por confirmar"],
] as const;
export const EXTRA_FEE_VALUES = values(EXTRA_FEE_OPTIONS);

export const HOSTING_TYPES = [
  ["ON_PREMISE", "On-premise"],
  ["PRIVATE_CLOUD_VPS", "Nube privada / VPS"],
  ["SAAS_CLOUD", "SaaS en la nube"],
  ["LOCAL_SHARED_FOLDER", "Carpeta compartida local"],
] as const;
export const HOSTING_TYPE_VALUES = values(HOSTING_TYPES);

export const DB_ENGINES = [
  ["POSTGRESQL", "PostgreSQL"],
  ["SQL_SERVER", "SQL Server"],
  ["MYSQL_MARIADB", "MySQL / MariaDB"],
  ["ORACLE", "Oracle"],
  ["MONGODB_NOSQL", "MongoDB / NoSQL"],
  ["FLAT_FILES_DBF_CSV", "Archivos planos (DBF/CSV)"],
  ["EXCEL", "Excel"],
  ["UNKNOWN_SAAS", "Desconocido (SaaS)"],
] as const;
export const DB_ENGINE_VALUES = values(DB_ENGINES);

export const DOC_STATUSES = [
  ["MER_AVAILABLE", "Modelo entidad-relación disponible"],
  ["DATA_DICT_AVAILABLE", "Diccionario de datos disponible"],
  ["API_DOCS_AVAILABLE", "Documentación de API disponible"],
  ["NONE", "Sin documentación"],
] as const;
export const DOC_STATUS_VALUES = values(DOC_STATUSES);

export const UNITS_OF_MEASURE = [
  ["PERCENTAGE", "Porcentaje (%)"],
  ["CURRENCY", "Moneda"],
  ["UNITS_COUNT", "Cantidad de unidades"],
  ["TIME_DURATION", "Duración / tiempo"],
  ["RATIO_INDEX", "Razón / índice"],
] as const;
export const UNIT_OF_MEASURE_VALUES = values(UNITS_OF_MEASURE);

export const FREQUENCIES = [
  ["REALTIME_INTRADAY", "Tiempo real / intradía"],
  ["DAILY", "Diaria"],
  ["WEEKLY", "Semanal"],
  ["BIWEEKLY", "Quincenal"],
  ["MONTHLY", "Mensual"],
] as const;
export const FREQUENCY_VALUES = values(FREQUENCIES);

export const TREND_DIRECTIONS = [
  ["UP_IS_BETTER", "Mayor es mejor"],
  ["DOWN_IS_BETTER", "Menor es mejor"],
  ["TARGET_RANGE", "Dentro de un rango meta"],
] as const;
export const TREND_DIRECTION_VALUES = values(TREND_DIRECTIONS);

export const DIMENSIONS = [
  ["TIEMPO", "Tiempo"],
  ["SUCURSAL_SEDE", "Sucursal / sede"],
  ["LINEA_PRODUCTO", "Línea de producto"],
  ["VENDEDOR_RESPONSABLE", "Vendedor / responsable"],
  ["TIPO_CLIENTE", "Tipo de cliente"],
  ["CANAL_VENTA", "Canal de venta"],
  ["CENTRO_COSTO", "Centro de costo"],
] as const;
export const DIMENSION_VALUES = values(DIMENSIONS);

export const CALCULATION_METHODS = [
  ["NATIVE_REPORT", "Reporte nativo del sistema"],
  ["MANUAL_EXCEL_CROSSING", "Cruce manual en Excel"],
  ["NOT_MEASURED_YET", "Aún no se mide"],
] as const;
export const CALCULATION_METHOD_VALUES = values(CALCULATION_METHODS);

export const INTEGRATION_PATTERNS = [
  ["TYPE_A_DIRECT_DB", "Tipo A — Conexión directa de solo lectura (JDBC/ODBC)"],
  ["TYPE_B_API", "Tipo B — API REST / SOAP / GraphQL / Webhook"],
  ["TYPE_C_FILE_EXCHANGE", "Tipo C — Archivos planos a SFTP / Object Storage"],
  ["TYPE_D_CONTROLLED_MANUAL", "Tipo D — Plantilla estandarizada de carga manual"],
] as const;
export const INTEGRATION_PATTERN_VALUES = values(INTEGRATION_PATTERNS);
export const PATTERN_SHORT: Record<string, string> = {
  TYPE_A_DIRECT_DB: "Tipo A · BD directa",
  TYPE_B_API: "Tipo B · API",
  TYPE_C_FILE_EXCHANGE: "Tipo C · Archivos",
  TYPE_D_CONTROLLED_MANUAL: "Tipo D · Manual",
};

export const NETWORK_REQUIREMENTS = [
  ["VPN_SITE_TO_SITE", "VPN site-to-site"],
  ["FIREWALL_WHITELIST", "Lista blanca en firewall"],
  ["SSH_TUNNEL", "Túnel SSH"],
  ["PUBLIC_HTTPS_OAUTH", "HTTPS público con OAuth"],
  ["LOCAL_LAN", "Red local (LAN)"],
] as const;
export const NETWORK_REQUIREMENT_VALUES = values(NETWORK_REQUIREMENTS);

export const VOLUME_ESTIMATES = [
  ["LT_100K", "< 100k filas"],
  ["100K_1M", "100k - 1M filas"],
  ["1M_10M", "1M - 10M filas"],
  ["GT_10M", "> 10M filas"],
] as const;
export const VOLUME_ESTIMATE_VALUES = values(VOLUME_ESTIMATES);

export const MASTER_ENTITIES = [
  ["SUCURSALES", "Sucursales"],
  ["CENTROS_DE_COSTO", "Centros de costo"],
  ["LINEAS_DE_NEGOCIO", "Líneas de negocio"],
  ["MONEDAS", "Monedas"],
] as const;
export const MASTER_ENTITY_VALUES = values(MASTER_ENTITIES);

export const PHASE_STATUSES = [
  ["PENDING", "Pendiente"],
  ["DRAFT", "Borrador"],
  ["COMPLETED", "Completado"],
] as const;

export const KPI_STATUSES = [
  ["DRAFT", "Borrador"],
  ["BUSINESS_COMPLETED", "Completado por negocio"],
  ["TECH_MAPPED", "Mapeado por TI"],
] as const;

export const ROLES = [
  ["ADMIN", "Administrador / Consultor BI"],
  ["BUSINESS", "Líder funcional / Usuario clave"],
  ["TECH", "Custodio técnico / DBA / Infraestructura"],
] as const;

export const ATTACHMENT_KINDS = {
  SYSTEM_DOC: "Documentación del sistema",
  KPI_EXCEL: "Excel de cálculo actual",
  KPI_SCREENSHOT_TRANSACTION: "Captura de la transacción de ejemplo",
  KPI_SCREENSHOT_REPORT: "Captura del reporte actual",
  SCHEMA_UPLOAD: "Esquema exportado (CSV/JSON)",
} as const;
export type AttachmentKind = keyof typeof ATTACHMENT_KINDS;
