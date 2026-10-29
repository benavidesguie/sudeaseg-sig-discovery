import { requireModule } from "@/lib/server/auth";
import { buildDossier } from "@/lib/server/exports";
import * as C from "@/lib/catalogs";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

function contact(v: unknown) {
  const o = (v ?? {}) as Record<string, string>;
  if (!o.name) return "—";
  return `${o.name}${o.role ? ` (${o.role})` : ""} · ${o.email ?? ""}${o.phone ? ` · ${o.phone}` : ""}`;
}
const yesNo = (v: unknown) => (v === true ? "Sí" : v === false ? "No" : "—");
const list = (c: Parameters<typeof C.labelOf>[0], vals: string[]) => (vals.length ? vals.map((v) => C.labelOf(c, v)).join(", ") : "—");

export default async function DossierPrintPage() {
  await requireModule("export");
  const d = await buildDossier();
  return (
    <div className="bg-white text-[13px] print:text-[11px]">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <h1 className="text-2xl font-semibold">Dossier técnico consolidado</h1>
      <p className="text-slate-500">Inventario de {C.TOTAL_SYSTEMS} sistemas · generado {new Date(d.generated_at).toLocaleString("es")}</p>

      <table className="data-table mt-4 max-w-xl">
        <tbody>
          <tr><td>Sistemas censados (Fase 1)</td><td className="font-semibold">{d.summary.phase1_completed} / {d.summary.total_systems}</td></tr>
          <tr><td>Esquemas técnicos recibidos</td><td className="font-semibold">{d.summary.schemas_uploaded} / {d.summary.total_systems}</td></tr>
          <tr><td>Conectividad validada (Fase 3)</td><td className="font-semibold">{d.summary.phase3_completed} / {d.summary.total_systems}</td></tr>
          <tr><td>Alertas de proveedor</td><td className="font-semibold">{d.summary.vendor_risk_alerts}</td></tr>
          <tr><td>Oleadas 1 / 2 / 3 / sin clasificar</td><td className="font-semibold">{d.summary.waves[1]} / {d.summary.waves[2]} / {d.summary.waves[3]} / {d.summary.waves.unclassified}</td></tr>
        </tbody>
      </table>

      <h2 className="mt-6 text-lg font-semibold">Matriz de sistemas</h2>
      <table className="data-table mt-2">
        <thead>
          <tr><th>Código</th><th>Sistema</th><th>Criticidad</th><th>Acceso</th><th>Patrón</th><th>Oleada</th><th>Riesgo</th></tr>
        </thead>
        <tbody>
          {d.systems.map((s) => (
            <tr key={s.system_code}>
              <td className="font-mono">{s.system_code}</td>
              <td>{s.identification.official_name ?? s.common_name ?? "—"}</td>
              <td>{C.CRITICALITY_SHORT[s.identification.kpi_criticality ?? ""] ?? "—"}</td>
              <td>{C.ACCESS_SHORT[s.ownership.access_level ?? ""] ?? "—"}</td>
              <td>{C.PATTERN_SHORT[s.connectivity.integration_pattern ?? ""] ?? "—"}</td>
              <td>{s.wave.number ?? "—"}</td>
              <td>{s.risk.vendor_risk_alert ? <span className="font-semibold text-red-700">Proveedor</span> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {d.systems.map((s) => {
        const v = (s.ownership.vendor_info ?? {}) as Record<string, unknown>;
        const rows: [string, string][] = [
          ["Responsable funcional / técnico", `${s.spoc_business?.name ?? "—"} / ${s.spoc_tech?.name ?? "—"}`],
          ["Estado Fase 1 / Esquema / Fase 3", `${C.labelOf(C.PHASE_STATUSES, s.status.phase1)} / ${s.status.phase2_schema_uploaded ? "Recibido" : "Pendiente"} / ${C.labelOf(C.PHASE_STATUSES, s.status.phase3)}`],
          ["Oleada sugerida", s.wave.label ?? "Sin clasificar"],
          ["Alias / versión", `${s.identification.internal_alias ?? "—"} / ${s.identification.version ?? "—"}`],
          ["Dominio", C.labelOf(C.BUSINESS_DOMAINS, s.identification.business_domain)],
          ["Departamentos", s.identification.user_departments.join(", ") || "—"],
          ["Usuarios activos", C.labelOf(C.ACTIVE_USERS_RANGES, s.identification.active_users_range)],
          ["Dueño funcional", contact(s.ownership.business_owner)],
          ["Custodio técnico", contact(s.ownership.tech_custodian)],
          ["Tipo de solución", C.labelOf(C.SOLUTION_TYPES, s.ownership.solution_type)],
          ["Nivel de acceso", C.labelOf(C.ACCESS_LEVELS, s.ownership.access_level)],
          ...(s.risk.vendor_risk_alert
            ? ([["Proveedor", `${String(v.vendor_name ?? "—")} · ${String(v.vendor_contact_email ?? "")} · Soporte: ${yesNo(v.has_active_support_contract)} · Costo extra: ${C.labelOf(C.EXTRA_FEE_OPTIONS, v.requires_extra_fee as string)}`]] as [string, string][])
            : []),
          ["Alojamiento / motor", `${C.labelOf(C.HOSTING_TYPES, s.platform.hosting_type)} / ${C.labelOf(C.DB_ENGINES, s.platform.db_engine)}`],
          ["Stack", s.platform.tech_stack ?? "—"],
          ["Documentación", list(C.DOC_STATUSES, s.platform.doc_status)],
          ["Patrón de integración", C.labelOf(C.INTEGRATION_PATTERNS, s.connectivity.integration_pattern)],
          ["Requisitos de red", list(C.NETWORK_REQUIREMENTS, s.connectivity.network_requirements)],
          ["Carga incremental / volumen", `${yesNo(s.connectivity.supports_incremental_load)} / ${C.labelOf(C.VOLUME_ESTIMATES, s.connectivity.historical_volume_estimate)}`],
          ["Ventana de extracción", s.connectivity.extraction_window ?? "—"],
          ["Metadatos", `${s.metadata.tables} tablas · ${s.metadata.columns} columnas`],
          ["Indicadores que lo usan", s.kpi_usage.kpis.join(", ") || "—"],
          ["Variables mapeadas", `${s.kpi_usage.variables_mapped} / ${s.kpi_usage.variables}`],
        ];
        return (
          <section key={s.system_code} className="mt-6 break-inside-avoid">
            <h2 className="text-lg font-semibold">
              {s.system_code} · {s.identification.official_name ?? s.common_name ?? "(sin nombre)"}
            </h2>
            {s.risk.vendor_risk_alert && <p className="mt-1 font-semibold text-red-700">Alerta roja: {s.risk.message}</p>}
            <table className="data-table mt-2">
              <tbody>
                {rows.map(([k, val]) => (
                  <tr key={k}>
                    <td className="w-56 text-slate-500">{k}</td>
                    <td>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
