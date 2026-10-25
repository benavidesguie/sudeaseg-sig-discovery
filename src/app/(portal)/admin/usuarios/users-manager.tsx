"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser } from "@/app/actions/admin";
import { FormMessage, Select, TextInput } from "@/components/fields";
import { ROLES, labelOf } from "@/lib/catalogs";
import { Badge } from "@/components/ui";

type Row = { id: string; name: string; email: string; role: "ADMIN" | "BUSINESS" | "TECH"; active: boolean; spocCount: number };

export function UsersManager({ users, meId }: { users: Row[]; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", email: "", role: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const create = () =>
    start(async () => {
      const res = await createUser({ ...form, role: form.role as Row["role"] });
      setErrors(res.ok ? {} : (res.fieldErrors ?? {}));
      setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "") : res.error });
      if (res.ok) {
        setForm({ name: "", email: "", role: "", password: "" });
        router.refresh();
      }
    });

  const update = (u: Row, patch: Partial<Row> & { password?: string }) =>
    start(async () => {
      const res = await updateUser({ id: u.id, role: patch.role ?? u.role, active: patch.active ?? u.active, password: patch.password });
      setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "") : res.error });
      router.refresh();
    });

  const resetPassword = (u: Row) => {
    const pwd = window.prompt(`Nueva contraseña para ${u.name} (mínimo 10 caracteres):`);
    if (pwd) update(u, { password: pwd });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card p-5 lg:col-span-1">
        <h2 className="text-base font-semibold">Nuevo usuario</h2>
        <div className="mt-4 space-y-3">
          <TextInput label="Nombre" required value={form.name} error={errors.name} onChange={(v) => setForm({ ...form, name: v })} />
          <TextInput label="Correo" required type="email" value={form.email} error={errors.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Select label="Rol" required options={ROLES} value={form.role} error={errors.role} onChange={(v) => setForm({ ...form, role: v })} />
          <TextInput
            label="Contraseña inicial"
            required
            type="password"
            value={form.password}
            error={errors.password}
            hint="Mínimo 10 caracteres. Compártala por un canal seguro."
            onChange={(v) => setForm({ ...form, password: v })}
          />
          <button className="btn-primary w-full" onClick={create} disabled={pending}>
            Crear usuario
          </button>
        </div>
      </div>
      <div className="space-y-3 lg:col-span-2">
        <FormMessage result={msg} />
        <div className="card overflow-x-auto">
          <table className="data-table min-w-[640px]">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Responsable de</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                  <td>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td>
                    <select
                      className="input py-1 text-xs"
                      value={u.role}
                      disabled={pending || u.id === meId}
                      onChange={(e) => update(u, { role: e.target.value as Row["role"] })}
                      aria-label={`Rol de ${u.name}`}
                    >
                      {ROLES.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{u.active ? <Badge tone="green">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                  <td className="text-xs text-slate-600">{u.spocCount ? `${u.spocCount} sistema(s)` : "—"}</td>
                  <td className="text-right whitespace-nowrap">
                    <button className="btn-secondary btn-sm mr-1" disabled={pending} onClick={() => resetPassword(u)}>
                      Contraseña
                    </button>
                    {u.id !== meId && (
                      <button className="btn-secondary btn-sm" disabled={pending} onClick={() => update(u, { active: !u.active })}>
                        {u.active ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">Roles: {ROLES.map(([v]) => labelOf(ROLES, v)).join(" · ")}</p>
      </div>
    </div>
  );
}
