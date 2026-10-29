import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateKpiComplete,
  validateKpiDraft,
  validateKpiEvidence,
  validateMasterRows,
  validateSystemComplete,
  validateSystemDraft,
  type KpiFormData,
  type SystemFormData,
} from "./validation";
import { mergeByScope, systemFormToRecord } from "./system-form";
import { nextKpiCode } from "./kpi-code";

const contact = { name: "Ana", role: "Gerente", email: "ana@example.com", phone: "123" };

function system(overrides: Partial<SystemFormData> = {}): SystemFormData {
  return {
    officialName: "ERP",
    internalAlias: "",
    version: "",
    businessDomain: "FINANZAS",
    userDepartments: ["Contabilidad"],
    activeUsersRange: "11-50",
    kpiCriticality: "ALTA",
    businessOwner: contact,
    techCustodian: contact,
    solutionType: "ERP",
    accessLevel: "DB_ONLY",
    vendorInfo: { vendor_name: "", vendor_contact_email: "", has_active_support_contract: null, requires_extra_fee: "" },
    hostingType: "ON_PREMISE",
    dbEngine: "SQL_SERVER",
    techStack: "",
    docStatus: ["NONE"],
    ...overrides,
  };
}

test("ficha de sistema completa no tiene errores", () => {
  assert.deepEqual(validateSystemComplete(system()), {});
});

test("borrador acepta campos vacíos pero valida formato", () => {
  const empty = system({ officialName: "", businessDomain: "", docStatus: [], userDepartments: [] });
  assert.deepEqual(validateSystemDraft(empty), {});
  const badEmail = system({ businessOwner: { ...contact, email: "no-es-correo" } });
  assert.ok(validateSystemDraft(badEmail)["businessOwner.email"]);
});

test("RESTRICTED_VENDOR exige vendor_info", () => {
  const errs = validateSystemComplete(system({ accessLevel: "RESTRICTED_VENDOR" }));
  assert.ok(errs["vendorInfo.vendor_name"]);
  assert.ok(errs["vendorInfo.vendor_contact_email"]);
  assert.ok(errs["vendorInfo.has_active_support_contract"]);
  assert.ok(errs["vendorInfo.requires_extra_fee"]);

  const ok = system({
    accessLevel: "RESTRICTED_VENDOR",
    vendorInfo: { vendor_name: "Prov", vendor_contact_email: "p@x.com", has_active_support_contract: false, requires_extra_fee: "SI" },
  });
  assert.deepEqual(validateSystemComplete(ok), {});
  assert.equal(systemFormToRecord(ok).vendorRiskAlert, true);
  assert.equal(systemFormToRecord(system()).vendorInfo, null, "vendor_info solo se guarda con acceso restringido");
});

test("'Sin documentación' es excluyente", () => {
  assert.ok(validateSystemComplete(system({ docStatus: ["NONE", "MER_AVAILABLE"] })).docStatus);
});

test("cada rol solo modifica su sección del Módulo 1", () => {
  const current = system();
  const submitted = system({ officialName: "Cambiado", dbEngine: "ORACLE" });
  const asBusiness = mergeByScope(current, submitted, "business");
  assert.equal(asBusiness.officialName, "Cambiado");
  assert.equal(asBusiness.dbEngine, "SQL_SERVER");
  const asTech = mergeByScope(current, submitted, "tech");
  assert.equal(asTech.officialName, "ERP");
  assert.equal(asTech.dbEngine, "ORACLE");
});

function kpi(overrides: Partial<KpiFormData> = {}): KpiFormData {
  return {
    kpiName: "Cumplimiento",
    businessDomain: "FINANZAS",
    kpiObjective: "Decidir",
    unitOfMeasure: "PERCENTAGE",
    frequency: "MONTHLY",
    trendDirection: "UP_IS_BETTER",
    calculationFormula: "a / b",
    businessRules: "Sin anuladas",
    dimensions: ["TIEMPO"],
    currentCalculationMethod: "NATIVE_REPORT",
    variables: [
      { varName: "Ventas", sourceSystemCode: "SIS-01", screenModuleName: "Ventas", sampleTransactionId: "FAC-1", existsInOtherSystem: false, isSystemOfRecord: true },
    ],
    ...overrides,
  };
}

test("KPI: el borrador exige nombre y dominio; completar exige todo", () => {
  assert.deepEqual(validateKpiComplete(kpi()), {});
  assert.ok(validateKpiDraft(kpi({ kpiName: "" })).kpiName);
  assert.deepEqual(validateKpiDraft(kpi({ kpiObjective: "", variables: [] })), {});
  const errs = validateKpiComplete(kpi({ variables: [] }));
  assert.ok(errs.variables);
  const varErrs = validateKpiComplete(kpi({ variables: [{ ...kpi().variables[0], sourceSystemCode: "", sampleTransactionId: "" }] }));
  assert.ok(varErrs["variables.0.sourceSystemCode"]);
  assert.ok(varErrs["variables.0.sampleTransactionId"]);
  assert.ok(validateKpiDraft(kpi({ variables: [{ ...kpi().variables[0], sourceSystemCode: "SIS-99" }] }))["variables.0.sourceSystemCode"]);
});

test("KPI: el Excel es obligatorio solo para cruce manual", () => {
  const noFiles = { excel: 0, transaction: 0, report: 0 };
  assert.ok(validateKpiEvidence("MANUAL_EXCEL_CROSSING", noFiles)["evidence.excel"]);
  assert.equal(validateKpiEvidence("NATIVE_REPORT", noFiles)["evidence.excel"], undefined);
  assert.deepEqual(validateKpiEvidence("NATIVE_REPORT", { excel: 0, transaction: 1, report: 1 }), {});
});

test("código KPI autogenerado por dominio", () => {
  assert.equal(nextKpiCode("FINANZAS", []), "KPI-FIN-01");
  assert.equal(nextKpiCode("FINANZAS", ["KPI-FIN-01", "KPI-FIN-07", "KPI-COM-09"]), "KPI-FIN-08");
  assert.equal(nextKpiCode("ATENCION_CLIENTE", ["KPI-FIN-01"]), "KPI-ATC-01");
});

test("homologación: códigos canónicos únicos y obligatorios", () => {
  const errs = validateMasterRows([
    { canonicalCode: "CCS", canonicalName: "Caracas", systemEquivalences: { "SIS-01": "001" } },
    { canonicalCode: "ccs", canonicalName: "Otra", systemEquivalences: {} },
    { canonicalCode: "", canonicalName: "", systemEquivalences: {} },
  ]);
  assert.ok(errs["1.canonicalCode"]);
  assert.ok(errs["2.canonicalCode"]);
  assert.ok(errs["2.canonicalName"]);
  const unknown = validateMasterRows([{ canonicalCode: "X", canonicalName: "Y", systemEquivalences: { "SIS-77": "1" } }]);
  assert.ok(Object.keys(unknown).length > 0, "rechaza códigos de sistema fuera del catálogo");
});
