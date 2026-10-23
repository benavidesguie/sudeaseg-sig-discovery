// Reglas de validación compartidas entre el navegador y el servidor.
// "Borrador" solo exige formato; "Completado" exige todos los campos obligatorios del PRD.

import { z } from "zod";
import * as C from "./catalogs";

export type FieldErrors = Record<string, string>;

const REQUIRED = "Campo obligatorio";

function collect(result: z.SafeParseReturnType<unknown, unknown>): FieldErrors {
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);
const optText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), text(max).nullable().optional());
const reqText = (max: number) => text(max).min(1, REQUIRED);
const optEnum = (vals: [string, ...string[]]) =>
  z.preprocess((v) => (v === "" ? null : v), z.enum(vals, { message: "Valor no válido" }).nullable().optional());
const reqEnum = (vals: [string, ...string[]]) =>
  z.preprocess((v) => (v === null || v === undefined ? "" : v), z.enum(vals, { message: REQUIRED }));
const enumList = (vals: [string, ...string[]]) => z.array(z.enum(vals, { message: "Valor no válido" }));
const optEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().email("Correo no válido").nullable().optional(),
);

// ---------------------------------------------------------------------------
// Módulo 1 · Ficha de inventario de sistema
// ---------------------------------------------------------------------------

export type Contact = { name: string; role: string; email: string; phone: string };
export type VendorInfo = {
  vendor_name: string;
  vendor_contact_email: string;
  has_active_support_contract: boolean | null;
  requires_extra_fee: string;
};

export type SystemFormData = {
  officialName: string;
  internalAlias: string;
  version: string;
  businessDomain: string;
  userDepartments: string[];
  activeUsersRange: string;
  kpiCriticality: string;
  businessOwner: Contact;
  techCustodian: Contact;
  solutionType: string;
  accessLevel: string;
  vendorInfo: VendorInfo;
  hostingType: string;
  dbEngine: string;
  techStack: string;
  docStatus: string[];
};

// Qué rol es dueño de cada campo del Módulo 1 (PRD §3: sección funcional vs. técnica).
export const SYSTEM_BUSINESS_FIELDS = [
  "officialName",
  "internalAlias",
  "version",
  "businessDomain",
  "userDepartments",
  "activeUsersRange",
  "kpiCriticality",
  "businessOwner",
] as const;
export const SYSTEM_TECH_FIELDS = [
  "techCustodian",
  "solutionType",
  "accessLevel",
  "vendorInfo",
  "hostingType",
  "dbEngine",
  "techStack",
  "docStatus",
] as const;

const contactDraft = z.object({
  name: optText(150),
  role: optText(150),
  email: optEmail,
  phone: optText(50),
});
const contactComplete = z.object({
  name: reqText(150),
  role: reqText(150),
  email: z.string().trim().min(1, REQUIRED).email("Correo no válido"),
  phone: reqText(50),
});

const systemDraftSchema = z.object({
  officialName: optText(150),
  internalAlias: optText(150),
  version: optText(50),
  businessDomain: optEnum(C.BUSINESS_DOMAIN_VALUES),
  userDepartments: z.array(text(80)).max(50),
  activeUsersRange: optEnum(C.ACTIVE_USERS_RANGE_VALUES),
  kpiCriticality: optEnum(C.KPI_CRITICALITY_VALUES),
  businessOwner: contactDraft,
  techCustodian: contactDraft,
  solutionType: optEnum(C.SOLUTION_TYPE_VALUES),
  accessLevel: optEnum(C.ACCESS_LEVEL_VALUES),
  vendorInfo: z.object({
    vendor_name: optText(150),
    vendor_contact_email: optEmail,
    has_active_support_contract: z.boolean().nullable(),
    requires_extra_fee: optEnum(C.EXTRA_FEE_VALUES),
  }),
  hostingType: optEnum(C.HOSTING_TYPE_VALUES),
  dbEngine: optEnum(C.DB_ENGINE_VALUES),
  techStack: optText(100),
  docStatus: enumList(C.DOC_STATUS_VALUES),
});

