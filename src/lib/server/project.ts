import "server-only";
import { prisma } from "./db";
import type { CurrentUser } from "./auth";

export async function getProjectSettings() {
  return prisma.projectSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export async function isCatalogConfirmed() {
  const s = await getProjectSettings();
  return Boolean(s.catalogConfirmedAt);
}

// Regla de prelación de Fase 0: los formularios solo se habilitan para usuarios
// finales cuando el admin confirmó el catálogo semilla. El admin no queda bloqueado.
export async function formsLockedFor(user: CurrentUser) {
  if (user.role === "ADMIN") return false;
  return !(await isCatalogConfirmed());
}
