// Algoritmo de clasificación automática de oleadas (PRD §6).
//
// Orden de evaluación:
//   1. Oleada 3 si la criticidad es BAJA o el patrón de integración es Tipo D
//      (captura manual controlada). Tiene precedencia porque el PRD la define con
//      "o", y un sistema que se alimentará por plantilla manual no es un quick win
//      aunque sea crítico.
//   2. Oleada 1 si la criticidad es ALTA y el acceso es directo (TOTAL, DB_ONLY, API_ONLY).
//   3. Oleada 2 si la criticidad es ALTA con acceso restringido o solo exportación
//      manual (requiere gestión de proveedor / destrabar acceso), o criticidad MEDIA
//      con acceso directo.
//   4. Oleada 3 para el resto (criticidad MEDIA con acceso restringido o manual):
//      casos no cubiertos explícitamente por el PRD.
// Devuelve null si faltan la criticidad o el nivel de acceso.

export const DIRECT_ACCESS = ["TOTAL", "DB_ONLY", "API_ONLY"];

export type WaveInput = {
  kpiCriticality?: string | null;
  accessLevel?: string | null;
  integrationPattern?: string | null;
};

export function computeWave({ kpiCriticality, accessLevel, integrationPattern }: WaveInput): 1 | 2 | 3 | null {
  if (kpiCriticality === "BAJA" || integrationPattern === "TYPE_D_CONTROLLED_MANUAL") return 3;
  if (!kpiCriticality || !accessLevel) return null;

  const direct = DIRECT_ACCESS.includes(accessLevel);
  if (kpiCriticality === "ALTA") return direct ? 1 : 2;
  if (kpiCriticality === "MEDIA") return direct ? 2 : 3;
  return null;
}

export const WAVE_LABELS: Record<number, string> = {
  1: "Oleada 1 · Quick Wins",
  2: "Oleada 2 · Esfuerzo medio",
  3: "Oleada 3 · Baja prioridad / Tipo D",
};
