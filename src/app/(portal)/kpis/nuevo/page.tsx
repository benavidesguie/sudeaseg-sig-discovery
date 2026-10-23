import { requireModule } from "@/lib/server/auth";
import { formsLockedFor } from "@/lib/server/project";
import { systemOptions } from "@/lib/server/system-options";
import { LockedForms, PageHeader } from "@/components/ui";
import { KpiForm } from "../kpi-form";
import { emptyKpi } from "@/lib/kpi-defaults";

export const dynamic = "force-dynamic";

export default async function NewKpiPage() {
  const user = await requireModule("m2");
  const locked = await formsLockedFor(user);
  return (
    <>
      <PageHeader back={{ href: "/kpis", label: "KPI Canvas" }} phase="Fase 2A · Módulo 2" title="Nuevo indicador" />
      {locked ? (
        <LockedForms />
      ) : (
        <KpiForm kpiId={null} kpiCode={null} status="DRAFT" initial={emptyKpi()} systems={await systemOptions()} attachments={[]} mappings={{}} canDelete={false} />
      )}
    </>
  );
}
