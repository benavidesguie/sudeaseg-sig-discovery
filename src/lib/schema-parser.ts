// Parseador del esquema exportado por TI (Módulo 3 · schema_csv_upload).
// Acepta el CSV/JSON producido por los scripts de src/lib/sql-scripts.ts y también
// exportaciones con los nombres originales de INFORMATION_SCHEMA u Oracle.

import Papa from "papaparse";

export type ParsedColumn = {
  tableSchema: string | null;
  tableName: string;
  columnName: string;
  dataType: string;
  isNullable: string | null;
  charMaxLength: number | null;
  ordinal: number;
};

export type ParseResult = {
  rows: ParsedColumn[];
  skipped: number;
  error?: string;
};

export const MAX_SCHEMA_ROWS = 200_000;

const ALIASES: Record<keyof Omit<ParsedColumn, "ordinal">, string[]> = {
  tableSchema: ["esquema", "table_schema", "schema", "owner", "base_datos", "database"],
  tableName: ["nombre_tabla", "table_name", "tabla", "table", "coleccion", "collection"],
  columnName: ["nombre_columna", "column_name", "columna", "column", "campo", "field"],
  dataType: ["tipo_dato", "data_type", "tipo", "type"],
  isNullable: ["permite_nulos", "is_nullable", "nullable", "nulos"],
  charMaxLength: ["longitud_maxima", "character_maximum_length", "char_max_length", "data_length", "max_length", "longitud"],
};

function normalizeKey(k: string) {
  return k
    .replace(/^﻿/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function buildKeyMap(keys: string[]) {
  const map: Partial<Record<keyof typeof ALIASES, string>> = {};
  for (const key of keys) {
    const norm = normalizeKey(key);
    for (const [field, aliases] of Object.entries(ALIASES) as [keyof typeof ALIASES, string[]][]) {
      if (!map[field] && aliases.includes(norm)) map[field] = key;
    }
  }
  return map;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function normNullable(v: unknown): string | null {
  const s = str(v).toUpperCase();
  if (!s) return null;
  if (["YES", "Y", "SI", "SÍ", "TRUE", "1"].includes(s)) return "YES";
  if (["NO", "N", "FALSE", "0"].includes(s)) return "NO";
  return s.slice(0, 10);
}

function normLength(v: unknown): number | null {
  const s = str(v);
  if (!s || s.toUpperCase() === "NULL") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  // SQL Server reporta -1 para (MAX); lo tratamos como sin límite.
  if (n < 0) return null;
  return Math.min(Math.trunc(n), 2_147_483_647);
}

function toRows(records: Record<string, unknown>[]): ParseResult {
  if (records.length === 0) return { rows: [], skipped: 0, error: "El archivo no contiene filas." };
  if (records.length > MAX_SCHEMA_ROWS)
    return { rows: [], skipped: 0, error: `El archivo excede el máximo de ${MAX_SCHEMA_ROWS.toLocaleString("es")} columnas.` };

  const keys = Array.from(new Set(records.slice(0, 50).flatMap((r) => Object.keys(r))));
  const map = buildKeyMap(keys);
  const missing = (["tableName", "columnName", "dataType"] as const).filter((f) => !map[f]);
  if (missing.length) {
    const names = { tableName: "nombre_tabla", columnName: "nombre_columna", dataType: "tipo_dato" };
    return {
      rows: [],
      skipped: 0,
      error: `Faltan columnas obligatorias: ${missing.map((m) => names[m]).join(", ")}. Encabezados recibidos: ${keys.join(", ") || "(ninguno)"}.`,
    };
  }

  const rows: ParsedColumn[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  const ordinals = new Map<string, number>();
  for (const rec of records) {
    const tableName = str(rec[map.tableName!]).slice(0, 150);
    const columnName = str(rec[map.columnName!]).slice(0, 150);
    const dataType = str(rec[map.dataType!]).slice(0, 100) || "unknown";
    if (!tableName || !columnName) {
      skipped++;
      continue;
    }
    const tableSchema = map.tableSchema ? str(rec[map.tableSchema]).slice(0, 100) || null : null;
    const dedupe = `${tableSchema ?? ""}\u0000${tableName}\u0000${columnName}`;
    if (seen.has(dedupe)) {
      skipped++;
      continue;
    }
    seen.add(dedupe);
    const tableKey = `${tableSchema ?? ""}\u0000${tableName}`;
    const ordinal = (ordinals.get(tableKey) ?? 0) + 1;
    ordinals.set(tableKey, ordinal);
    rows.push({
      tableSchema,
      tableName,
      columnName,
      dataType,
      isNullable: map.isNullable ? normNullable(rec[map.isNullable]) : null,
      charMaxLength: map.charMaxLength ? normLength(rec[map.charMaxLength]) : null,
      ordinal,
    });
  }
  if (rows.length === 0) return { rows, skipped, error: "No se encontró ninguna fila con tabla y columna." };
  return { rows, skipped };
}

export function parseSchemaFile(filename: string, content: string): ParseResult {
  const text = content.replace(/^﻿/, "");
  const looksJson = filename.toLowerCase().endsWith(".json") || /^\s*[[{]/.test(text);

  if (looksJson) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return { rows: [], skipped: 0, error: "El archivo JSON no es válido." };
    }
    // Admite un arreglo plano o un objeto con la lista en alguna propiedad (p. ej. {"columns": [...]}).
    if (!Array.isArray(data) && data && typeof data === "object") {
      const arr = Object.values(data as Record<string, unknown>).find(Array.isArray);
      data = arr ?? [];
    }
    if (!Array.isArray(data)) return { rows: [], skipped: 0, error: "El JSON debe ser un arreglo de objetos." };
    return toRows(data.filter((r): r is Record<string, unknown> => !!r && typeof r === "object"));
  }

  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
  });
  if (parsed.data.length === 0 && parsed.errors.length)
    return { rows: [], skipped: 0, error: `No se pudo leer el CSV: ${parsed.errors[0].message}` };
  return toRows(parsed.data);
}
