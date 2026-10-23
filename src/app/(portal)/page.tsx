import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { canAccess } from "@/lib/permissions";
import { ACCESS_LEVELS, ACCESS_SHORT, CRITICALITY_SHORT, PATTERN_SHORT, TOTAL_SYSTEMS } from "@/lib/catalogs";
import { WAVE_LABELS } from "@/lib/waves";
import { hasCompleteEvidence } from "@/lib/validation";
import { Badge, Notice, PageHeader, ProgressBar, RiskBadge, StatusBadge, WaveBadge, formatDate } from "@/components/ui";

export const dynamic = "force-dynamic";

const ACTIONS: Record<string, string> = {
  LOGIN: "inició sesión",
  CATALOG_SAVED: "guardó el catálogo semilla",
  CATALOG_CONFIRMED: "confirmó el catálogo semilla",
  CATALOG_REOPENED: "reabrió el catálogo semilla",
  USER_CREATED: "creó el usuario",
  USER_UPDATED: "actualizó el usuario",
  SYSTEM_DRAFT_SAVED: "guardó borrador de la ficha",
  SYSTEM_COMPLETED: "completó la ficha",
  KPI_DRAFT_SAVED: "guardó borrador del KPI",
  KPI_COMPLETED: "completó el KPI",
  KPI_DELETED: "eliminó el KPI",
  FILE_UPLOADED: "adjuntó un archivo a",
  FILE_DELETED: "eliminó un archivo de",
  SCHEMA_UPLOADED: "subió el esquema de",
  MAPPING_SAVED: "guardó el mapeo físico de",
  CONNECTIVITY_DRAFT_SAVED: "guardó borrador de conectividad de",
  CONNECTIVITY_COMPLETED: "completó la conectividad de",
  MASTER_SAVED: "actualizó la homologación de",
};

