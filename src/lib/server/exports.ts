import "server-only";
import { prisma } from "./db";
import * as C from "../catalogs";
import { WAVE_LABELS } from "../waves";
import { toConnectivityForm, toSystemForm } from "../system-form";
import { isVariableMapped } from "../validation";

// ---------------------------------------------------------------------------
// 1. Dossier técnico consolidado (PRD §7.1)
// ---------------------------------------------------------------------------

export async function buildDossier() {
  const [systems, variables, settings] = await Promise.all([
    prisma.systemInventory.findMany({
      orderBy: { systemCode: "asc" },
      include: {
        spocBusiness: { select: { name: true, email: true } },
        spocTech: { select: { name: true, email: true } },
        _count: { select: { rawSchema: true, attachments: true } },
      },
    }),
    prisma.kpiSourceVariable.findMany({
      include: { kpi: { select: { kpiCode: true, kpiName: true } } },
    }),
    prisma.projectSettings.findUnique({ where: { id: 1 } }),
  ]);

  const tableCounts = await prisma.systemRawSchema.groupBy({ by: ["systemCode", "tableName"] });
  const tablesBySystem = new Map<string, number>();
  for (const t of tableCounts) tablesBySystem.set(t.systemCode, (tablesBySystem.get(t.systemCode) ?? 0) + 1);

  return {
    generated_at: new Date().toISOString(),
    catalog_confirmed_at: settings?.catalogConfirmedAt?.toISOString() ?? null,
    summary: {
      total_systems: systems.length,
      phase1_completed: systems.filter((s) => s.phase1Status === "COMPLETED").length,
      schemas_uploaded: systems.filter((s) => s.phase2SchemaUploaded).length,
      phase3_completed: systems.filter((s) => s.phase3Status === "COMPLETED").length,
      vendor_risk_alerts: systems.filter((s) => s.vendorRiskAlert).length,
      waves: {
        1: systems.filter((s) => s.waveNumber === 1).length,
        2: systems.filter((s) => s.waveNumber === 2).length,
        3: systems.filter((s) => s.waveNumber === 3).length,
        unclassified: systems.filter((s) => s.waveNumber === null).length,
      },
    },
    systems: systems.map((s) => {
      const f = toSystemForm(s);
      const conn = toConnectivityForm(s);
      const vars = variables.filter((v) => v.sourceSystemCode === s.systemCode);
      return {
        system_code: s.systemCode,
        common_name: s.commonName,
        spoc_business: s.spocBusiness,
        spoc_tech: s.spocTech,
        status: { phase1: s.phase1Status, phase2_schema_uploaded: s.phase2SchemaUploaded, phase3: s.phase3Status },
        risk: {
          vendor_risk_alert: s.vendorRiskAlert,
          message: s.vendorRiskAlert ? "Riesgo de secuestro de datos / gestión de proveedor requerida" : null,
        },
        wave: { number: s.waveNumber, label: s.waveNumber ? WAVE_LABELS[s.waveNumber] : null },
        identification: {
          official_name: f.officialName || null,
          internal_alias: f.internalAlias || null,
          version: f.version || null,
          business_domain: f.businessDomain || null,
          user_departments: f.userDepartments,
          active_users_range: f.activeUsersRange || null,
          kpi_criticality: f.kpiCriticality || null,
        },
        ownership: {
          business_owner: s.businessOwner,
          tech_custodian: s.techCustodian,
          solution_type: f.solutionType || null,
          access_level: f.accessLevel || null,
          vendor_info: s.vendorInfo,
        },
        platform: {
          hosting_type: f.hostingType || null,
          db_engine: f.dbEngine || null,
          tech_stack: f.techStack || null,
          doc_status: f.docStatus,
          attachments: s._count.attachments,
        },
        connectivity: {
          integration_pattern: conn.integrationPattern || null,
          network_requirements: conn.networkRequirements,
          supports_incremental_load: conn.supportsIncrementalLoad,
          historical_volume_estimate: conn.historicalVolumeEstimate || null,
          extraction_window: conn.extractionWindow || null,
        },
        metadata: { columns: s._count.rawSchema, tables: tablesBySystem.get(s.systemCode) ?? 0 },
        kpi_usage: {
          kpis: Array.from(new Set(vars.map((v) => v.kpi.kpiCode))).sort(),
          variables: vars.length,
          variables_mapped: vars.filter(isVariableMapped).length,
        },
      };
    }),
  };
}

export type Dossier = Awaited<ReturnType<typeof buildDossier>>;

const yesNo = (v: boolean | null | undefined) => (v === true ? "Sí" : v === false ? "No" : "—");
const list = (c: Parameters<typeof C.labelOf>[0], vals: string[]) => (vals.length ? vals.map((v) => C.labelOf(c, v)).join(", ") : "—");
const contact = (v: unknown) => {
  const o = (v ?? {}) as Record<string, string>;
  return o.name ? `${o.name}${o.role ? ` (${o.role})` : ""} · ${o.email ?? ""}${o.phone ? ` · ${o.phone}` : ""}` : "—";
};
const md = (s: string | null | undefined) => (s ? s.replace(/\|/g, "\\|").replace(/\n/g, " ") : "—");

