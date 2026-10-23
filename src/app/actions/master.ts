"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/db";
import { assertModule } from "@/lib/server/auth";
import { fail } from "@/lib/server/fail";
import { formsLockedFor } from "@/lib/server/project";
import { logActivity } from "@/lib/server/activity";
import { MASTER_ENTITY_VALUES } from "@/lib/catalogs";
import { validateMasterRows, type MasterRowForm } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";

// Módulo 5 · guarda la grilla completa de una entidad maestra.
export async function saveMasterRows(entity: string, rows: MasterRowForm[]): Promise<ActionResult> {
  try {
    const user = await assertModule("m5");
    if (await formsLockedFor(user))
      return { ok: false, error: "El catálogo de sistemas aún no ha sido confirmado por el administrador (Fase 0)." };
    if (!MASTER_ENTITY_VALUES.includes(entity as never)) return { ok: false, error: "Entidad maestra no válida." };

    // Las filas totalmente vacías se descartan; se recuerda el índice original para reportar errores.
    const indexed = rows
      .map((r, index) => ({
        index,
        canonicalCode: r.canonicalCode.trim(),
        canonicalName: r.canonicalName.trim(),
        systemEquivalences: Object.fromEntries(
          Object.entries(r.systemEquivalences)
            .map(([k, v]) => [k, v.trim()])
            .filter(([, v]) => v),
        ),
      }))
      .filter((r) => r.canonicalCode || r.canonicalName || Object.keys(r.systemEquivalences).length);
    const cleaned = indexed.map(({ index: _index, ...r }) => r);

    const errors = validateMasterRows(cleaned);
    if (Object.keys(errors).length) {
      const fieldErrors = Object.fromEntries(
        Object.entries(errors).map(([key, msg]) => {
          const [i, ...rest] = key.split(".");
          return [[indexed[Number(i)]?.index ?? i, ...rest].join("."), msg];
        }),
      );
      return { ok: false, error: "Revise las filas marcadas.", fieldErrors };
    }

    // Se reemplaza la grilla completa: evita choques de la clave única al renombrar códigos.
    await prisma.$transaction([
      prisma.masterDataMapping.deleteMany({ where: { masterEntity: entity } }),
      prisma.masterDataMapping.createMany({
        data: cleaned.map((r, position) => ({ ...r, masterEntity: entity, position })),
      }),
    ]);
    await logActivity(user.id, "MASTER_SAVED", "MASTER", entity, `${cleaned.length} filas`);
    revalidatePath("/homologacion");
    return { ok: true, message: `${cleaned.length} filas guardadas.` };
  } catch (err) {
    return fail(err);
  }
}
