import "server-only";
import { prisma } from "./db";
import { isVariableMapped, validateKpiComplete, validateKpiEvidence, type KpiFormData } from "../validation";

export async function evidenceCounts(kpiId: string) {
  const groups = await prisma.attachment.groupBy({ by: ["kind"], where: { kpiId }, _count: true });
  const count = (k: string) => groups.find((g) => g.kind === k)?._count ?? 0;
  return {
    excel: count("KPI_EXCEL"),
    transaction: count("KPI_SCREENSHOT_TRANSACTION"),
    report: count("KPI_SCREENSHOT_REPORT"),
  };
}

export function kpiToForm(k: {
  kpiName: string;
  businessDomain: string;
  kpiObjective: string | null;
  unitOfMeasure: string | null;
  frequency: string | null;
  trendDirection: string | null;
  calculationFormula: string | null;
  businessRules: string | null;
  dimensions: unknown;
  currentCalculationMethod: string | null;
  variables: {
    id: string;
    varName: string;
    sourceSystemCode: string | null;
    screenModuleName: string;
    sampleTransactionId: string;
    existsInOtherSystem: boolean;
    isSystemOfRecord: boolean;
  }[];
}): KpiFormData {
  return {
    kpiName: k.kpiName,
    businessDomain: k.businessDomain,
    kpiObjective: k.kpiObjective ?? "",
    unitOfMeasure: k.unitOfMeasure ?? "",
    frequency: k.frequency ?? "",
    trendDirection: k.trendDirection ?? "",
    calculationFormula: k.calculationFormula ?? "",
    businessRules: k.businessRules ?? "",
    dimensions: Array.isArray(k.dimensions) ? (k.dimensions as string[]) : [],
    currentCalculationMethod: k.currentCalculationMethod ?? "",
    variables: k.variables.map((v) => ({
      id: v.id,
      varName: v.varName,
      sourceSystemCode: v.sourceSystemCode ?? "",
      screenModuleName: v.screenModuleName,
      sampleTransactionId: v.sampleTransactionId,
      existsInOtherSystem: v.existsInOtherSystem,
      isSystemOfRecord: v.isSystemOfRecord,
    })),
  };
}

// Estado del KPI: DRAFT → BUSINESS_COMPLETED (negocio completo + evidencias) → TECH_MAPPED
// (todas las variables mapeadas a tabla/columna/PK). Si una ficha completada se edita y
// deja de cumplir, vuelve al estado que corresponda.
export async function recomputeKpiStatus(kpiId: string, opts: { requestComplete?: boolean } = {}) {
  const kpi = await prisma.kpiCatalog.findUnique({ where: { id: kpiId }, include: { variables: true } });
  if (!kpi) return null;
  const wantsComplete = opts.requestComplete ?? kpi.status !== "DRAFT";
  let status = "DRAFT";
  if (wantsComplete) {
    const form = kpiToForm(kpi);
    const businessOk =
      Object.keys(validateKpiComplete(form)).length === 0 &&
      Object.keys(validateKpiEvidence(kpi.currentCalculationMethod, await evidenceCounts(kpiId))).length === 0;
    if (businessOk) {
      status = kpi.variables.length > 0 && kpi.variables.every(isVariableMapped) ? "TECH_MAPPED" : "BUSINESS_COMPLETED";
    }
  }
  if (status !== kpi.status) await prisma.kpiCatalog.update({ where: { id: kpiId }, data: { status } });
  return status;
}
