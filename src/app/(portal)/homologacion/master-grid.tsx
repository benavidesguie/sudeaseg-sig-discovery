"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMasterRows } from "@/app/actions/master";
import { FormMessage } from "@/components/fields";
import type { MasterRowForm } from "@/lib/validation";

type Sys = { code: string; name: string };

const blank = (): MasterRowForm => ({ canonicalCode: "", canonicalName: "", systemEquivalences: {} });

export function MasterGrid({
  entity,
  entityLabel,
  systems,
  defaultColumns,
  initialRows,
  locked,
}: {
  entity: string;
  entityLabel: string;
  systems: Sys[];
  defaultColumns: string[];
  initialRows: MasterRowForm[];
  locked: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<MasterRowForm[]>(initialRows.length ? initialRows : [blank()]);
  const [cols, setCols] = useState<string[]>(defaultColumns.length ? defaultColumns : systems.slice(0, 4).map((s) => s.code));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<MasterRowForm>) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setDirty(true);
  };
  const setEq = (i: number, code: string, value: string) =>
    update(i, { systemEquivalences: { ...rows[i].systemEquivalences, [code]: value } });
  const toggleCol = (code: string) =>
    setCols((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code].sort()));

  const save = () =>
    start(async () => {
      const res = await saveMasterRows(entity, rows);
      setErrors(res.fieldErrors ?? {});
      setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "Guardado") : res.error });
      if (res.ok) {
        setDirty(false);
        router.refresh();
      }
    });

  const exportCsv = () => {
    const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const header = ["canonical_code", "canonical_name", ...cols].map(esc).join(",");
    const lines = rows.map((r) => [r.canonicalCode, r.canonicalName, ...cols.map((c) => r.systemEquivalences[c] ?? "")].map(esc).join(","));
    const url = URL.createObjectURL(new Blob(["﻿" + [header, ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `homologacion-${entity.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Equivalencias guardadas en sistemas cuya columna está oculta: se conservan al guardar.
  const hiddenWithData = systems.filter((s) => !cols.includes(s.code) && rows.some((r) => r.systemEquivalences[s.code]));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <details className="relative">
          <summary className="btn-secondary btn-sm cursor-pointer list-none">Columnas de sistemas ({cols.length})</summary>
          <div className="absolute z-10 mt-1 grid max-h-80 w-80 grid-cols-2 gap-1 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
            {systems.map((s) => (
              <label key={s.code} className="flex items-center gap-1.5" title={s.name}>
                <input type="checkbox" className="accent-brand-600" checked={cols.includes(s.code)} onChange={() => toggleCol(s.code)} />
                <span className="truncate">
                  {s.code} {s.name && `· ${s.name}`}
                </span>
              </label>
            ))}
          </div>
        </details>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={exportCsv}>
            Exportar CSV
          </button>
          {!locked && (
            <button className="btn-primary btn-sm" disabled={pending} onClick={save}>
              {pending ? "Guardando…" : "Guardar grilla"}
            </button>
          )}
        </div>
      </div>
      {hiddenWithData.length > 0 && (
        <p className="text-xs text-slate-500">Columnas ocultas con datos (se conservan): {hiddenWithData.map((s) => s.code).join(", ")}</p>
      )}
      <FormMessage result={msg} />
      {dirty && <p className="text-xs text-amber-700">Hay cambios sin guardar.</p>}

      <div className="card overflow-x-auto">
        <table className="data-table" style={{ minWidth: 420 + cols.length * 130 }}>
          <thead>
            <tr>
              <th className="w-40">Código canónico *</th>
              <th className="w-56">Nombre homologado *</th>
              {cols.map((c) => (
                <th key={c} className="w-32" title={systems.find((s) => s.code === c)?.name}>
                  {c}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <input
                    className={`input py-1 font-mono text-xs uppercase ${errors[`${i}.canonicalCode`] ? "input-error" : ""}`}
                    value={r.canonicalCode}
                    disabled={locked}
                    aria-label={`Código canónico fila ${i + 1}`}
                    onChange={(e) => update(i, { canonicalCode: e.target.value })}
                  />
                  {errors[`${i}.canonicalCode`] && <p className="mt-1 text-[11px] text-red-600">{errors[`${i}.canonicalCode`]}</p>}
                </td>
                <td>
                  <input
                    className={`input py-1 text-xs ${errors[`${i}.canonicalName`] ? "input-error" : ""}`}
                    value={r.canonicalName}
                    disabled={locked}
                    aria-label={`Nombre homologado fila ${i + 1}`}
                    onChange={(e) => update(i, { canonicalName: e.target.value })}
                  />
                  {errors[`${i}.canonicalName`] && <p className="mt-1 text-[11px] text-red-600">{errors[`${i}.canonicalName`]}</p>}
                </td>
                {cols.map((c) => (
                  <td key={c}>
                    <input
                      className="input py-1 font-mono text-xs"
                      value={r.systemEquivalences[c] ?? ""}
                      disabled={locked}
                      aria-label={`${c} fila ${i + 1}`}
                      onChange={(e) => setEq(i, c, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  {!locked && (
                    <button
                      className="mt-1 text-slate-400 hover:text-red-600"
                      aria-label={`Eliminar fila ${i + 1}`}
                      onClick={() => {
                        setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : [blank()]));
                        setDirty(true);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!locked && (
        <button className="btn-secondary btn-sm" onClick={() => setRows((r) => [...r, blank()])}>
          + Agregar fila ({entityLabel.toLowerCase()})
        </button>
      )}
    </div>
  );
}