function StatCard({
  title,
  phase,
  value,
  total,
  footer,
  href,
}: {
  title: string;
  phase: string;
  value: number | string;
  total?: number;
  footer?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div className="card h-full p-5 transition hover:border-brand-100 hover:shadow">
      <div className="text-xs font-semibold tracking-wider text-brand-600 uppercase">{phase}</div>
      <div className="mt-1 text-sm font-medium text-slate-600">{title}</div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-semibold text-slate-900">{value}</span>
        {total !== undefined && <span className="text-sm text-slate-500">/ {total}</span>}
      </div>
      {typeof value === "number" && total !== undefined && (
        <div className="mt-3">
          <ProgressBar value={value} max={total} tone={value === total ? "green" : "blue"} />
        </div>
      )}
      {footer && <div className="mt-3 text-xs text-slate-500">{footer}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;

  const [systems, kpis, evidence, activity] = await Promise.all([
    prisma.systemInventory.findMany({ orderBy: { systemCode: "asc" } }),
    prisma.kpiCatalog.findMany({ select: { id: true, status: true, currentCalculationMethod: true } }),
    prisma.attachment.groupBy({ by: ["kpiId", "kind"], where: { kpiId: { not: null } }, _count: true }),
    canAccess(user.role, "admin")
      ? prisma.activityLog.findMany({ take: 12, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } })
      : Promise.resolve([]),
  ]);

  const phase1 = systems.filter((s) => s.phase1Status === "COMPLETED").length;
  const schemas = systems.filter((s) => s.phase2SchemaUploaded).length;
  const phase3 = systems.filter((s) => s.phase3Status === "COMPLETED").length;
  const alerts = systems.filter((s) => s.vendorRiskAlert);
  const evidenceOf = (kpiId: string, kind: string) => evidence.find((e) => e.kpiId === kpiId && e.kind === kind)?._count ?? 0;
  const withEvidence = kpis.filter((k) =>
    hasCompleteEvidence(k.currentCalculationMethod, {
      excel: evidenceOf(k.id, "KPI_EXCEL"),
      transaction: evidenceOf(k.id, "KPI_SCREENSHOT_TRANSACTION"),
      report: evidenceOf(k.id, "KPI_SCREENSHOT_REPORT"),
    }),
  ).length;
  const evidencePct = kpis.length ? Math.round((withEvidence / kpis.length) * 100) : 0;

  const criticalities = ["ALTA", "MEDIA", "BAJA", ""];
  const accessCols = [...ACCESS_LEVELS.map(([v]) => v), ""];
  const cell = (crit: string, access: string) =>
    systems.filter((s) => (s.kpiCriticality ?? "") === crit && (s.accessLevel ?? "") === access);

  const mine = systems.filter((s) => s.spocBusinessId === user.id || s.spocTechId === user.id);
  const sysHref = (code: string) => `/sistemas/${code}`;

  return (
    <>
      <PageHeader
        title="Dashboard de progreso"
        subtitle="Vista ejecutiva del relevamiento de los 22 sistemas y los indicadores de gestión. Se actualiza en tiempo real con cada carga."
      />
      {denied && (
        <div className="mb-4">
          <Notice tone="amber">No tiene permisos para acceder a esa sección con su rol actual.</Notice>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          phase="Fase 1"
          title="Sistemas censados"
          value={phase1}
          total={TOTAL_SYSTEMS}
          href={canAccess(user.role, "m1") ? "/sistemas" : undefined}
          footer={
            alerts.length ? (
              <span className="font-medium text-red-700">● {alerts.length} con alerta de proveedor externo</span>
            ) : (
              <span className="text-emerald-700">● Sin alertas de proveedor</span>
            )
          }
        />
        <StatCard
          phase="Fase 2 · Negocio"
          title="Indicadores documentados"
          value={kpis.length}
          href={canAccess(user.role, "m2") ? "/kpis" : undefined}
          footer={
            <>
              <div className="mb-1.5">
                {evidencePct}% con evidencia adjunta ({withEvidence}/{kpis.length})
              </div>
              <ProgressBar value={withEvidence} max={Math.max(kpis.length, 1)} tone="amber" />
            </>
          }
        />
        <StatCard
          phase="Fase 2 · TI"
          title="Diccionarios automáticos subidos"
          value={schemas}
          total={TOTAL_SYSTEMS}
          href={canAccess(user.role, "m3") ? "/metadatos" : undefined}
          footer={`${kpis.filter((k) => k.status === "TECH_MAPPED").length} KPIs con trazabilidad física completa`}
        />
        <StatCard
          phase="Fase 3"
          title="Sistemas con protocolo definido"
          value={phase3}
          total={TOTAL_SYSTEMS}
          href={canAccess(user.role, "m4") ? "/conectividad" : undefined}
          footer="Checklist de conectividad, seguridad y volumetría completado"
        />
      </div>

      {alerts.length > 0 && (
        <div className="mt-6 card border-red-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-red-800">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" /> Riesgo de secuestro de datos · Gestión de proveedor requerida
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sistema</th>
                  <th>Proveedor</th>
                  <th>Contrato de soporte</th>
                  <th>Costo extra</th>
                  <th>Criticidad</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((s) => {
                  const v = (s.vendorInfo ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link href={sysHref(s.systemCode)} className="link">
                          {s.systemCode}
                        </Link>{" "}
                        {s.officialName ?? s.commonName}
                      </td>
                      <td>
                        {String(v.vendor_name ?? "—")}
                        <div className="text-xs text-slate-500">{String(v.vendor_contact_email ?? "")}</div>
                      </td>
                      <td>{v.has_active_support_contract === true ? "Sí" : v.has_active_support_contract === false ? <Badge tone="red">No</Badge> : "—"}</td>
                      <td>{v.requires_extra_fee === "SI" ? <Badge tone="red">Sí</Badge> : v.requires_extra_fee === "NO" ? "No" : v.requires_extra_fee ? "Por confirmar" : "—"}</td>
                      <td>{CRITICALITY_SHORT[s.kpiCriticality ?? ""] ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 card p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Matriz de oleadas (Wave Planning)</h2>
            <p className="text-sm text-slate-500">Criticidad del sistema vs. facilidad de acceso. Clasificación automática según el PRD §6.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {[1, 2, 3].map((w) => (
              <span key={w} className="flex items-center gap-1">
                <WaveBadge wave={w} /> {systems.filter((s) => s.waveNumber === w).length}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <WaveBadge wave={null} /> {systems.filter((s) => !s.waveNumber).length}
            </span>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="w-28 px-2 py-1 text-left text-xs font-semibold text-slate-500">
                  Criticidad ↓ / Acceso →
                </th>
                {accessCols.map((a) => (
                  <th key={a || "none"} className="min-w-24 px-2 py-1 text-center text-xs font-semibold text-slate-500">
                    {a ? ACCESS_SHORT[a] : "Sin definir"}
                    {a && <div className="font-normal text-slate-400">{["TOTAL", "DB_ONLY", "API_ONLY"].includes(a) ? "Directo" : "Restringido"}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criticalities.map((c) => (
                <tr key={c || "none"}>
                  <td className="rounded-md bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-600">
                    {c ? CRITICALITY_SHORT[c] : "Sin definir"}
                  </td>
                  {accessCols.map((a) => {
                    const items = cell(c, a);
                    return (
                      <td key={a || "none"} className="h-14 rounded-md bg-slate-50/70 px-1.5 py-1.5 align-top">
                        <div className="flex flex-wrap gap-1">
                          {items.map((s) => (
                            <Link
                              key={s.id}
                              href={sysHref(s.systemCode)}
                              title={`${s.officialName ?? s.commonName ?? ""}${s.integrationPattern ? " · " + PATTERN_SHORT[s.integrationPattern] : ""}`}
                              className={`rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${
                                s.waveNumber === 1
                                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                                  : s.waveNumber === 2
                                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                                    : s.waveNumber === 3
                                      ? "bg-violet-50 text-violet-800 ring-violet-200"
                                      : "bg-white text-slate-600 ring-slate-200"
                              }`}
                            >
                              {s.systemCode}
                            </Link>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((w) => {
            const list = systems.filter((s) => s.waveNumber === w);
            return (
              <div key={w} className="rounded-lg border border-slate-200 p-3">
                <div className="text-sm font-semibold">{WAVE_LABELS[w]}</div>
                {list.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {list.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          <span className="font-medium">{s.systemCode}</span> {s.officialName ?? s.commonName}
                        </span>
                        {s.vendorRiskAlert && <RiskBadge />}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">Sin sistemas clasificados.</p>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Reglas: Oleada 3 si criticidad Baja o patrón Tipo D · Oleada 1 si Alta con acceso directo (Total, Solo BD, Solo API) ·
          Oleada 2 si Alta con acceso restringido/manual o Media con acceso directo · Media con acceso restringido/manual → Oleada 3.
        </p>
      </div>

      {user.role !== "ADMIN" && (
        <div className="mt-6 card p-5">
          <h2 className="text-base font-semibold">Mis sistemas asignados (SPOC)</h2>
          {mine.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sistema</th>
                    <th>Fase 1</th>
                    <th>Esquema</th>
                    <th>Fase 3</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/sistemas/${s.systemCode}`} className="link">
                          {s.systemCode}
                        </Link>{" "}
                        {s.officialName ?? s.commonName}
                      </td>
                      <td><StatusBadge status={s.phase1Status} /></td>
                      <td>{s.phase2SchemaUploaded ? <Badge tone="green">Recibido</Badge> : <Badge>Pendiente</Badge>}</td>
                      <td><StatusBadge status={s.phase3Status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No tiene sistemas asignados como SPOC.</p>
          )}
        </div>
      )}

      {activity.length > 0 && (
        <div className="mt-6 card p-5">
          <h2 className="text-base font-semibold">Actividad reciente</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{a.actor?.name ?? "Sistema"}</span> {ACTIONS[a.action] ?? a.action}{" "}
                  <span className="font-medium text-slate-700">{a.entityRef}</span>
                  {a.detail && <span className="text-slate-500"> — {a.detail}</span>}
                </span>
                <span className="text-xs text-slate-400">{formatDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
