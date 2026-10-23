"use client";

import { useRef, useState } from "react";

export type AttachmentItem = {
  id: string;
  kind: string;
  originalName: string;
  sizeBytes: number;
  createdAt: string | Date;
  canDelete?: boolean;
};

function size(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileUploader({
  kind,
  owner,
  items,
  onChange,
  accept,
  multiple = true,
  disabled,
  disabledReason,
  required,
  error,
  label,
  hint,
}: {
  kind: string;
  owner: { systemCode?: string; kpiId?: string };
  items: AttachmentItem[];
  onChange: (items: AttachmentItem[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  required?: boolean;
  error?: string;
  label: string;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage(null);
    const added: AttachmentItem[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", kind);
      if (owner.systemCode) fd.set("systemCode", owner.systemCode);
      if (owner.kpiId) fd.set("kpiId", owner.kpiId);
      const res = await fetch("/api/files", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({ ok: false, error: "Error de red" }));
      if (json.ok) added.push({ ...json.attachment, canDelete: true });
      else setMessage(`${file.name}: ${json.error}`);
    }
    onChange([...items, ...added]);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este archivo?")) return;
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({ ok: false, error: "Error de red" }));
    if (json.ok) onChange(items.filter((i) => i.id !== id));
    else setMessage(json.error);
  }

  return (
    <div>
      <div className="label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </div>
      <div className={`rounded-lg border border-dashed p-3 ${error ? "border-red-400 bg-red-50/40" : "border-slate-300 bg-slate-50/60"}`}>
        {items.length > 0 && (
          <ul className="mb-2 space-y-1">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5 text-sm ring-1 ring-slate-200">
                <a href={`/api/files/${i.id}`} target="_blank" rel="noreferrer" className="link truncate">
                  {i.originalName}
                </a>
                <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                  {size(i.sizeBytes)}
                  {i.canDelete && !disabled && (
                    <button type="button" className="text-red-600 hover:underline" onClick={() => remove(i.id)}>
                      Eliminar
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {disabled ? (
          <p className="text-xs text-slate-500">{disabledReason ?? "Carga deshabilitada."}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={input}
              type="file"
              accept={accept}
              multiple={multiple}
              className="hidden"
              onChange={(e) => upload(e.target.files)}
            />
            <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "Subiendo…" : items.length ? "Agregar archivo" : "Seleccionar archivo"}
            </button>
            {hint && <span className="text-xs text-slate-500">{hint}</span>}
          </div>
        )}
      </div>
      {(message || error) && <p className="mt-1 text-xs text-red-600">{message ?? error}</p>}
    </div>
  );
}