const systemCompleteSchema = z
  .object({
    officialName: reqText(150),
    internalAlias: optText(150),
    version: optText(50),
    businessDomain: reqEnum(C.BUSINESS_DOMAIN_VALUES),
    userDepartments: z.array(text(80)).min(1, "Indique al menos un departamento"),
    activeUsersRange: reqEnum(C.ACTIVE_USERS_RANGE_VALUES),
    kpiCriticality: reqEnum(C.KPI_CRITICALITY_VALUES),
    businessOwner: contactComplete,
    techCustodian: contactComplete,
    solutionType: reqEnum(C.SOLUTION_TYPE_VALUES),
    accessLevel: reqEnum(C.ACCESS_LEVEL_VALUES),
    vendorInfo: z.any(),
    hostingType: reqEnum(C.HOSTING_TYPE_VALUES),
    dbEngine: reqEnum(C.DB_ENGINE_VALUES),
    techStack: optText(100),
    docStatus: enumList(C.DOC_STATUS_VALUES).min(1, "Seleccione al menos una opción"),
  })
  .superRefine((d, ctx) => {
    if (d.docStatus.includes("NONE") && d.docStatus.length > 1) {
      ctx.addIssue({ code: "custom", path: ["docStatus"], message: "\"Sin documentación\" no puede combinarse con otras opciones" });
    }
    if (d.accessLevel === "RESTRICTED_VENDOR") {
      const v = (d.vendorInfo ?? {}) as Partial<VendorInfo>;
      if (!v.vendor_name?.trim()) ctx.addIssue({ code: "custom", path: ["vendorInfo", "vendor_name"], message: REQUIRED });
      const email = v.vendor_contact_email?.trim() ?? "";
      if (!email) ctx.addIssue({ code: "custom", path: ["vendorInfo", "vendor_contact_email"], message: REQUIRED });
      else if (!z.string().email().safeParse(email).success)
        ctx.addIssue({ code: "custom", path: ["vendorInfo", "vendor_contact_email"], message: "Correo no válido" });
      if (typeof v.has_active_support_contract !== "boolean")
        ctx.addIssue({ code: "custom", path: ["vendorInfo", "has_active_support_contract"], message: REQUIRED });
      if (!C.EXTRA_FEE_VALUES.includes(v.requires_extra_fee as never))
        ctx.addIssue({ code: "custom", path: ["vendorInfo", "requires_extra_fee"], message: REQUIRED });
    }
  });

export function validateSystemDraft(data: SystemFormData) {
  return collect(systemDraftSchema.safeParse(data));
}
export function validateSystemComplete(data: SystemFormData) {
  return { ...collect(systemDraftSchema.safeParse(data)), ...collect(systemCompleteSchema.safeParse(data)) };
}

// ---------------------------------------------------------------------------
// Módulo 2 · KPI Canvas
// ---------------------------------------------------------------------------

export type KpiVariableForm = {
  id?: string;
  varName: string;
  sourceSystemCode: string;
  screenModuleName: string;
  sampleTransactionId: string;
  existsInOtherSystem: boolean;
  isSystemOfRecord: boolean;
};

export type KpiFormData = {
  kpiName: string;
  businessDomain: string;
  kpiObjective: string;
  unitOfMeasure: string;
  frequency: string;
  trendDirection: string;
  calculationFormula: string;
  businessRules: string;
  dimensions: string[];
  currentCalculationMethod: string;
  variables: KpiVariableForm[];
};

const variableDraft = z.object({
  id: z.string().uuid().optional(),
  varName: text(150),
  sourceSystemCode: z.preprocess((v) => (v === "" ? null : v), z.enum(C.SYSTEM_CODES as [string, ...string[]]).nullable()),
  screenModuleName: text(200),
  sampleTransactionId: text(100),
  existsInOtherSystem: z.boolean(),
  isSystemOfRecord: z.boolean(),
});
const variableComplete = variableDraft.extend({
  varName: reqText(150),
  sourceSystemCode: reqEnum(C.SYSTEM_CODES as [string, ...string[]]),
  screenModuleName: reqText(200),
  sampleTransactionId: reqText(100),
});

const kpiDraftSchema = z.object({
  kpiName: reqText(200),
  businessDomain: reqEnum(C.BUSINESS_DOMAIN_VALUES),
  kpiObjective: optText(4000),
  unitOfMeasure: optEnum(C.UNIT_OF_MEASURE_VALUES),
  frequency: optEnum(C.FREQUENCY_VALUES),
  trendDirection: optEnum(C.TREND_DIRECTION_VALUES),
  calculationFormula: optText(4000),
  businessRules: optText(4000),
  dimensions: enumList(C.DIMENSION_VALUES),
  currentCalculationMethod: optEnum(C.CALCULATION_METHOD_VALUES),
  variables: z.array(variableDraft).max(50, "Máximo 50 variables"),
});

const kpiCompleteSchema = kpiDraftSchema.extend({
  kpiObjective: reqText(4000),
  unitOfMeasure: reqEnum(C.UNIT_OF_MEASURE_VALUES),
  frequency: reqEnum(C.FREQUENCY_VALUES),
  trendDirection: reqEnum(C.TREND_DIRECTION_VALUES),
  calculationFormula: reqText(4000),
  businessRules: reqText(4000),
  dimensions: enumList(C.DIMENSION_VALUES).min(1, "Seleccione al menos una dimensión"),
  currentCalculationMethod: reqEnum(C.CALCULATION_METHOD_VALUES),
  variables: z.array(variableComplete).min(1, "Agregue al menos una variable").max(50, "Máximo 50 variables"),
});

