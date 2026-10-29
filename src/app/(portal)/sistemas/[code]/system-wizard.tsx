"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSystem } from "@/app/actions/systems";
import * as C from "@/lib/catalogs";
import type { Contact, SystemFormData } from "@/lib/validation";
import { SYSTEM_BUSINESS_FIELDS } from "@/lib/validation";
import { CheckboxGroup, ErrorSummary, FormMessage, RadioGroup, Select, TagsInput, TextInput, YesNo } from "@/components/fields";
import { FileUploader, type AttachmentItem } from "@/components/file-uploader";

const STEPS = [
  { key: "A", title: "Identificación y dominio funcional", owner: "Negocio" },
  { key: "B", title: "Propiedad, custodia y nivel de acceso", owner: "Negocio + TI" },
  { key: "C", title: "Plataforma tecnológica y alojamiento", owner: "TI" },
];

const STEP_OF: Record<string, number> = {
  officialName: 0,
  internalAlias: 0,
  version: 0,
  businessDomain: 0,
  userDepartments: 0,
  activeUsersRange: 0,
  kpiCriticality: 0,
  businessOwner: 1,
  techCustodian: 1,
  solutionType: 1,
  accessLevel: 1,
  vendorInfo: 1,
  hostingType: 2,
  dbEngine: 2,
  techStack: 2,
  docStatus: 2,
};

const LABELS: Record<string, string> = {
  officialName: "Nombre oficial",
  businessDomain: "Dominio de negocio",
  userDepartments: "Departamentos usuarios",
  activeUsersRange: "Usuarios activos",
  kpiCriticality: "Criticidad para indicadores",
  "businessOwner.name": "Dueño funcional · nombre",
  "businessOwner.role": "Dueño funcional · cargo",
  "businessOwner.email": "Dueño funcional · correo",
  "businessOwner.phone": "Dueño funcional · teléfono",
  "techCustodian.name": "Custodio técnico · nombre",
  "techCustodian.role": "Custodio técnico · cargo",
  "techCustodian.email": "Custodio técnico · correo",
  "techCustodian.phone": "Custodio técnico · teléfono",
  solutionType: "Tipo de solución",
  accessLevel: "Nivel de acceso",
  "vendorInfo.vendor_name": "Proveedor · nombre",
  "vendorInfo.vendor_contact_email": "Proveedor · correo",
  "vendorInfo.has_active_support_contract": "Proveedor · contrato de soporte",
  "vendorInfo.requires_extra_fee": "Proveedor · costo extra",
  hostingType: "Tipo de alojamiento",
  dbEngine: "Motor de base de datos",
  docStatus: "Estado de documentación",
};

