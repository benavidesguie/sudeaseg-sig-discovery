"use client";

import { useEffect, useState } from "react";

type Col = { tableSchema: string | null; tableName: string; columnName: string; dataType: string; isNullable: string | null; charMaxLength: number | null };

export function SchemaSearch({ systemCode }: { systemCode: string }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ results: Col[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/schemas/${systemCode}?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        setData(await res.json());
      } catch {
        // Búsqueda cancelada por una nueva tecla.
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, systemCode]);

  return (
    <div>
      <input
        className="input"
        placeholder="Buscar por nombre de tabla o columna (mín. 2 caracteres)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar tablas y columnas"
      />
      {loading && <p className="hint">Buscando…</p>}
      {data && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500">
            {data.total.toLocaleString("es")} coincidencias{data.total > data.results.length ? ` (se muestran ${data.results.length})` : ""}
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
            <table className="data-table">
              <thead className="sticky top-0">
                <tr>
                  <th>Esquema</th>
                  <th>Tabla</th>
                  <th>Columna</th>
                  <th>Tipo</th>
                  <th>Nulos</th>
                  <th>Longitud</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((c, i) => (
                  <tr key={i}>
                    <td className="text-xs text-slate-500">{c.tableSchema ?? "—"}</td>
                    <td className="font-mono text-xs">{c.tableName}</td>
                    <td className="font-mono text-xs font-semibold">{c.columnName}</td>
                    <td className="text-xs">{c.dataType}</td>
                    <td className="text-xs">{c.isNullable ?? "—"}</td>
                    <td className="text-xs">{c.charMaxLength ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
