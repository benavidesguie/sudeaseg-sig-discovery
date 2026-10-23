"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteKpi, saveKpi } from "@/app/actions/kpis";
import * as C from "@/lib/catalogs";
import type { KpiFormData, KpiVariableForm } from "@/lib/validation";
import { CheckboxGroup, ErrorSummary, FormMessage, RadioGroup, Select, TextArea, TextInput } from "@/components/fields";
import { FileUploader, type AttachmentItem } from "@/components/file-uploader";
import { Section } from "@/components/ui";
import { emptyVariable } from "@/lib/kpi-defaults";

const LABELS: Record<string, string> = {
  kpiName: "Nombre del indicador",
  businessDomain: "Dominio",
  kpiObjective: "Objetivo / decisión",
  unitOfMeasure: "Unidad de medida",
  frequency: "Frecuencia",
  trendDirection: "Dirección de tendencia",
  calculationFormula: "Fórmula",
  businessRules: "Reglas de negocio",
  dimensions: "Dimensiones",
  currentCalculationMethod: "Método de cálculo actual",
  variables: "Variables",
  "evidence.excel": "Excel actual",
  "evidence.transaction": "Captura de transacción",
  "evidence.report": "Captura de reporte",
};

const SCREENSHOT_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.pdf";

export function KpiForm({
  kpiId: initialId,
  kpiCode: initialCode,
  status,
  initial,
  systems,
  attachments: initialAttachments,
  mappings,
  locked = false,
  canDelete,
}: {
  kpiId: string | null;
  kpiCode: string | null;
  status: string;
  initial: KpiFormData;
  systems: [string, string][];
  attachments: AttachmentItem[];
  mappings: Record<string, string | null>;
  locked?: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [kpiId, setKpiId] = useState(initialId);
  const [kpiCode, setKpiCode] = useState(initialCode);
  const [data, setData] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [attachments, setAttachments] = useState(initialAttachments);

  const set = <K extends keyof KpiFormData>(k: K, v: KpiFormData[K]) => setData((d) => ({ ...d, [k]: v }));
  const setVar = (i: number, patch: Partial<KpiVariableForm>) =>
    setData((d) => ({ ...d, variables: d.variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) }));
  const err = (k: string) => errors[k];
  const byKind = (kind: string) => attachments.filter((a) => a.kind === kind);
  const replaceKind = (kind: string) => (items: AttachmentItem[]) =>
    setAttachments((all) => [...all.filter((a) => a.kind !== kind), ...items]);

  const submit = (complete: boolean) =>
    start(async () => {
      const res = await saveKpi(kpiId, data, complete);
      setErrors(res.fieldErrors ?? {});
      setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "Guardado") : res.error });
      if (res.data) {
        const ids = res.data.variableIds;
        setKpiCode(res.data.kpiCode);
        // Conserva los ids asignados por el servidor para que el próximo guardado actualice (no recree) las variables.
        setData((d) => ({ ...d, variables: d.variables.map((v, i) => ({ ...v, id: ids[i] ?? v.id })) }));
        if (!kpiId) {
          setKpiId(res.data.id);
          router.replace(`/kpis/${res.data.id}`);
          return;
        }
      }
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!kpiId || !window.confirm("¿Eliminar este KPI con sus variables y evidencias? Esta acción no se puede deshacer.")) return;
      const res = await deleteKpi(kpiId);
      if (res.ok) router.push("/kpis");
      else setMsg({ ok: false, text: res.error });
    });

  const usedSystems = Array.from(new Set(data.variables.map((v) => v.sourceSystemCode).filter(Boolean)));
  const evidenceDisabledReason = locked
    ? "Bloqueado hasta confirmar el catálogo (Fase 0)."
    : "Guarde el KPI como borrador para poder adjuntar evidencias.";

  return (
    <div className="space-y-5">
      <Section title="Bloque A · Definición estratégica">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Código" value={kpiCode ?? "Se asigna al guardar (KPI-<DOM>-NN)"} disabled onChange={() => {}} />
          <TextInput label="Nombre del indicador" required disabled={locked} value={data.kpiName} error={err("kpiName")} onChange={(v) => set("kpiName", v)} />
          <Select label="Dominio de negocio" required disabled={locked} options={C.BUSINESS_DOMAINS} value={data.businessDomain} error={err("businessDomain")} onChange={(v) => set("businessDomain", v)} />
          <Select label="Unidad de medida" required disabled={locked} options={C.UNITS_OF_MEASURE} value={data.unitOfMeasure} error={err("unitOfMeasure")} onChange={(v) => set("unitOfMeasure", v)} />
          <TextArea className="sm:col-span-2" label="¿Qué decisión permite tomar este indicador?" required disabled={locked} value={data.kpiObjective} error={err("kpiObjective")} onChange={(v) => set("kpiObjective", v)} />
          <Select label="Frecuencia" required disabled={locked} options={C.FREQUENCIES} value={data.frequency} error={err("frequency")} onChange={(v) => set("frequency", v)} />
          <RadioGroup label="Dirección de tendencia" required disabled={locked} options={C.TREND_DIRECTIONS} value={data.trendDirection} error={err("trendDirection")} onChange={(v) => set("trendDirection", v)} />
        </div>
      </Section>

      <Section title="Bloque B · Fórmula, reglas y dimensiones">
        <div className="grid gap-4">
          <TextArea label="Fórmula de cálculo (explicación funcional)" required disabled={locked} placeholder="Ej. (Ventas Netas / Presupuesto) * 100" value={data.calculationFormula} error={err("calculationFormula")} onChange={(v) => set("calculationFormula", v)} />
          <TextArea label="Reglas de negocio (inclusión / exclusión)" required disabled={locked} placeholder="Ej. Excluir facturas anuladas y ventas intercompañía" value={data.businessRules} error={err("businessRules")} onChange={(v) => set("businessRules", v)} />
          <CheckboxGroup label="Dimensiones de análisis" required disabled={locked} columns={3} options={C.DIMENSIONS} values={data.dimensions} error={err("dimensions")} onChange={(v) => set("dimensions", v)} />
        </div>
      </Section>

      <Section
        title="Bloque C · Mapeo de variables con sistemas fuente"
        description="Agregue una fila por cada variable de la fórmula. El ID de transacción de ejemplo permite a TI rastrear el dato en la base de datos (Follow the Data)."
      >
        {err("variables") && <p className="mb-3 text-sm text-red-600">{err("variables")}</p>}
        <div className="space-y-3">
          {data.variables.map((v, i) => {
            const mapped = v.id ? mappings[v.id] : null;
            return (
              <div key={v.id ?? `new-${i}`} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">Variable {i + 1}</span>
                  <span className="flex items-center gap-3 text-xs">
                    {mapped && <span className="text-emerald-700">Mapeada por TI: {mapped}</span>}
                    {!locked && data.variables.length > 1 && (
                      <button type="button" className="text-red-600 hover:underline" onClick={() => set("variables", data.variables.filter((_, idx) => idx !== i))}>
                        Quitar
                      </button>
                    )}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <TextInput label="Nombre de la variable" required disabled={locked} placeholder="Ej. Total facturado" value={v.varName} error={err(`variables.${i}.varName`)} onChange={(x) => setVar(i, { varName: x })} />
                  <Select label="Sistema fuente" required disabled={locked} options={systems} value={v.sourceSystemCode} error={err(`variables.${i}.sourceSystemCode`)} onChange={(x) => setVar(i, { sourceSystemCode: x })} />
                  <TextInput label="Pantalla / módulo del menú" required disabled={locked} placeholder="Ventas > Facturación > Consulta" value={v.screenModuleName} error={err(`variables.${i}.screenModuleName`)} onChange={(x) => setVar(i, { screenModuleName: x })} />
                  <TextInput label="ID de transacción de ejemplo" required disabled={locked} placeholder="Ej. FAC-004512" value={v.sampleTransactionId} error={err(`variables.${i}.sampleTransactionId`)} onChange={(x) => setVar(i, { sampleTransactionId: x })} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="accent-brand-600" disabled={locked} checked={v.isSystemOfRecord} onChange={(e) => setVar(i, { isSystemOfRecord: e.target.checked })} />
                    Este sistema es la fuente única de verdad para esta variable
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="accent-brand-600" disabled={locked} checked={v.existsInOtherSystem} onChange={(e) => setVar(i, { existsInOtherSystem: e.target.checked })} />
                    El dato también existe (duplicado) en otro sistema
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        {!locked && (
          <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => set("variables", [...data.variables, emptyVariable()])}>
            + Agregar variable
          </button>
        )}
        {usedSystems.length > 0 && <p className="hint mt-3">Sistemas vinculados: {usedSystems.join(", ")}. Quedan priorizados para la carga técnica del Módulo 3.</p>}
      </Section>

      <Section
        title="Bloque D · Evidencia para ingeniería inversa"
        description="Las capturas permiten a TI ubicar la transacción de ejemplo y validar el resultado contra el reporte actual."
      >
        <div className="grid gap-4">
          <RadioGroup
            label="¿Cómo se calcula hoy?"
            required
            columns={3}
            disabled={locked}
            options={C.CALCULATION_METHODS}
            value={data.currentCalculationMethod}
            error={err("currentCalculationMethod")}
            onChange={(v) => set("currentCalculationMethod", v)}
          />
          {data.currentCalculationMethod === "MANUAL_EXCEL_CROSSING" && (
            <FileUploader
              label="Archivo Excel actual con fórmulas"
              required
              kind="KPI_EXCEL"
              accept=".xlsx,.xlsm,.xls,.csv"
              owner={{ kpiId: kpiId ?? undefined }}
              items={byKind("KPI_EXCEL")}
              onChange={replaceKind("KPI_EXCEL")}
              disabled={locked || !kpiId}
              disabledReason={evidenceDisabledReason}
              error={err("evidence.excel")}
            />
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <FileUploader
              label="1. Captura del registro de la transacción de ejemplo"
              required
              kind="KPI_SCREENSHOT_TRANSACTION"
              accept={SCREENSHOT_ACCEPT}
              owner={{ kpiId: kpiId ?? undefined }}
              items={byKind("KPI_SCREENSHOT_TRANSACTION")}
              onChange={replaceKind("KPI_SCREENSHOT_TRANSACTION")}
              disabled={locked || !kpiId}
              disabledReason={evidenceDisabledReason}
              error={err("evidence.transaction")}
              hint="Una por cada ID de transacción, idealmente."
            />
            <FileUploader
              label="2. Captura del reporte donde se refleja el dato hoy"
              required
              kind="KPI_SCREENSHOT_REPORT"
              accept={SCREENSHOT_ACCEPT}
              owner={{ kpiId: kpiId ?? undefined }}
              items={byKind("KPI_SCREENSHOT_REPORT")}
              onChange={replaceKind("KPI_SCREENSHOT_REPORT")}
              disabled={locked || !kpiId}
              disabledReason={evidenceDisabledReason}
              error={err("evidence.report")}
            />
          </div>
        </div>
      </Section>

      <div className="space-y-2">
        <FormMessage result={msg} />
        {!msg?.ok && <ErrorSummary errors={errors} labels={LABELS} />}
      </div>

      {!locked && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {kpiId && canDelete && (
              <button type="button" className="btn-danger" disabled={pending} onClick={remove}>
                Eliminar KPI
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => submit(false)}>
              {pending ? "Guardando…" : "Guardar borrador"}
            </button>
            <button type="button" className="btn-primary" disabled={pending} onClick={() => submit(true)}>
              {status === "DRAFT" ? "Marcar como completado" : "Guardar y validar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
