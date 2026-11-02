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
    responsibleArea: "",
    indicatorType: "",
    indicatorLevel: "",
    targetValue: "",
    dataSource: "",
    strategicObjectives: "",
    inManagementPlan: false,
    observations: "",
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
