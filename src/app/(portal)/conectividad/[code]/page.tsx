import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { requireModule } from "@/lib/server/auth";
import { formsLockedFor } from "@/lib/server/project";
import { ACCESS_LEVELS, DB_ENGINES, HOSTING_TYPES, labelOf } from "@/lib/catalogs";
import { toConnectivityForm } from "@/lib/system-form";
import { LockedForms, Notice, PageHeader, StatusBadge, WaveBadge } from "@/components/ui";
import { ConnectivityForm } from "./connectivity-form";

export const dynamic = "force-dynamic";

const SUGGESTED: Record<string, string> = {
  TOTAL: "TYPE_A_DIRECT_DB",
  DB_ONLY: "TYPE_A_DIRECT_DB",
  API_ONLY: "TYPE_B_API",
  MANUAL_EXPORT: "TYPE_C_FILE_EXCHANGE",
};

export default async function ConnectivitySystemPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireModule("m4");
  const { code } = await params;
  const s = await prisma.systemInventory.findUnique({ where: { systemCode: code } });
  if (!s) notFound();
  const locked = await formsLockedFor(user);
  return (
    <>
      <PageHeader
        back={{ href: "/conectividad", label: "Conectividad" }}
        phase={`Fase 3 · Módulo 4 · ${s.systemCode}`}
        title={s.officialName ?? s.commonName ?? s.systemCode}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.phase3Status} />
            <WaveBadge wave={s.waveNumber} />
          </span>
        }
      />
      <div className="space-y-4">
        {locked && <LockedForms />}
        <div className="card grid gap-3 p-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-xs text-slate-500">Nivel de acceso (Módulo 1)</div>
            <div className="font-medium">{labelOf(ACCESS_LEVELS, s.accessLevel)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Motor de BD</div>
            <div className="font-medium">{labelOf(DB_ENGINES, s.dbEngine)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Alojamiento</div>
            <div className="font-medium">{labelOf(HOSTING_TYPES, s.hostingType)}</div>
          </div>
        </div>
        {s.vendorRiskAlert && (
          <Notice tone="red" title="Sistema restringido por proveedor externo">
            La conectividad depende de la gestión con el proveedor. Considere el Tipo C (archivos) o Tipo D (plantilla controlada) mientras se destraba el acceso.
          </Notice>
        )}
        <ConnectivityForm systemCode={s.systemCode} initial={toConnectivityForm(s)} locked={locked} suggested={SUGGESTED[s.accessLevel ?? ""] ?? null} />
      </div>
    </>
  );
}
