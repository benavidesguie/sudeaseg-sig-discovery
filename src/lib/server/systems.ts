import "server-only";
import { prisma } from "./db";
import { computeWave } from "../waves";

// Recalcula los campos derivados del sistema (oleada sugerida y alerta de proveedor).
export async function recomputeSystemDerived(systemCode: string) {
  const s = await prisma.systemInventory.findUnique({
    where: { systemCode },
    select: { kpiCriticality: true, accessLevel: true, integrationPattern: true },
  });
  if (!s) return;
  await prisma.systemInventory.update({
    where: { systemCode },
    data: {
      waveNumber: computeWave(s),
      vendorRiskAlert: s.accessLevel === "RESTRICTED_VENDOR",
    },
  });
}

// Regla de prelación KPI-Driven Discovery: sistemas vinculados al menos a un KPI.
export async function kpiLinkedSystemCodes(): Promise<Set<string>> {
  const rows = await prisma.kpiSourceVariable.findMany({
    where: { sourceSystemCode: { not: null } },
    select: { sourceSystemCode: true },
    distinct: ["sourceSystemCode"],
  });
  return new Set(rows.map((r) => r.sourceSystemCode!));
}

export async function isSystemKpiLinked(systemCode: string) {
  const n = await prisma.kpiSourceVariable.count({ where: { sourceSystemCode: systemCode } });
  return n > 0;
}
