import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { requireModule } from "@/lib/server/auth";
import { formsLockedFor } from "@/lib/server/project";
import { kpiLinkedSystemCodes } from "@/lib/server/systems";
import { MASTER_ENTITIES, MASTER_ENTITY_VALUES, labelOf } from "@/lib/catalogs";
import { LockedForms, PageHeader } from "@/components/ui";
import { MasterGrid } from "./master-grid";

export const dynamic = "force-dynamic";

export default async function MasterDataPage({ searchParams }: { searchParams: Promise<{ entidad?: string }> }) {
  const user = await requireModule("m5");
  const { entidad } = await searchParams;
  const entity = MASTER_ENTITY_VALUES.includes(entidad as never) ? entidad! : MASTER_ENTITY_VALUES[0];
  const [rows, systems, counts, linked, locked] = await Promise.all([
    prisma.masterDataMapping.findMany({ where: { masterEntity: entity }, orderBy: { position: "asc" } }),
    prisma.systemInventory.findMany({ orderBy: { systemCode: "asc" }, select: { systemCode: true, officialName: true, commonName: true } }),
    prisma.masterDataMapping.groupBy({ by: ["masterEntity"], _count: true }),
    kpiLinkedSystemCodes(),
    formsLockedFor(user),
  ]);

  const used = new Set(rows.flatMap((r) => Object.keys((r.systemEquivalences ?? {}) as Record<string, string>)));
  const defaultColumns = systems.map((s) => s.systemCode).filter((c) => used.has(c) || linked.has(c));

  return (
    <>
      <PageHeader
        phase="Transversal · Módulo 5"
        title="Homologación de catálogos maestros"
        subtitle="Resuelva las discrepancias de códigos maestros entre sistemas antes de construir el almacén de datos (capa plata): defina el código canónico y su equivalencia en cada sistema."
      />
      {locked && (
        <div className="mb-4">
          <LockedForms />
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {MASTER_ENTITIES.map(([v, l]) => (
          <Link
            key={v}
            href={`/homologacion?entidad=${v}`}
            className={`rounded-full px-3 py-1 ring-1 ${entity === v ? "bg-brand-600 text-white ring-brand-600" : "bg-white ring-slate-200 hover:ring-slate-300"}`}
          >
            {l} <span className="opacity-70">({counts.find((c) => c.masterEntity === v)?._count ?? 0})</span>
          </Link>
        ))}
      </div>
      <MasterGrid
        key={entity}
        entity={entity}
        entityLabel={labelOf(MASTER_ENTITIES, entity)}
        locked={locked}
        systems={systems.map((s) => ({ code: s.systemCode, name: s.officialName ?? s.commonName ?? "" }))}
        defaultColumns={defaultColumns}
        initialRows={rows.map((r) => ({
          canonicalCode: r.canonicalCode,
          canonicalName: r.canonicalName,
          systemEquivalences: (r.systemEquivalences ?? {}) as Record<string, string>,
        }))}
      />
    </>
  );
}
