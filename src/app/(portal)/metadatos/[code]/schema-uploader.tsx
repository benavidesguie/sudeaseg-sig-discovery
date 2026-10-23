"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function SchemaUploader({ systemCode, disabled }: { systemCode: string; disabled: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch(`/api/schemas/${systemCode}`, { method: "POST", body: fd });
    const json = await res.json().catch(() => ({ ok: false, error: "Error de red" }));
    setBusy(false);
    if (input.current) input.current.value = "";
    if (json.ok) {
      setResult({
        ok: true,
        text: `Esquema procesado: ${json.tables.toLocaleString("es")} tablas y ${json.columns.toLocaleString("es")} columnas.${
          json.skipped ? ` Se omitieron ${json.skipped} filas vacías o duplicadas.` : ""
        }`,
      });
      router.refresh();
    } else {
      setResult({ ok: false, text: json.error });
    }
  }

  return (
    <div>
      <input ref={input} type="file" accept=".csv,.tsv,.txt,.json" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <button type="button" className="btn-primary" disabled={disabled || busy} onClick={() => input.current?.click()}>
        {busy ? "Procesando…" : "Subir archivo de esquema"}
      </button>
      {result && (
        <p className={`mt-2 text-sm ${result.ok ? "text-emerald-700" : "text-red-600"}`} role="status">
          {result.text}
        </p>
      )}
    </div>
  );
}
