"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveConnectivity } from "@/app/actions/systems";
import * as C from "@/lib/catalogs";
import type { ConnectivityFormData } from "@/lib/validation";
import { CheckboxGroup, FormMessage, RadioGroup, Select, TextInput, YesNo } from "@/components/fields";

export function ConnectivityForm({
  systemCode,
  initial,
  locked,
  suggested,
}: {
  systemCode: string;
  initial: ConnectivityFormData;
  locked: boolean;
  suggested: string | null;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof ConnectivityFormData>(k: K, v: ConnectivityFormData[K]) => setData((d) => ({ ...d, [k]: v }));

  const submit = (complete: boolean) =>
    start(async () => {
      const res = await saveConnectivity(systemCode, data, complete);
      setErrors(res.fieldErrors ?? {});
      setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "Guardado") : res.error });
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="card space-y-5 p-5 sm:p-6">
        <RadioGroup
          label="Patrón de integración"
          required
          disabled={locked}
          options={C.INTEGRATION_PATTERNS}
          value={data.integrationPattern}
          error={errors.integrationPattern}
          hint={suggested ? `Sugerido según el nivel de acceso: ${C.labelOf(C.INTEGRATION_PATTERNS, suggested)}` : undefined}
          onChange={(v) => set("integrationPattern", v)}
        />
        {data.integrationPattern === "TYPE_D_CONTROLLED_MANUAL" && (
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
            Los sistemas con patrón Tipo D se clasifican automáticamente en la Oleada 3 (plantillas controladas).
          </p>
        )}
        <CheckboxGroup
          label="Requisitos de red"
          disabled={locked}
          columns={3}
          options={C.NETWORK_REQUIREMENTS}
          values={data.networkRequirements}
          error={errors.networkRequirements}
          onChange={(v) => set("networkRequirements", v)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <YesNo
            label="¿Soporta carga incremental?"
            required
            disabled={locked}
            value={data.supportsIncrementalLoad}
            error={errors.supportsIncrementalLoad}
            hint="¿Las tablas tienen un campo updated_at o un ID secuencial confiable?"
            onChange={(v) => set("supportsIncrementalLoad", v)}
          />
          <Select
            label="Volumen histórico estimado"
            disabled={locked}
            options={C.VOLUME_ESTIMATES}
            value={data.historicalVolumeEstimate}
            error={errors.historicalVolumeEstimate}
            onChange={(v) => set("historicalVolumeEstimate", v)}
          />
          <TextInput
            className="sm:col-span-2"
            label="Ventana de extracción permitida"
            required
            disabled={locked}
            placeholder="Ej. 01:00 AM - 04:00 AM"
            value={data.extractionWindow}
            error={errors.extractionWindow}
            hint="Horario en el que la extracción no afecta la operación."
            onChange={(v) => set("extractionWindow", v)}
          />
        </div>
      </div>
      <FormMessage result={msg} />
      {!locked && (
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" disabled={pending} onClick={() => submit(false)}>
            {pending ? "Guardando…" : "Guardar borrador"}
          </button>
          <button className="btn-primary" disabled={pending} onClick={() => submit(true)}>
            Marcar como completado
          </button>
        </div>
      )}
    </div>
  );
}
