// Generador del script de extracción de metadatos (Módulo 3 · punto 1).
// Todos los scripts producen las mismas columnas de salida, que son las que espera
// el parseador: esquema, nombre_tabla, nombre_columna, tipo_dato, permite_nulos, longitud_maxima.

export type ExtractionScript = {
  title: string;
  language: "sql" | "javascript" | "python" | "csv";
  script: string;
  steps: string[];
};

const POSTGRES = `-- Consulta universal de metadatos · PostgreSQL
SELECT
    TABLE_SCHEMA             AS esquema,
    TABLE_NAME               AS nombre_tabla,
    COLUMN_NAME              AS nombre_columna,
    DATA_TYPE                AS tipo_dato,
    IS_NULLABLE              AS permite_nulos,
    CHARACTER_MAXIMUM_LENGTH AS longitud_maxima
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;`;

const SQL_SERVER = `-- Consulta universal de metadatos · SQL Server
-- Ejecutar en cada base de datos del sistema (USE <base>;)
SELECT
    TABLE_SCHEMA             AS esquema,
    TABLE_NAME               AS nombre_tabla,
    COLUMN_NAME              AS nombre_columna,
    DATA_TYPE                AS tipo_dato,
    IS_NULLABLE              AS permite_nulos,
    CHARACTER_MAXIMUM_LENGTH AS longitud_maxima
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA', 'sys')
ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;`;

const MYSQL = `-- Consulta universal de metadatos · MySQL / MariaDB
SELECT
    TABLE_SCHEMA             AS esquema,
    TABLE_NAME               AS nombre_tabla,
    COLUMN_NAME              AS nombre_columna,
    DATA_TYPE                AS tipo_dato,
    IS_NULLABLE              AS permite_nulos,
    CHARACTER_MAXIMUM_LENGTH AS longitud_maxima
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;`;

const ORACLE = `-- Consulta de metadatos · Oracle (ALL_TAB_COLUMNS equivale a INFORMATION_SCHEMA)
SELECT
    OWNER                                         AS esquema,
    TABLE_NAME                                    AS nombre_tabla,
    COLUMN_NAME                                   AS nombre_columna,
    DATA_TYPE                                     AS tipo_dato,
    CASE NULLABLE WHEN 'Y' THEN 'YES' ELSE 'NO' END AS permite_nulos,
    CHAR_LENGTH                                   AS longitud_maxima
FROM ALL_TAB_COLUMNS
WHERE OWNER NOT IN ('SYS', 'SYSTEM', 'XDB', 'MDSYS', 'CTXSYS', 'ORDSYS', 'OUTLN', 'DBSNMP',
                    'APPQOSSYS', 'WMSYS', 'OJVMSYS', 'LBACSYS', 'GSMADMIN_INTERNAL',
                    'AUDSYS', 'DVSYS', 'OLAPSYS', 'ORDDATA', 'DVF')
ORDER BY OWNER, TABLE_NAME, COLUMN_ID;`;

const MONGO = `// Inferencia de esquema · MongoDB (muestrea 500 documentos por colección)
// Uso: mongosh "<cadena-de-conexión>" --quiet --file extraer_esquema.js > esquema.json
const out = [];
db.getCollectionNames().forEach((name) => {
  const fields = {};
  db.getCollection(name).aggregate([{ $sample: { size: 500 } }]).forEach((doc) => {
    (function walk(obj, prefix) {
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? prefix + "." + key : key;
        const type =
          value === null ? "null"
          : Array.isArray(value) ? "array"
          : value instanceof Date ? "date"
          : value && value._bsontype ? String(value._bsontype).toLowerCase()
          : typeof value;
        (fields[path] = fields[path] || new Set()).add(type);
        if (type === "object") walk(value, path);
      }
    })(doc, "");
  });
  for (const [field, types] of Object.entries(fields)) {
    out.push({
      esquema: db.getName(),
      nombre_tabla: name,
      nombre_columna: field,
      tipo_dato: [...types].join("|"),
      permite_nulos: types.has("null") ? "YES" : "NO",
      longitud_maxima: null,
    });
  }
});
print(JSON.stringify(out));`;

const FILES = `# Inventario de columnas de archivos planos / Excel
# Requisitos: pip install pandas openpyxl dbfread
# Uso: python extraer_esquema.py "C:\\ruta\\carpeta_del_sistema"  -> genera esquema.csv
import sys, pathlib
import pandas as pd

rows = []
for path in pathlib.Path(sys.argv[1]).rglob("*"):
    ext = path.suffix.lower()
    try:
        if ext in (".csv", ".txt"):
            sheets = {path.stem: pd.read_csv(path, nrows=1000, sep=None, engine="python")}
        elif ext in (".xlsx", ".xlsm", ".xls"):
            sheets = pd.read_excel(path, sheet_name=None, nrows=1000)
        elif ext == ".dbf":
            from dbfread import DBF
            table = DBF(str(path), load=False)
            sheets = {path.stem: pd.DataFrame([r for _, r in zip(range(1000), table)])}
        else:
            continue
    except Exception as exc:
        print(f"No se pudo leer {path}: {exc}", file=sys.stderr)
        continue
    for sheet, df in sheets.items():
        for col in df.columns:
            rows.append({
                "esquema": path.name,
                "nombre_tabla": sheet,
                "nombre_columna": str(col),
                "tipo_dato": str(df[col].dtype),
                "permite_nulos": "YES" if df[col].isna().any() else "NO",
                "longitud_maxima": int(df[col].astype(str).str.len().max()) if len(df) else None,
            })

pd.DataFrame(rows).to_csv("esquema.csv", index=False)
print(f"{len(rows)} columnas exportadas a esquema.csv")`;

