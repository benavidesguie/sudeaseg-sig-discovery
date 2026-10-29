import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { requireModule } from "@/lib/server/auth";
import { BUSINESS_DOMAINS, ACCESS_SHORT, CRITICALITY_SHORT, TOTAL_SYSTEMS, labelOf } from "@/lib/catalogs";
import { systemFieldScope } from "@/lib/permissions";
import { Badge, PageHeader, ProgressBar, RiskBadge, StatusBadge, WaveBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SystemsPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const user = await requireModule("m1");
  const { filtro } = await searchParams;
  const all = await prisma.systemInventory.findMany({
    orderBy: { systemCode: "asc" },
    include: { spocBusiness: { select: { name: true } }, spocTech: { select: { name: true } } },
  });
  const systems = filtro === "mios" ? all.filter((s) => s.spocBusinessId === user.id || s.spocTechId === user.id) : all;
  const done = all.filter((s) => s.phase1Status === "COMPLETED").length;
  const scope = systemFieldScope(user.role);

  return (
    <>
      <PageHeader
        phase="Fase 1 · Módulo 1"
        title="Ficha de inventario de sistemas"
        subtitle={
          scope === "all"
            ? `Censo de los ${TOTAL_SYSTEMS} sistemas. El dueño funcional completa la sección de negocio y el custodio técnico la sección técnica.`
            : scope === "business"
              ? "Usted completa la sección funcional (Bloque A y dueño funcional). La sección técnica la completa TI."
              : "Usted completa la sección técnica (custodio, tipo de solución, acceso y plataforma). La sección funcional la completa negocio."
        }
        actions={
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            <Link href="/sistemas" className={`rounded-md px-3 py-1 ${filtro !== "mios" ? "bg-white shadow-sm" : "text-slate-600"}`}>
              Todos
            </Link>
            <Link href="/sistemas?filtro=mios" className={`rounded-md px-3 py-1 ${filtro === "mios" ? "bg-white shadow-sm" : "text-slate-600"}`}>
              Asignados a mí
            </Link>
          </div>
        }
      />
      <div className="mb-4 card p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium">Sistemas censados</span>
          <span className="text-slate-600">
            {done} / {TOTAL_SYSTEMS}
          </span>
        </div>
        <ProgressBar value={done} max={TOTAL_SYSTEMS} tone={done === TOTAL_SYSTEMS ? "green" : "blue"} />
      </div>
      <div className="card overflow-x-auto">
        <table className="data-table min-w-[960px]">
          <thead>
            <tr>
              <th>Código</th>
              <th>Sistema</th>
              <th>Dominio</th>
              <th>Criticidad</th>
              <th>Acceso</th>
              <th>Responsable funcional / técnico</th>
              <th>Estado</th>
              <th>Oleada</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td>
                  <Link href={`/sistemas/${s.systemCode}`} className="link font-mono text-xs">
                    {s.systemCode}
                  </Link>
                </td>
                <td>
                  <Link href={`/sistemas/${s.systemCode}`} className="font-medium text-slate-900 hover:underline">
                    {s.officialName ?? s.commonName ?? <span className="text-slate-400">Sin nombre</span>}
                  </Link>
                  {s.officialName && s.commonName && s.officialName !== s.commonName && (
                    <div className="text-xs text-slate-500">{s.commonName}</div>
                  )}
                </td>
                <td>{labelOf(BUSINESS_DOMAINS, s.businessDomain)}</td>
                <td>{CRITICALITY_SHORT[s.kpiCriticality ?? ""] ?? "—"}</td>
                <td>
                  <div className="flex flex-col items-start gap-1">
                    {ACCESS_SHORT[s.accessLevel ?? ""] ?? "—"}
                    {s.vendorRiskAlert && <RiskBadge />}
                  </div>
                </td>
                <td className="text-xs">
                  {s.spocBusiness?.name ?? <Badge tone="amber">Sin asignar</Badge>}
                  <br />
                  {s.spocTech?.name ?? <Badge tone="amber">Sin asignar</Badge>}
                </td>
                <td>
                  <StatusBadge status={s.phase1Status} />
                </td>
                <td>
                  <WaveBadge wave={s.waveNumber} />
                </td>
              </tr>
            ))}
            {systems.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  No hay sistemas asignados a usted.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
