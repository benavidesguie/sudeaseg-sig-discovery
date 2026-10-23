import "server-only";
import { prisma } from "./db";

export async function logActivity(
  actorId: string | null,
  action: string,
  entity: string,
  entityRef: string,
  detail?: string,
) {
  try {
    await prisma.activityLog.create({ data: { actorId, action, entity, entityRef, detail } });
  } catch (err) {
    // La bitácora nunca debe impedir la operación principal.
    console.error("No se pudo registrar actividad", err);
  }
}
