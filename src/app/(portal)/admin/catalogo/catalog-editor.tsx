"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { confirmCatalog, reopenCatalog, saveCatalog, type CatalogRow } from "@/app/actions/admin";
import { FormMessage } from "@/components/fields";

type U = { id: string; name: string; email: string; role: string };

export function CatalogEditor({
  initialRows,
  businessUsers,
  techUsers,
  confirmedAt,
  confirmedBy,
}: {
  initialRows: CatalogRow[];
  businessUsers: U[];
  techUsers: U[];
  confirmedAt: string | null;
  confirmedBy: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  const set = (i: number, patch: Partial<CatalogRow>) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setDirty(true);
  };
  const ready = rows.filter((r) => r.commonName.trim() && r.spocBusinessId && r.spocTechId).length;

  const save = () =>
    start(async () => {
      const res = await saveCatalog(rows);
      setErrors(res.ok ? {} : (res.fieldErrors ?? {}));
      setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "Guardado") : res.error });
      if (res.ok) {
        setDirty(false);
        router.refresh();
      }
    });

  const confirm = () =>
    start(async () => {
      const saved = await saveCatalog(rows);
      if (!saved.ok) {
        setErrors(saved.fieldErrors ?? {});
        setMsg({ ok: false, text: saved.error });
        return;
      }
      setDirty(false);
      const res = await confirmCatalog();
      setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "") : res.error });
      router.refresh();
    });

  const reopen = () =>
    start(async () => {
      if (!window.confirm("¿Reabrir el catálogo? Los formularios quedarán bloqueados para los usuarios finales.")) return;
      const res = await reopenCatalog();
      setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "") : res.error });
      router.refresh();
    });

  const noUsers = businessUsers.length === 0 || techUsers.length === 0;

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {confirmedAt ? (
            <span className="font-medium text-emerald-700">
              ● Catálogo confirmado el {new Date(confirmedAt).toLocaleString("es")} {confirmedBy ? `por ${confirmedBy}` : ""}
            </span>
          ) : (
            <span className="font-medium text-amber-700">● Catálogo pendiente de confirmación</span>
          )}
          <div className="text-slate-500">
            {ready} de {rows.length} sistemas con nombre común y ambos SPOC asignados.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={save} disabled={pending}>
            Guardar cambios
          </button>
          {confirmedAt ? (
            <button className="btn-danger" onClick={reopen} disabled={pending}>
              Reabrir catálogo
            </button>
          ) : (
            <button className="btn-primary" onClick={confirm} disabled={pending || ready < rows.length}>
              Confirmar catálogo y habilitar formularios
            </button>
          )}
        </div>
      </div>

      {noUsers && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Para asignar SPOC necesita usuarios con rol de negocio y técnico.{" "}
          <Link href="/admin/usuarios" className="link">
            Crear usuarios
          </Link>
        </div>
      )}
      <FormMessage result={msg} />
      {dirty && <p className="text-xs text-amber-700">Hay cambios sin guardar.</p>}

      <div className="card overflow-x-auto">
        <table className="data-table min-w-[820px]">
          <thead>
            <tr>
              <th className="w-24">Código</th>
              <th>Nombre común acordado</th>
              <th>SPOC funcional (negocio)</th>
              <th>SPOC técnico (TI)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.systemCode}>
                <td className="pt-4 font-mono text-xs font-semibold">{r.systemCode}</td>
                <td>
                  <input
                    className="input"
                    value={r.commonName}
                    maxLength={150}
                    placeholder="Ej. ERP Contable"
                    onChange={(e) => set(i, { commonName: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    className={`input ${errors[`${i}.spocBusinessId`] ? "input-error" : ""}`}
                    value={r.spocBusinessId}
                    onChange={(e) => set(i, { spocBusinessId: e.target.value })}
                  >
                    <option value="">Sin asignar</option>
                    {businessUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {u.email}
                      </option>
                    ))}
                  </select>
                  {errors[`${i}.spocBusinessId`] && <p className="mt-1 text-xs text-red-600">{errors[`${i}.spocBusinessId`]}</p>}
                </td>
                <td>
                  <select
                    className={`input ${errors[`${i}.spocTechId`] ? "input-error" : ""}`}
                    value={r.spocTechId}
                    onChange={(e) => set(i, { spocTechId: e.target.value })}
                  >
                    <option value="">Sin asignar</option>
                    {techUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {u.email}
                      </option>
                    ))}
                  </select>
                  {errors[`${i}.spocTechId`] && <p className="mt-1 text-xs text-red-600">{errors[`${i}.spocTechId`]}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