export function dossierToMarkdown(d: Dossier) {
  const out: string[] = [];
  out.push("# Dossier técnico consolidado · Relevamiento de 22 sistemas", "");
  out.push(`Generado: ${new Date(d.generated_at).toLocaleString("es")}`, "");
  out.push("## Resumen", "");
  out.push("| Indicador | Valor |", "|---|---|");
  out.push(`| Sistemas censados (Fase 1) | ${d.summary.phase1_completed} / ${d.summary.total_systems} |`);
  out.push(`| Esquemas técnicos recibidos | ${d.summary.schemas_uploaded} / ${d.summary.total_systems} |`);
  out.push(`| Conectividad validada (Fase 3) | ${d.summary.phase3_completed} / ${d.summary.total_systems} |`);
  out.push(`| Alertas de proveedor | ${d.summary.vendor_risk_alerts} |`);
  out.push(
    `| Oleadas 1 / 2 / 3 / sin clasificar | ${d.summary.waves[1]} / ${d.summary.waves[2]} / ${d.summary.waves[3]} / ${d.summary.waves.unclassified} |`,
    "",
  );
  out.push("## Matriz de sistemas", "");
  out.push("| Código | Sistema | Criticidad | Acceso | Patrón | Oleada | Riesgo |", "|---|---|---|---|---|---|---|");
  for (const s of d.systems) {
    out.push(
      `| ${s.system_code} | ${md(s.identification.official_name ?? s.common_name)} | ${C.CRITICALITY_SHORT[s.identification.kpi_criticality ?? ""] ?? "—"} | ${
        C.ACCESS_SHORT[s.ownership.access_level ?? ""] ?? "—"
      } | ${C.PATTERN_SHORT[s.connectivity.integration_pattern ?? ""] ?? "—"} | ${s.wave.number ?? "—"} | ${s.risk.vendor_risk_alert ? "🔴 Proveedor" : "—"} |`,
    );
  }
  out.push("");
  for (const s of d.systems) {
    out.push(`## ${s.system_code} · ${s.identification.official_name ?? s.common_name ?? "(sin nombre)"}`, "");
    if (s.risk.vendor_risk_alert) out.push(`> **Alerta roja:** ${s.risk.message}.`, "");
    const v = (s.ownership.vendor_info ?? {}) as Record<string, unknown>;
    const rows: [string, string][] = [
      ["Nombre común (catálogo)", md(s.common_name)],
      ["SPOC funcional / técnico", `${s.spoc_business?.name ?? "—"} / ${s.spoc_tech?.name ?? "—"}`],
      ["Estado Fase 1 / Esquema / Fase 3", `${C.labelOf(C.PHASE_STATUSES, s.status.phase1)} / ${s.status.phase2_schema_uploaded ? "Recibido" : "Pendiente"} / ${C.labelOf(C.PHASE_STATUSES, s.status.phase3)}`],
      ["Oleada sugerida", s.wave.label ?? "Sin clasificar"],
      ["Alias interno / versión", `${md(s.identification.internal_alias)} / ${md(s.identification.version)}`],
      ["Dominio de negocio", C.labelOf(C.BUSINESS_DOMAINS, s.identification.business_domain)],
      ["Departamentos usuarios", s.identification.user_departments.join(", ") || "—"],
      ["Usuarios activos", C.labelOf(C.ACTIVE_USERS_RANGES, s.identification.active_users_range)],
      ["Criticidad para KPIs", C.CRITICALITY_SHORT[s.identification.kpi_criticality ?? ""] ?? "—"],
      ["Dueño funcional", md(contact(s.ownership.business_owner))],
      ["Custodio técnico", md(contact(s.ownership.tech_custodian))],
      ["Tipo de solución", C.labelOf(C.SOLUTION_TYPES, s.ownership.solution_type)],
      ["Nivel de acceso", C.labelOf(C.ACCESS_LEVELS, s.ownership.access_level)],
    ];
    if (s.risk.vendor_risk_alert)
      rows.push([
        "Proveedor",
        `${md(String(v.vendor_name ?? ""))} · ${md(String(v.vendor_contact_email ?? ""))} · Contrato de soporte: ${yesNo(
          v.has_active_support_contract as boolean | null,
        )} · Costo extra: ${C.labelOf(C.EXTRA_FEE_OPTIONS, v.requires_extra_fee as string)}`,
      ]);
    rows.push(
      ["Alojamiento", C.labelOf(C.HOSTING_TYPES, s.platform.hosting_type)],
      ["Motor de BD", C.labelOf(C.DB_ENGINES, s.platform.db_engine)],
      ["Stack tecnológico", md(s.platform.tech_stack)],
      ["Documentación", list(C.DOC_STATUSES, s.platform.doc_status)],
      ["Patrón de integración", C.labelOf(C.INTEGRATION_PATTERNS, s.connectivity.integration_pattern)],
      ["Requisitos de red", list(C.NETWORK_REQUIREMENTS, s.connectivity.network_requirements)],
      ["Carga incremental", yesNo(s.connectivity.supports_incremental_load)],
      ["Volumen histórico", C.labelOf(C.VOLUME_ESTIMATES, s.connectivity.historical_volume_estimate)],
      ["Ventana de extracción", md(s.connectivity.extraction_window)],
      ["Metadatos recibidos", `${s.metadata.tables} tablas · ${s.metadata.columns} columnas`],
      ["KPIs que lo usan", s.kpi_usage.kpis.join(", ") || "—"],
      ["Variables mapeadas", `${s.kpi_usage.variables_mapped} / ${s.kpi_usage.variables}`],
    );
    out.push("| Campo | Valor |", "|---|---|", ...rows.map(([k, val]) => `| ${k} | ${val} |`), "");
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// 2. Matriz de trazabilidad origen-destino (PRD §7.2)
// ---------------------------------------------------------------------------

export const TRACE_COLUMNS = [
  ["kpi_code", "Código KPI"],
  ["kpi_name", "Nombre KPI"],
  ["business_domain", "Dominio"],
  ["kpi_status", "Estado KPI"],
  ["calculation_formula", "Fórmula"],
  ["business_rules", "Reglas de negocio"],
  ["var_name", "Variable"],
  ["source_system_code", "Sistema (SIS-XX)"],
  ["source_system_name", "Nombre del sistema"],
  ["screen_module_name", "Pantalla / módulo"],
  ["sample_transaction_id", "Transacción de ejemplo"],
  ["is_system_of_record", "Fuente única de verdad"],
  ["exists_in_other_system", "Duplicado en otro sistema"],
  ["physical_table_name", "Tabla física"],
  ["physical_column_name", "Columna física"],
  ["primary_key_column", "Llave primaria"],
  ["incremental_date_column", "Campo incremental"],
  ["transformation_rule", "Regla de transformación"],
  ["mapped", "Mapeado"],
] as const;

export type TraceRow = Record<(typeof TRACE_COLUMNS)[number][0], string>;

export async function traceabilityRows(): Promise<TraceRow[]> {
  const kpis = await prisma.kpiCatalog.findMany({
    orderBy: { kpiCode: "asc" },
    include: {
      variables: {
        orderBy: { position: "asc" },
        include: { sourceSystem: { select: { officialName: true, commonName: true } } },
      },
    },
  });
  const rows: TraceRow[] = [];
  for (const k of kpis) {
    const base = {
      kpi_code: k.kpiCode,
      kpi_name: k.kpiName,
      business_domain: C.labelOf(C.BUSINESS_DOMAINS, k.businessDomain),
      kpi_status: C.labelOf(C.KPI_STATUSES, k.status),
      calculation_formula: k.calculationFormula ?? "",
      business_rules: k.businessRules ?? "",
    };
    const vars = k.variables.length ? k.variables : [null];
    for (const v of vars) {
      rows.push({
        ...base,
        var_name: v?.varName ?? "",
        source_system_code: v?.sourceSystemCode ?? "",
        source_system_name: v?.sourceSystem?.officialName ?? v?.sourceSystem?.commonName ?? "",
        screen_module_name: v?.screenModuleName ?? "",
        sample_transaction_id: v?.sampleTransactionId ?? "",
        is_system_of_record: v ? (v.isSystemOfRecord ? "Sí" : "No") : "",
        exists_in_other_system: v ? (v.existsInOtherSystem ? "Sí" : "No") : "",
        physical_table_name: v?.physicalTableName ?? "",
        physical_column_name: v?.physicalColumnName ?? "",
        primary_key_column: v?.primaryKeyColumn ?? "",
        incremental_date_column: v?.incrementalDateColumn ?? "",
        transformation_rule: v?.transformationRule ?? "",
        mapped: v ? (isVariableMapped(v) ? "Sí" : "No") : "",
      });
    }
  }
  return rows;
}

// Evita que una celda que empieza con =, +, - o @ se interprete como fórmula al abrir en Excel.
function neutralize(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function rowsToCsv(rows: TraceRow[]) {
  const esc = (v: string) => {
    const s = neutralize(v);
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = TRACE_COLUMNS.map(([, label]) => esc(label)).join(",");
  const lines = rows.map((r) => TRACE_COLUMNS.map(([key]) => esc(r[key])).join(","));
  // BOM para que Excel reconozca UTF-8 (acentos).
  return "﻿" + [header, ...lines].join("\r\n");
}

export async function rowsToXlsx(rows: TraceRow[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Portal de Relevamiento";
  const ws = wb.addWorksheet("Trazabilidad", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = TRACE_COLUMNS.map(([key, header]) => ({
    key,
    header,
    width: ["calculation_formula", "business_rules", "transformation_rule"].includes(key) ? 40 : 20,
  }));
  for (const r of rows) {
    ws.addRow(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, neutralize(v)])));
  }
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: TRACE_COLUMNS.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