export function SystemWizard({
  systemCode,
  initial,
  scope,
  locked,
  attachments: initialAttachments,
  departmentSuggestions,
}: {
  systemCode: string;
  initial: SystemFormData;
  scope: "all" | "business" | "tech";
  locked: boolean;
  attachments: AttachmentItem[];
  departmentSuggestions: string[];
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [attachments, setAttachments] = useState(initialAttachments);

  const businessField = (f: string) => (SYSTEM_BUSINESS_FIELDS as readonly string[]).includes(f);
  const editable = (f: string) => !locked && (scope === "all" || (scope === "business") === businessField(f));
  const err = (k: string) => errors[k];
  const set = <K extends keyof SystemFormData>(k: K, v: SystemFormData[K]) => setData((d) => ({ ...d, [k]: v }));
  const setContact = (k: "businessOwner" | "techCustodian", field: keyof Contact, v: string) =>
    setData((d) => ({ ...d, [k]: { ...d[k], [field]: v } }));
  const setVendor = <K extends keyof SystemFormData["vendorInfo"]>(field: K, v: SystemFormData["vendorInfo"][K]) =>
    setData((d) => ({ ...d, vendorInfo: { ...d.vendorInfo, [field]: v } }));

  const errorsInStep = (i: number) => Object.keys(errors).filter((k) => STEP_OF[k.split(".")[0]] === i).length;

  const submit = (complete: boolean) =>
    start(async () => {
      const res = await saveSystem(systemCode, data, complete);
      setErrors(res.fieldErrors ?? {});
      setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "Guardado") : res.error });
      if (!res.ok && res.fieldErrors) {
        const first = Object.keys(res.fieldErrors)[0];
        if (first && STEP_OF[first.split(".")[0]] !== undefined) setStep(STEP_OF[first.split(".")[0]]);
      }
      router.refresh();
    });

  const contactBlock = (k: "businessOwner" | "techCustodian", title: string, hint: string) => {
    const dis = !editable(k);
    return (
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">
          {title} <span className="text-red-500">*</span>
        </legend>
        <p className="mb-3 text-xs text-slate-500">{hint}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="Nombre" required disabled={dis} value={data[k].name} error={err(`${k}.name`)} onChange={(v) => setContact(k, "name", v)} />
          <TextInput label="Cargo" required disabled={dis} value={data[k].role} error={err(`${k}.role`)} onChange={(v) => setContact(k, "role", v)} />
          <TextInput label="Correo" type="email" required disabled={dis} value={data[k].email} error={err(`${k}.email`)} onChange={(v) => setContact(k, "email", v)} />
          <TextInput label="Teléfono" required disabled={dis} value={data[k].phone} error={err(`${k}.phone`)} onChange={(v) => setContact(k, "phone", v)} />
        </div>
      </fieldset>
    );
  };

  return (
    <div className="space-y-4">
      {scope !== "all" && !locked && (
        <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-900">
          {scope === "business"
            ? "Usted edita la sección funcional. Los campos técnicos se muestran en solo lectura y los completa el custodio técnico."
            : "Usted edita la sección técnica. Los campos funcionales se muestran en solo lectura y los completa el dueño funcional."}
        </div>
      )}

      <ol className="grid gap-2 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                step === i ? "border-brand-500 bg-white shadow-sm" : "border-slate-200 bg-white/60 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-brand-600 uppercase">
                Bloque {s.key} · {s.owner}
                {errorsInStep(i) > 0 && <span className="rounded-full bg-red-100 px-1.5 text-red-700">{errorsInStep(i)}</span>}
              </div>
              <div className="mt-0.5 text-sm font-medium text-slate-800">{s.title}</div>
            </button>
          </li>
        ))}
      </ol>

      <div className="card p-5 sm:p-6">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Código del sistema" value={systemCode} disabled onChange={() => {}} hint={`Selector oficial ${C.SYSTEM_RANGE} (clave única).`} />
            <TextInput label="Nombre comercial u oficial" required disabled={!editable("officialName")} value={data.officialName} error={err("officialName")} onChange={(v) => set("officialName", v)} />
            <TextInput label="Alias interno" disabled={!editable("internalAlias")} value={data.internalAlias} hint="Cómo lo conoce el personal." onChange={(v) => set("internalAlias", v)} />
            <TextInput label="Versión actual" disabled={!editable("version")} value={data.version} onChange={(v) => set("version", v)} />
            <Select label="Dominio de negocio" required options={C.BUSINESS_DOMAINS} disabled={!editable("businessDomain")} value={data.businessDomain} error={err("businessDomain")} onChange={(v) => set("businessDomain", v)} />
            <Select label="Rango de usuarios activos" required options={C.ACTIVE_USERS_RANGES} disabled={!editable("activeUsersRange")} value={data.activeUsersRange} error={err("activeUsersRange")} onChange={(v) => set("activeUsersRange", v)} />
            <TagsInput
              className="sm:col-span-2"
              label="Departamentos que operan el sistema"
              required
              disabled={!editable("userDepartments")}
              values={data.userDepartments}
              suggestions={departmentSuggestions}
              error={err("userDepartments")}
              onChange={(v) => set("userDepartments", v)}
            />
            <RadioGroup
              className="sm:col-span-2"
              label="Criticidad para indicadores"
              required
              options={C.KPI_CRITICALITIES}
              disabled={!editable("kpiCriticality")}
              value={data.kpiCriticality}
              error={err("kpiCriticality")}
              onChange={(v) => set("kpiCriticality", v)}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {contactBlock("businessOwner", "Dueño funcional / Custodio de los datos", "Responsable del negocio sobre los datos del sistema (lo completa negocio).")}
            {contactBlock("techCustodian", "Custodio técnico interno", "Administrador técnico del sistema (lo completa TI).")}
            <Select label="Tipo de solución" required options={C.SOLUTION_TYPES} disabled={!editable("solutionType")} value={data.solutionType} error={err("solutionType")} onChange={(v) => set("solutionType", v)} />
            <RadioGroup label="Nivel de acceso" required options={C.ACCESS_LEVELS} disabled={!editable("accessLevel")} value={data.accessLevel} error={err("accessLevel")} onChange={(v) => set("accessLevel", v)} />
            {data.accessLevel === "RESTRICTED_VENDOR" && (
              <fieldset className="rounded-lg border-2 border-red-200 bg-red-50/50 p-4">
                <legend className="px-1 text-sm font-semibold text-red-800">Información del proveedor (obligatoria)</legend>
                <p className="mb-3 text-xs text-red-700">
                  Este sistema se marcará con alerta roja de <strong>Riesgo de secuestro de datos / gestión de proveedor requerida</strong> en el tablero de avance.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput label="Nombre del proveedor" required disabled={!editable("vendorInfo")} value={data.vendorInfo.vendor_name} error={err("vendorInfo.vendor_name")} onChange={(v) => setVendor("vendor_name", v)} />
                  <TextInput label="Correo de contacto" type="email" required disabled={!editable("vendorInfo")} value={data.vendorInfo.vendor_contact_email} error={err("vendorInfo.vendor_contact_email")} onChange={(v) => setVendor("vendor_contact_email", v)} />
                  <YesNo label="¿Tiene contrato de soporte activo?" required disabled={!editable("vendorInfo")} value={data.vendorInfo.has_active_support_contract} error={err("vendorInfo.has_active_support_contract")} onChange={(v) => setVendor("has_active_support_contract", v)} />
                  <Select label="¿Requiere pago extra para acceso?" required options={C.EXTRA_FEE_OPTIONS} disabled={!editable("vendorInfo")} value={data.vendorInfo.requires_extra_fee} error={err("vendorInfo.requires_extra_fee")} onChange={(v) => setVendor("requires_extra_fee", v)} />
                </div>
              </fieldset>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Tipo de alojamiento" required options={C.HOSTING_TYPES} disabled={!editable("hostingType")} value={data.hostingType} error={err("hostingType")} onChange={(v) => set("hostingType", v)} />
            <Select label="Motor de base de datos" required options={C.DB_ENGINES} disabled={!editable("dbEngine")} value={data.dbEngine} error={err("dbEngine")} hint="Determina el script de extracción de metadatos del Módulo 3." onChange={(v) => set("dbEngine", v)} />
            <TextInput className="sm:col-span-2" label="Stack tecnológico" disabled={!editable("techStack")} value={data.techStack} placeholder="Ej. Java 8 / Spring, .NET Framework 4.7, PHP Laravel" onChange={(v) => set("techStack", v)} />
            <CheckboxGroup
              className="sm:col-span-2"
              label="Documentación disponible"
              required
              options={C.DOC_STATUSES}
              disabled={!editable("docStatus")}
              values={data.docStatus}
              error={err("docStatus")}
              onChange={(v) => set("docStatus", v)}
            />
            <div className="sm:col-span-2">
              <FileUploader
                label="Documentación previa (opcional)"
                kind="SYSTEM_DOC"
                owner={{ systemCode }}
                items={attachments}
                onChange={setAttachments}
                disabled={locked || scope === "business"}
                disabledReason={locked ? "Bloqueado hasta confirmar el catálogo (Fase 0)." : "La documentación técnica la carga el custodio técnico."}
                hint="MER, diccionarios, manuales, documentación de API (PDF, Office, imágenes, ZIP…)."
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <FormMessage result={msg} />
        {!msg?.ok && <ErrorSummary errors={errors} labels={LABELS} />}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            ← Anterior
          </button>
          <button type="button" className="btn-secondary" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => s + 1)}>
            Siguiente →
          </button>
        </div>
        {!locked && (
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => submit(false)}>
              {pending ? "Guardando…" : "Guardar borrador"}
            </button>
            <button type="button" className="btn-primary" disabled={pending} onClick={() => submit(true)}>
              Marcar como completado
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
