import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { requireModule } from "@/lib/server/auth";
import { formsLockedFor } from "@/lib/server/project";
import { systemFieldScope } from "@/lib/permissions";
import { toSystemForm } from "@/lib/system-form";
import { LockedForms, PageHeader, RiskBadge, StatusBadge, WaveBadge } from "@/components/ui";
import { SystemWizard } from "./system-wizard";

export const dynamic = "force-dynamic";

export default async function SystemPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireModule("m1");
  const { code } = await params;
  const system = await prisma.systemInventory.findUnique({
    where: { systemCode: code },
    include: {
      spocBusiness: { select: { name: true, email: true } },
      spocTech: { select: { name: true, email: true } },
      attachments: { where: { kind: "SYSTEM_DOC" }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!system) notFound();
  const locked = await formsLockedFor(user);
  const departments = await prisma.systemInventory.findMany({ select: { userDepartments: true } });
  const suggestions = Array.from(
    new Set(departments.flatMap((d) => (Array.isArray(d.userDepartments) ? (d.userDepartments as string[]) : []))),
  ).sort();

  return (
    <>
      <PageHeader
        back={{ href: "/sistemas", label: "Sistemas" }}
        phase={`Fase 1 · Módulo 1 · ${system.systemCode}`}
        title={system.officialName ?? system.commonName ?? system.systemCode}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={system.phase1Status} />
            <WaveBadge wave={system.waveNumber} />
            {system.vendorRiskAlert && <RiskBadge />}
            <span className="text-slate-500">
              Responsable funcional: {system.spocBusiness?.name ?? "sin asignar"} · Responsable técnico: {system.spocTech?.name ?? "sin asignar"}
            </span>
          </span>
        }
      />
      {locked && (
        <div className="mb-4">
          <LockedForms />
        </div>
      )}
      <SystemWizard
        systemCode={system.systemCode}
        initial={toSystemForm(system)}
        scope={systemFieldScope(user.role)}
        locked={locked}
        departmentSuggestions={suggestions}
        attachments={system.attachments.map((a) => ({
          id: a.id,
          kind: a.kind,
          originalName: a.originalName,
          sizeBytes: a.sizeBytes,
          createdAt: a.createdAt.toISOString(),
          canDelete: user.role === "ADMIN" || a.uploadedById === user.id,
        }))}
      />
    </>
  );
}
