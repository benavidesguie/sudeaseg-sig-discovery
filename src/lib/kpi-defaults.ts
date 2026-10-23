import type { KpiFormData, KpiVariableForm } from "./validation";

export function emptyKpi(): KpiFormData {
  return {
    kpiName: "",
    businessDomain: "",
    kpiObjective: "",
    unitOfMeasure: "",
    frequency: "",
    trendDirection: "",
    calculationFormula: "",
    businessRules: "",
    dimensions: [],
    currentCalculationMethod: "",
    variables: [emptyVariable()],
  };
}

export function emptyVariable(): KpiVariableForm {
  return {
    varName: "",
    sourceSystemCode: "",
    screenModuleName: "",
    sampleTransactionId: "",
    existsInOtherSystem: false,
    isSystemOfRecord: true,
  };
}
