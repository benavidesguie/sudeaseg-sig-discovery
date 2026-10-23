import { DOMAIN_PREFIX } from "./catalogs";

// Genera el siguiente código KPI-<DOM>-NN para un dominio, dado el conjunto de códigos existentes.
export function nextKpiCode(domain: string, existingCodes: string[]): string {
  const prefix = `KPI-${DOMAIN_PREFIX[domain] ?? "GEN"}-`;
  let max = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue;
    const n = Number(code.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

export function kpiCodePrefix(domain: string) {
  return `KPI-${DOMAIN_PREFIX[domain] ?? "GEN"}-`;
}
