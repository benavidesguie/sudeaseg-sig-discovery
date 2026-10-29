import "server-only";
import { prisma } from "./db";

// Selector oficial SIS-01..SIS-NN (TOTAL_SYSTEMS): ningún formulario usa texto libre para referirse a un sistema.
export async function systemOptions(): Promise<[string, string][]> {
  const systems = await prisma.systemInventory.findMany({
    orderBy: { systemCode: "asc" },
    select: { systemCode: true, officialName: true, commonName: true },
  });
  return systems.map((s) => [s.systemCode, `${s.systemCode} · ${s.officialName ?? s.commonName ?? "(sin nombre)"}`]);
}