export function validateKpiDraft(data: KpiFormData) {
  return collect(kpiDraftSchema.safeParse(data));
}
export function validateKpiComplete(data: KpiFormData) {
  return collect(kpiCompleteSchema.safeParse(data));
}

export type EvidenceCounts = { excel: number; transaction: number; report: number };

// Bloque D: evidencias obligatorias para marcar el KPI como completado.
export function validateKpiEvidence(method: string | null | undefined, ev: EvidenceCounts): FieldErrors {
  const errors: FieldErrors = {};
  if (method === "MANUAL_EXCEL_CROSSING" && ev.excel === 0)
    errors["evidence.excel"] = "Adjunte el Excel actual con fórmulas (obligatorio para cruce manual en Excel)";
  if (ev.transaction === 0) errors["evidence.transaction"] = "Adjunte la captura del registro de la transacción de ejemplo";
  if (ev.report === 0) errors["evidence.report"] = "Adjunte la captura del reporte donde se refleja el dato hoy";
  return errors;
}

export function hasCompleteEvidence(method: string | null | undefined, ev: EvidenceCounts) {
  return Object.keys(validateKpiEvidence(method, ev)).length === 0;
}

// ---------------------------------------------------------------------------
// Módulo 3 · Mesa de cruce "Follow the Data"
// ---------------------------------------------------------------------------

export type VariableMappingForm = {
  physicalTableName: string;
  physicalColumnName: string;
  primaryKeyColumn: string;
  incrementalDateColumn: string;
  transformationRule: string;
};

const mappingSchema = z.object({
  physicalTableName: optText(150),
  physicalColumnName: optText(150),
  primaryKeyColumn: optText(150),
  incrementalDateColumn: optText(150),
  transformationRule: optText(4000),
});

export function validateMapping(data: VariableMappingForm) {
  return collect(mappingSchema.safeParse(data));
}

// Una variable se considera mapeada cuando tiene tabla, columna y llave primaria.
export function isVariableMapped(v: {
  physicalTableName?: string | null;
  physicalColumnName?: string | null;
  primaryKeyColumn?: string | null;
}) {
  return Boolean(v.physicalTableName?.trim() && v.physicalColumnName?.trim() && v.primaryKeyColumn?.trim());
}

// ---------------------------------------------------------------------------
// Módulo 4 · Conectividad
// ---------------------------------------------------------------------------

export type ConnectivityFormData = {
  integrationPattern: string;
  networkRequirements: string[];
  supportsIncrementalLoad: boolean | null;
  historicalVolumeEstimate: string;
  extractionWindow: string;
};

const connectivityDraft = z.object({
  integrationPattern: optEnum(C.INTEGRATION_PATTERN_VALUES),
  networkRequirements: enumList(C.NETWORK_REQUIREMENT_VALUES),
  supportsIncrementalLoad: z.boolean().nullable(),
  historicalVolumeEstimate: optEnum(C.VOLUME_ESTIMATE_VALUES),
  extractionWindow: optText(100),
});
const connectivityComplete = connectivityDraft.extend({
  integrationPattern: reqEnum(C.INTEGRATION_PATTERN_VALUES),
  supportsIncrementalLoad: z.boolean({ message: REQUIRED }),
  extractionWindow: reqText(100),
});

export function validateConnectivityDraft(data: ConnectivityFormData) {
  return collect(connectivityDraft.safeParse(data));
}
export function validateConnectivityComplete(data: ConnectivityFormData) {
  return collect(connectivityComplete.safeParse(data));
}

// ---------------------------------------------------------------------------
// Módulo 5 · Homologación
// ---------------------------------------------------------------------------

export type MasterRowForm = {
  id?: string;
  canonicalCode: string;
  canonicalName: string;
  systemEquivalences: Record<string, string>;
};

const masterRow = z.object({
  id: z.string().uuid().optional(),
  canonicalCode: reqText(50),
  canonicalName: reqText(150),
  systemEquivalences: z.record(z.enum(C.SYSTEM_CODES as [string, ...string[]]), text(100)),
});

export function validateMasterRows(rows: MasterRowForm[]): FieldErrors {
  const errors = collect(z.array(masterRow).max(2000).safeParse(rows));
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    const code = r.canonicalCode.trim().toUpperCase();
    if (!code) return;
    if (seen.has(code)) errors[`${i}.canonicalCode`] = `Código duplicado: ${code}`;
    else seen.set(code, i);
  });
  return errors;
}
