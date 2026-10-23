"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMappings } from "@/app/actions/metadata";
import { FormMessage } from "@/components/fields";
import type { VariableMappingForm } from "@/lib/validation";
import { isVariableMapped } from "@/lib/validation";

type Evidence = { id: string; kind: string; originalName: string };
type Variable = {
  id: string;
  varName: string;
  screenModuleName: string;
  sampleTransactionId: string;
  isSystemOfRecord: boolean;
  existsInOtherSystem: boolean;
  kpi: { id: string; code: string; name: string; formula: string | null; rules: string | null; evidence: Evidence[] };
  mapping: VariableMappingForm;
};

const EVIDENCE_LABEL: Record<string, string> = {
  KPI_SCREENSHOT_TRANSACTION: "Captura transacción",
  KPI_SCREENSHOT_REPORT: "Captura reporte",
  KPI_EXCEL: "Excel actual",
};

export function FollowTheData({
  systemCode,
  schemaUploaded,
  locked,
  variables,
}: {
  systemCode: string;
  schemaUploaded: boolean;
  locked: boolean;
  variables: Variable[];
}) {
  const router = useRouter();
  const [mappings, setMappings] = useState<Record<string, VariableMappingForm>>(
    Object.fromEntries(variables.map((v) => [v.id, v.mapping])),
  );
  const [tables, setTables] = useState<string[]>([]);
  const [columns, setColumns] = useState<Record<string, string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!schemaUploaded) return;
    fetch(`/api/schemas/${systemCode}?tables=1`)
      .then((r) => r.json())
      .then((j) => setTables(Array.from(new Set<string>((j.tables ?? []).map((t: { name: string }) => t.name)))))
      .catch(() => setTables([]));
  }, [schemaUploaded, systemCode]);

  // Carga perezosa de columnas por tabla para alimentar los desplegables.
  useEffect(() => {
    if (!schemaUploaded) return;
    const needed = Array.from(new Set(Object.values(mappings).map((m) => m.physicalTableName.trim())))
      .filter((t) => t && tables.includes(t) && !columns[t]);
    for (const t of needed) {
      fetch(`/api/schemas/${systemCode}?table=${encodeURIComponent(t)}`)
        .then((r) => r.json())
        .then((j) => setColumns((c) => ({ ...c, [t]: (j.columns ?? []).map((x: { columnName: string }) => x.columnName) })))
        .catch(() => undefined);
    }
  }, [mappings, tables, columns, schemaUploaded, systemCode]);

  const set = (id: string, patch: Partial<VariableMappingForm>) => setMappings((m) => ({ ...m, [id]: { ...m[id], ...patch } }));

  const save = () =>
    start(async () => {
      const res = await saveMappings(
        systemCode,
        variables.map((v) => ({ variableId: v.id, ...mappings[v.id] })),
      );
      setErrors(res.fieldErrors ?? {});
      setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "Guardado") : res.error });
      if (res.ok) router.refresh();
    });

  const mappedCount = variables.filter((v) => isVariableMapped(mappings[v.id])).length;

  return (
    <div className="space-y-4">
      {!schemaUploaded && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Suba el esquema para habilitar los desplegables de tablas y columnas. Mientras tanto puede escribir los nombres manualmente.
        </p>
      )}
      <datalist id={`tables-${systemCode}`}>
        {tables.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <p className="text-sm text-slate-600">
        {mappedCount} de {variables.length} variables mapeadas (tabla, columna y llave primaria).
      </p>

      {variables.map((v) => {
        const m = mappings[v.id];
        const listId = `cols-${v.id}`;
        const cols = columns[m.physicalTableName.trim()] ?? [];
        const e = (k: string) => errors[`${v.id}.${k}`];
        const input = (k: keyof VariableMappingForm, label: string, list?: string, required?: boolean) => (
          <div>
            <label className="label text-xs">
              {label}
              {required && <span className="text-red-500"> *</span>}
            </label>
            <input
              className={`input font-mono text-xs ${e(k) ? "input-error" : ""}`}
              list={list}
              value={m[k]}
              disabled={locked}
              onChange={(ev) => set(v.id, { [k]: ev.target.value })}
            />
            {e(k) && <p className="mt-1 text-xs text-red-600">{e(k)}</p>}
          </div>
        );
        return (
          <div key={v.id} className="rounded-lg border border-slate-200">
            <div className="grid gap-4 border-b border-slate-100 bg-slate-50/70 p-4 lg:grid-cols-2">
              <div>
                <div className="text-xs font-semibold tracking-wide text-brand-600 uppercase">
                  {v.kpi.code} · {v.kpi.name}
                </div>
                <div className="mt-1 text-base font-semibold">{v.varName || "(variable sin nombre)"}</div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-slate-500">Pantalla</dt>
                  <dd>{v.screenModuleName || "—"}</dd>
                  <dt className="text-slate-500">Transacción ejemplo</dt>
                  <dd className="font-mono font-semibold">{v.sampleTransactionId || "—"}</dd>
                  <dt className="text-slate-500">Fuente única</dt>
                  <dd>{v.isSystemOfRecord ? "Sí" : "No"}{v.existsInOtherSystem ? " · duplicado en otro sistema" : ""}</dd>
                </dl>
              </div>
              <div className="text-sm">
                {v.kpi.formula && (
                  <p>
                    <span className="text-slate-500">Fórmula:</span> {v.kpi.formula}
                  </p>
                )}
                {v.kpi.rules && (
                  <p className="mt-1">
                    <span className="text-slate-500">Reglas:</span> {v.kpi.rules}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.kpi.evidence.length ? (
                    v.kpi.evidence.map((a) => (
                      <a key={a.id} href={`/api/files/${a.id}`} target="_blank" rel="noreferrer" className="rounded-md bg-white px-2 py-1 text-xs ring-1 ring-slate-200 hover:ring-brand-500">
                        {EVIDENCE_LABEL[a.kind]}: {a.originalName}
                      </a>
                    ))
                  ) : (
                    <span className="text-xs text-amber-700">Negocio aún no adjuntó capturas.</span>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {input("physicalTableName", "Tabla física", `tables-${systemCode}`, true)}
              {input("physicalColumnName", "Columna física", listId, true)}
              {input("primaryKeyColumn", "Llave primaria", listId, true)}
              {input("incrementalDateColumn", "Campo de fecha incremental", listId)}
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="label text-xs">Regla de transformación (opcional)</label>
                <textarea
                  className="input text-xs"
                  rows={2}
                  value={m.transformationRule}
                  disabled={locked}
                  placeholder="Ej. SUM(monto) WHERE estado <> 'ANULADA' AND tipo_cliente <> 'INTERCOMPANIA'"
                  onChange={(ev) => set(v.id, { transformationRule: ev.target.value })}
                />
              </div>
              <datalist id={listId}>
                {cols.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
        );
      })}

      <FormMessage result={msg} />
      {!locked && (
        <div className="flex justify-end">
          <button className="btn-primary" disabled={pending} onClick={save}>
            {pending ? "Guardando…" : "Guardar mapeo"}
          </button>
        </div>
      )}
    </div>
  );
}
