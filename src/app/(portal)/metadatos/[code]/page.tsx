import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { requireModule } from "@/lib/server/auth";
import { formsLockedFor } from "@/lib/server/project";
import { DB_ENGINES, labelOf } from "@/lib/catalogs";
import { extractionScriptFor } from "@/lib/sql-scripts";
import { LockedForms, Notice, PageHeader, Section, formatDate } from "@/components/ui";
import { ScriptBlock } from "./script-block";
import { SchemaUploader } from "./schema-uploader";
import { SchemaSearch } from "./schema-search";
import { FollowTheData } from "./follow-the-data";

export const dynamic = "force-dynamic";

export default async function MetadataSystemPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireModule("m3");
  const { code } = await params;
  const system = await prisma.systemInventory.findUnique({
    where: { systemCode: code },
    include: {
      attachments: { where: { kind: "SCHEMA_UPLOAD" }, take: 1, orderBy: { createdAt: "desc" } },
      _count: { select: { rawSchema: true } },
    },
  });
  if (!system) notFound();
  const locked = await formsLockedFor(user);
  const variables = await prisma.kpiSourceVariable.findMany({
    where: { sourceSystemCode: code },
    orderBy: [{ kpi: { kpiCode: "asc" } }, { position: "asc" }],
    include: {
      kpi: {
        select: {
          id: true,
          kpiCode: true,
          kpiName: true,
          calculationFormula: true,
          businessRules: true,
          attachments: {
            where: { kind: { in: ["KPI_SCREENSHOT_TRANSACTION", "KPI_SCREENSHOT_REPORT", "KPI_EXCEL"] } },
            select: { id: true, kind: true, originalName: true },
          },
        },
      },
    },
  });
  const tableCount = system.phase2SchemaUploaded
    ? (await prisma.systemRawSchema.groupBy({ by: ["tableSchema", "tableName"], where: { systemCode: code } })).length
    : 0;
  const script = extractionScriptFor(system.dbEngine);
  const enabled = variables.length > 0;
  const schemaFile = system.attachments[0];

  return (
    <>
      <PageHeader
        back={{ href: "/metadatos", label: "Metadatos" }}
        phase={`Fase 2B · Módulo 3 · ${system.systemCode}`}
        title={system.officialName ?? system.commonName ?? system.systemCode}
        subtitle={`Motor de BD declarado en el Módulo 1: ${labelOf(DB_ENGINES, system.dbEngine)}`}
      />
      <div className="space-y-5">
        {locked && <LockedForms />}
        {!enabled && (
          <Notice tone="amber" title="Carga técnica no habilitada">
            Este sistema aún no está vinculado a ningún indicador en el Módulo 2. Según la regla de prelación “primero los indicadores”, la
            carga técnica profunda se habilita cuando negocio lo use como fuente de al menos una variable.
          </Notice>
        )}

        <Section title="1 · Script de extracción de esquema" description={script.title}>
          <ol className="mb-4 list-inside list-decimal space-y-1 text-sm text-slate-700">
            {script.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <ScriptBlock script={script.script} language={script.language} fileName={`${code.toLowerCase()}_extraer_esquema.${script.language === "javascript" ? "js" : script.language === "python" ? "py" : script.language}`} />
        </Section>

        <Section title="2 · Carga del esquema (CSV / JSON)" description="El archivo debe contener las columnas esquema, nombre_tabla, nombre_columna, tipo_dato, permite_nulos y longitud_maxima. Una nueva carga reemplaza a la anterior.">
          {system.phase2SchemaUploaded && (
            <p className="mb-3 text-sm text-slate-700">
              Esquema actual: <strong>{tableCount.toLocaleString("es")} tablas</strong> · <strong>{system._count.rawSchema.toLocaleString("es")} columnas</strong> · cargado el{" "}
              {formatDate(system.phase2SchemaUpdatedAt)}
              {schemaFile && (
                <>
                  {" "}·{" "}
                  <a href={`/api/files/${schemaFile.id}`} className="link">
                    {schemaFile.originalName}
                  </a>
                </>
              )}
            </p>
          )}
          <SchemaUploader systemCode={code} disabled={locked || !enabled} />
        </Section>

        {system.phase2SchemaUploaded && (
          <Section title="Buscador rápido de tablas y columnas">
            <SchemaSearch systemCode={code} />
          </Section>
        )}

        <Section
          title="3 · Mesa de cruce “Seguir el dato”"
          description="Para cada variable de negocio, ubique la tabla y columna física donde reside, su llave primaria y el campo de fecha para carga incremental. Use el ID de transacción de ejemplo y las capturas para encontrarla."
        >
          {enabled ? (
            <FollowTheData
              systemCode={code}
              schemaUploaded={system.phase2SchemaUploaded}
              locked={locked}
              variables={variables.map((v) => ({
                id: v.id,
                varName: v.varName,
                screenModuleName: v.screenModuleName,
                sampleTransactionId: v.sampleTransactionId,
                isSystemOfRecord: v.isSystemOfRecord,
                existsInOtherSystem: v.existsInOtherSystem,
                kpi: {
                  id: v.kpi.id,
                  code: v.kpi.kpiCode,
                  name: v.kpi.kpiName,
                  formula: v.kpi.calculationFormula,
                  rules: v.kpi.businessRules,
                  evidence: v.kpi.attachments,
                },
                mapping: {
                  physicalTableName: v.physicalTableName ?? "",
                  physicalColumnName: v.physicalColumnName ?? "",
                  primaryKeyColumn: v.primaryKeyColumn ?? "",
                  incrementalDateColumn: v.incrementalDateColumn ?? "",
                  transformationRule: v.transformationRule ?? "",
                },
              }))}
            />
          ) : (
            <p className="text-sm text-slate-500">No hay variables de indicador que usen este sistema.</p>
          )}
        </Section>
      </div>
    </>
  );
}
