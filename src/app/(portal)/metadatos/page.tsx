import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { requireModule } from "@/lib/server/auth";
import { DB_ENGINES, TOTAL_SYSTEMS, labelOf } from "@/lib/catalogs";
import { isVariableMapped } from "@/lib/validation";
import { Badge, PageHeader, ProgressBar } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MetadataPage() {
  await requireModule("m3");
  const [systems, variables] = await Promise.all([
    prisma.systemInventory.findMany({ orderBy: { systemCode: "asc" }, include: { _count: { select: { rawSchema: true } } } }),
    prisma.kpiSourceVariable.findMany({ where: { sourceSystemCode: { not: null } } }),
  ]);
  const rows = systems
    .map((s) => {
      const vars = variables.filter((v) => v.sourceSystemCode === s.systemCode);
      return { s, vars: vars.length, mapped: vars.filter(isVariableMapped).length, kpis: new Set(vars.map((v) => v.kpiId)).size };
    })
    .sort((a, b) => Number(b.vars > 0) - Number(a.vars > 0) || a.s.systemCode.localeCompare(b.s.systemCode));
  const linked = rows.filter((r) => r.vars > 0).length;
  const uploaded = systems.filter((s) => s.phase2SchemaUploaded).length;

  return (
    <>
      <PageHeader
        phase="Fase 2B · Módulo 3"
        title="Autodiagnóstico de metadatos y trazabilidad"
        subtitle="Regla KPI-Driven Discovery: solo se habilita la carga técnica profunda de los sistemas vinculados al menos a un KPI del Módulo 2. TI no escribe diccionarios a mano: ejecuta el script, sube el resultado y vincula cada variable con su campo físico."
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium">Sistemas priorizados (vinculados a KPIs)</span>
            <span>{linked} / {TOTAL_SYSTEMS}</span>
          </div>
          <ProgressBar value={linked} max={TOTAL_SYSTEMS} />
        </div>
        <div className="card p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium">Diccionarios automáticos subidos</span>
            <span>{uploaded} / {TOTAL_SYSTEMS}</span>
          </div>
          <ProgressBar value={uploaded} max={TOTAL_SYSTEMS} tone={uploaded === TOTAL_SYSTEMS ? "green" : "blue"} />
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="data-table min-w-[820px]">
          <thead>
            <tr>
              <th>Sistema</th>
              <th>Prioridad</th>
              <th>Motor de BD</th>
              <th>Esquema</th>
              <th>KPIs / variables</th>
              <th>Variables mapeadas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, vars, mapped, kpis }) => (
              <tr key={s.id} className={vars ? "hover:bg-slate-50" : "text-slate-400"}>
                <td>
                  {vars ? (
                    <Link href={`/metadatos/${s.systemCode}`} className="link">
                      {s.systemCode}
                    </Link>
                  ) : (
                    <span className="font-medium">{s.systemCode}</span>
                  )}{" "}
                  {s.officialName ?? s.commonName}
                </td>
                <td>{vars ? <Badge tone="blue">Habilitado</Badge> : <Badge>Sin KPI vinculado</Badge>}</td>
                <td>{labelOf(DB_ENGINES, s.dbEngine)}</td>
                <td>
                  {s.phase2SchemaUploaded ? <Badge tone="green">{s._count.rawSchema.toLocaleString("es")} columnas</Badge> : vars ? <Badge tone="amber">Pendiente</Badge> : "—"}
                </td>
                <td>{vars ? `${kpis} / ${vars}` : "—"}</td>
                <td>{vars ? `${mapped} / ${vars}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
