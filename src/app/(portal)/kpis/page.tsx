import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { requireModule } from "@/lib/server/auth";
import { formsLockedFor } from "@/lib/server/project";
import { BUSINESS_DOMAINS, FREQUENCIES, labelOf } from "@/lib/catalogs";
import { hasCompleteEvidence, isVariableMapped } from "@/lib/validation";
import { Badge, EmptyState, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KpisPage({ searchParams }: { searchParams: Promise<{ dominio?: string }> }) {
  const user = await requireModule("m2");
  const { dominio } = await searchParams;
  const locked = await formsLockedFor(user);
  const kpis = await prisma.kpiCatalog.findMany({
    where: dominio ? { businessDomain: dominio } : undefined,
    orderBy: { kpiCode: "asc" },
    include: { variables: true, attachments: { select: { kind: true } } },
  });

  return (
    <>
      <PageHeader
        phase="Fase 2A · Módulo 2"
        title="KPI Canvas · Ficha y matriz de indicadores"
        subtitle="Registre cada indicador, su fórmula y reglas, y vincule cada variable con el sistema fuente (SIS-01..22) y una transacción real de ejemplo para que TI pueda seguir el dato."
        actions={
          !locked && (
            <Link href="/kpis/nuevo" className="btn-primary">
              + Nuevo KPI
            </Link>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        <Link href="/kpis" className={`rounded-full px-3 py-1 ring-1 ${!dominio ? "bg-brand-600 text-white ring-brand-600" : "bg-white ring-slate-200"}`}>
          Todos
        </Link>
        {BUSINESS_DOMAINS.map(([v, l]) => (
          <Link
            key={v}
            href={`/kpis?dominio=${v}`}
            className={`rounded-full px-3 py-1 ring-1 ${dominio === v ? "bg-brand-600 text-white ring-brand-600" : "bg-white ring-slate-200"}`}
          >
            {l}
          </Link>
        ))}
      </div>
      {kpis.length === 0 ? (
        <EmptyState title="Aún no hay indicadores registrados">
          {locked ? "Los formularios se habilitarán cuando el administrador confirme el catálogo de sistemas." : "Use “Nuevo KPI” para documentar el primer indicador."}
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                <th>Código</th>
                <th>Indicador</th>
                <th>Dominio</th>
                <th>Frecuencia</th>
                <th>Sistemas fuente</th>
                <th>Evidencia</th>
                <th>Mapeo TI</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => {
                const count = (kind: string) => k.attachments.filter((a) => a.kind === kind).length;
                const ev = hasCompleteEvidence(k.currentCalculationMethod, {
                  excel: count("KPI_EXCEL"),
                  transaction: count("KPI_SCREENSHOT_TRANSACTION"),
                  report: count("KPI_SCREENSHOT_REPORT"),
                });
                const systems = Array.from(new Set(k.variables.map((v) => v.sourceSystemCode).filter(Boolean)));
                const mapped = k.variables.filter(isVariableMapped).length;
                return (
                  <tr key={k.id} className="hover:bg-slate-50">
                    <td>
                      <Link href={`/kpis/${k.id}`} className="link font-mono text-xs">
                        {k.kpiCode}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/kpis/${k.id}`} className="font-medium text-slate-900 hover:underline">
                        {k.kpiName}
                      </Link>
                    </td>
                    <td>{labelOf(BUSINESS_DOMAINS, k.businessDomain)}</td>
                    <td>{labelOf(FREQUENCIES, k.frequency)}</td>
                    <td className="text-xs">{systems.join(", ") || "—"}</td>
                    <td>{ev ? <Badge tone="green">Completa</Badge> : <Badge tone="amber">Pendiente</Badge>}</td>
                    <td className="text-xs">
                      {mapped} / {k.variables.length}
                    </td>
                    <td>
                      <StatusBadge status={k.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
