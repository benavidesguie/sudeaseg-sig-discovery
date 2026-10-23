// Conversión entre el registro de BD del sistema y el estado del formulario del Módulo 1.
// Sin dependencias de servidor para poder usarse en componentes cliente y en pruebas.

import type { Contact, SystemFormData, VendorInfo, ConnectivityFormData } from "./validation";
import { SYSTEM_BUSINESS_FIELDS, SYSTEM_TECH_FIELDS } from "./validation";

type JsonValue = unknown;

export type SystemRecordLike = {
  officialName: string | null;
  internalAlias: string | null;
  version: string | null;
  businessDomain: string | null;
  userDepartments: JsonValue;
  activeUsersRange: string | null;
  kpiCriticality: string | null;
  businessOwner: JsonValue;
  techCustodian: JsonValue;
  solutionType: string | null;
  accessLevel: string | null;
  vendorInfo: JsonValue;
  hostingType: string | null;
  dbEngine: string | null;
  techStack: string | null;
  docStatus: JsonValue;
};

export const emptyContact = (): Contact => ({ name: "", role: "", email: "", phone: "" });
export const emptyVendor = (): VendorInfo => ({
  vendor_name: "",
  vendor_contact_email: "",
  has_active_support_contract: null,
  requires_extra_fee: "",
});

function asStringArray(v: JsonValue): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asContact(v: JsonValue): Contact {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  return { name: s("name"), role: s("role"), email: s("email"), phone: s("phone") };
}

function asVendor(v: JsonValue): VendorInfo {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    vendor_name: typeof o.vendor_name === "string" ? o.vendor_name : "",
    vendor_contact_email: typeof o.vendor_contact_email === "string" ? o.vendor_contact_email : "",
    has_active_support_contract:
      typeof o.has_active_support_contract === "boolean" ? o.has_active_support_contract : null,
    requires_extra_fee: typeof o.requires_extra_fee === "string" ? o.requires_extra_fee : "",
  };
}

export function toSystemForm(r: SystemRecordLike): SystemFormData {
  return {
    officialName: r.officialName ?? "",
    internalAlias: r.internalAlias ?? "",
    version: r.version ?? "",
    businessDomain: r.businessDomain ?? "",
    userDepartments: asStringArray(r.userDepartments),
    activeUsersRange: r.activeUsersRange ?? "",
    kpiCriticality: r.kpiCriticality ?? "",
    businessOwner: asContact(r.businessOwner),
    techCustodian: asContact(r.techCustodian),
    solutionType: r.solutionType ?? "",
    accessLevel: r.accessLevel ?? "",
    vendorInfo: asVendor(r.vendorInfo),
    hostingType: r.hostingType ?? "",
    dbEngine: r.dbEngine ?? "",
    techStack: r.techStack ?? "",
    docStatus: asStringArray(r.docStatus),
  };
}

// Toma del formulario enviado solo los campos que el rol puede editar y conserva
// los demás desde el registro actual. Así el servidor nunca acepta cambios fuera de alcance.
export function mergeByScope(
  current: SystemFormData,
  submitted: SystemFormData,
  scope: "all" | "business" | "tech",
): SystemFormData {
  if (scope === "all") return submitted;
  const allowed: readonly string[] = scope === "business" ? SYSTEM_BUSINESS_FIELDS : SYSTEM_TECH_FIELDS;
  const merged = { ...current } as Record<string, unknown>;
  for (const key of allowed) merged[key] = (submitted as Record<string, unknown>)[key];
  return merged as SystemFormData;
}

const nul = (s: string) => (s.trim() === "" ? null : s.trim());

function cleanContact(c: Contact) {
  const out = { name: c.name.trim(), role: c.role.trim(), email: c.email.trim(), phone: c.phone.trim() };
  return Object.values(out).some(Boolean) ? out : null;
}

// Valores listos para persistir. vendor_info solo se guarda si el acceso es RESTRICTED_VENDOR.
export function systemFormToRecord(d: SystemFormData) {
  const restricted = d.accessLevel === "RESTRICTED_VENDOR";
  return {
    officialName: nul(d.officialName),
    internalAlias: nul(d.internalAlias),
    version: nul(d.version),
    businessDomain: nul(d.businessDomain),
    userDepartments: Array.from(new Set(d.userDepartments.map((x) => x.trim()).filter(Boolean))),
    activeUsersRange: nul(d.activeUsersRange),
    kpiCriticality: nul(d.kpiCriticality),
    businessOwner: cleanContact(d.businessOwner),
    techCustodian: cleanContact(d.techCustodian),
    solutionType: nul(d.solutionType),
    accessLevel: nul(d.accessLevel),
    vendorInfo: restricted
      ? {
          vendor_name: d.vendorInfo.vendor_name.trim(),
          vendor_contact_email: d.vendorInfo.vendor_contact_email.trim(),
          has_active_support_contract: d.vendorInfo.has_active_support_contract,
          requires_extra_fee: d.vendorInfo.requires_extra_fee || null,
        }
      : null,
    hostingType: nul(d.hostingType),
    dbEngine: nul(d.dbEngine),
    techStack: nul(d.techStack),
    docStatus: Array.from(new Set(d.docStatus)),
    vendorRiskAlert: restricted,
  };
}

export type ConnectivityRecordLike = {
  integrationPattern: string | null;
  networkRequirements: JsonValue;
  supportsIncrementalLoad: boolean | null;
  historicalVolumeEstimate: string | null;
  extractionWindow: string | null;
};

export function toConnectivityForm(r: ConnectivityRecordLike): ConnectivityFormData {
  return {
    integrationPattern: r.integrationPattern ?? "",
    networkRequirements: asStringArray(r.networkRequirements),
    supportsIncrementalLoad: r.supportsIncrementalLoad,
    historicalVolumeEstimate: r.historicalVolumeEstimate ?? "",
    extractionWindow: r.extractionWindow ?? "",
  };
}
