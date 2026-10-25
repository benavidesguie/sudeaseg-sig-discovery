import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { requireModule } from "@/lib/server/auth";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  await requireModule("export");
  const [systems, kpis, variables] = await Promise.all([
    prisma.systemInventory.count(),
    prisma.kpiCatalog.count(),
    prisma.kpiSourceVariable.count(),
  ]);
  return (
    <>
      <PageHeader
        phase="Fase 4 · Entregables automáticos"
        title="Exportables"
        subtitle="Documentos generados al momento con la información cargada en el portal."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-base font-semibold">1 · Dossier técnico consolidado</h2>
          <p className="mt-1 text-sm text-slate-600">
            Fichas técnicas de los {systems} sistemas, su patrón de conectividad, oleada sugerida y estado de riesgo de proveedor.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn-primary" href="/api/export/dossier?format=json">JSON</a>
            <a className="btn-secondary" href="/api/export/dossier?format=md">Markdown</a>
            <Link className="btn-secondary" href="/exportar/dossier" target="_blank">PDF (vista de impresión)</Link>
          </div>
          <p className="hint mt-3">Para el PDF, abra la vista de impresión y use “Guardar como PDF” del navegador.</p>
        </div>
        <div className="card p-6">
          <h2 className="text-base font-semibold">2 · Matriz de trazabilidad origen-destino</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cruce completo Indicador → Variable → Sistema (SIS-XX) → Tabla física → Columna física → Regla de negocio. {kpis} indicadores, {variables} variables.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn-primary" href="/api/export/trazabilidad?format=xlsx">Excel (.xlsx)</a>
            <a className="btn-secondary" href="/api/export/trazabilidad?format=csv">CSV</a>
          </div>
        </div>
      </div>
    </>
  );
}
