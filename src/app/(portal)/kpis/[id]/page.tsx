import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { requireModule } from "@/lib/server/auth";
import { formsLockedFor } from "@/lib/server/project";
import { systemOptions } from "@/lib/server/system-options";
import { kpiToForm } from "@/lib/server/kpis";
import { LockedForms, PageHeader, StatusBadge } from "@/components/ui";
import { KpiForm } from "../kpi-form";

export const dynamic = "force-dynamic";

export default async function KpiPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("m2");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const kpi = await prisma.kpiCatalog.findUnique({
    where: { id },
    include: { variables: { orderBy: { position: "asc" } }, attachments: { orderBy: { createdAt: "asc" } } },
  });
  if (!kpi) notFound();
  const locked = await formsLockedFor(user);

  return (
    <>
      <PageHeader
        back={{ href: "/kpis", label: "Indicadores de gestión" }}
        phase={`Fase 2A · Módulo 2 · ${kpi.kpiCode}`}
        title={kpi.kpiName}
        subtitle={<StatusBadge status={kpi.status} />}
      />
      {locked && (
        <div className="mb-4">
          <LockedForms />
        </div>
      )}
      <KpiForm
        kpiId={kpi.id}
        kpiCode={kpi.kpiCode}
        status={kpi.status}
        initial={kpiToForm(kpi)}
        systems={await systemOptions()}
        locked={locked}
        canDelete={user.role === "ADMIN" || kpi.createdById === user.id}
        attachments={kpi.attachments.map((a) => ({
          id: a.id,
          kind: a.kind,
          originalName: a.originalName,
          sizeBytes: a.sizeBytes,
          createdAt: a.createdAt.toISOString(),
          canDelete: user.role === "ADMIN" || a.uploadedById === user.id,
        }))}
        mappings={Object.fromEntries(
          kpi.variables.map((v) => [
            v.id,
            v.physicalTableName ? `${v.physicalTableName}.${v.physicalColumnName ?? "?"}` : null,
          ]),
        )}
      />
    </>
  );
}