const TEMPLATE = `esquema,nombre_tabla,nombre_columna,tipo_dato,permite_nulos,longitud_maxima
ventas,facturas,numero_factura,varchar,NO,20
ventas,facturas,fecha_emision,date,NO,
ventas,facturas,monto_total,decimal,NO,`;

export function extractionScriptFor(dbEngine: string | null | undefined): ExtractionScript {
  switch (dbEngine) {
    case "POSTGRESQL":
      return {
        title: "PostgreSQL · INFORMATION_SCHEMA",
        language: "sql",
        script: POSTGRES,
        steps: [
          "Conéctese con un usuario de solo lectura a la base de datos del sistema.",
          "Ejecute el script. Desde psql puede exportar directamente con: \\copy (<consulta sin ;>) TO 'esquema.csv' WITH CSV HEADER",
          "Suba el archivo CSV resultante en esta página.",
        ],
      };
    case "SQL_SERVER":
      return {
        title: "SQL Server · INFORMATION_SCHEMA",
        language: "sql",
        script: SQL_SERVER,
        steps: [
          "Ejecute el script en SSMS o Azure Data Studio sobre cada base de datos del sistema.",
          "En la grilla de resultados use \"Guardar resultados como…\" → CSV (incluya encabezados), o agregue FOR JSON PATH al final y guarde el JSON.",
          "Si son varias bases, puede subir un archivo por vez: cada carga reemplaza la anterior, así que combínelas en un solo archivo.",
        ],
      };
    case "MYSQL_MARIADB":
      return {
        title: "MySQL / MariaDB · INFORMATION_SCHEMA",
        language: "sql",
        script: MYSQL,
        steps: [
          "Ejecute el script con un usuario de solo lectura.",
          "Desde consola: mysql -h <host> -u <usuario> -p -B -e \"<consulta>\" > esquema.tsv (separado por tabulaciones, también se acepta).",
          "Suba el archivo resultante en esta página.",
        ],
      };
    case "ORACLE":
      return {
        title: "Oracle · ALL_TAB_COLUMNS",
        language: "sql",
        script: ORACLE,
        steps: [
          "Ejecute el script en SQL Developer o SQLcl con un usuario que vea los esquemas del sistema.",
          "En SQLcl: SET SQLFORMAT CSV y SPOOL esquema.csv antes de la consulta. En SQL Developer: clic derecho en resultados → Exportar → CSV.",
          "Suba el archivo CSV resultante en esta página.",
        ],
      };
    case "MONGODB_NOSQL":
      return {
        title: "MongoDB · inferencia por muestreo",
        language: "javascript",
        script: MONGO,
        steps: [
          "Guarde el script como extraer_esquema.js.",
          "Ejecute: mongosh \"<cadena-de-conexión>/<base>\" --quiet --file extraer_esquema.js > esquema.json",
          "Suba el archivo JSON resultante. Cada colección se registra como una \"tabla\" y cada ruta de campo como una \"columna\".",
        ],
      };
    case "FLAT_FILES_DBF_CSV":
    case "EXCEL":
      return {
        title: "Archivos planos / Excel · inventario de columnas",
        language: "python",
        script: FILES,
        steps: [
          "Copie los archivos de datos del sistema a una carpeta (o apunte el script a la carpeta compartida).",
          "Ejecute: python extraer_esquema.py \"<carpeta>\". Cada archivo u hoja se registra como una tabla.",
          "Suba el esquema.csv generado. Si no puede ejecutar Python, complete manualmente la plantilla CSV de abajo.",
        ],
      };
    default:
      return {
        title: dbEngine === "UNKNOWN_SAAS" ? "SaaS sin acceso a BD · plantilla manual" : "Motor no definido · plantilla manual",
        language: "csv",
        script: TEMPLATE,
        steps: [
          dbEngine
            ? "Este sistema no expone su base de datos. Solicite al proveedor el diccionario de campos de la API o de los reportes exportables."
            : "El Módulo 1 aún no indica el motor de base de datos de este sistema. Complete el Bloque C para obtener el script específico.",
          "Complete la plantilla CSV con una fila por campo (las filas de ejemplo se deben reemplazar).",
          "Suba el archivo en esta página.",
        ],
      };
  }
}
