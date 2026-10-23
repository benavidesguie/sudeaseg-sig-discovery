"use client";

import { useState } from "react";

export function ScriptBlock({ script, language, fileName }: { script: string; language: string; fileName: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
    } catch {
      // Navegadores sin permiso de portapapeles (HTTP): selección manual como respaldo.
      const ta = document.createElement("textarea");
      ta.value = script;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([script], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-1.5">
        <span className="font-mono text-xs text-slate-400">{language.toUpperCase()}</span>
        <div className="flex gap-2">
          <button type="button" onClick={download} className="rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700">
            Descargar
          </button>
          <button type="button" onClick={copy} className="rounded bg-brand-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-brand-500">
            {copied ? "¡Copiado!" : "Copiar script"}
          </button>
        </div>
      </div>
      <pre className="max-h-[28rem] overflow-auto p-4 text-xs leading-relaxed text-slate-100">
        <code>{script}</code>
      </pre>
    </div>
  );
}
