"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/db";
import { assertModule } from "@/lib/server/auth";
import { fail } from "@/lib/server/fail";
import { formsLockedFor } from "@/lib/server/project";
import { logActivity } from "@/lib/server/activity";
import { recomputeKpiStatus } from "@/lib/server/kpis";
import { isSystemKpiLinked } from "@/lib/server/systems";
import { isVariableMapped, validateMapping, type VariableMappingForm } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";

export type MappingInput = VariableMappingForm & { variableId: string };

const nul = (s: string) => (s.trim() === "" ? null : s.trim());

// Módulo 3 · Mesa de cruce "Follow the Data": vincula cada variable de negocio con su campo físico.
export async function saveMappings(systemCode: string, mappings: MappingInput[]): Promise<ActionResult> {
  try {
    const user = await assertModule("m3");
    if (await formsLockedFor(user))
      return { ok: false, error: "El catálogo de sistemas aún no ha sido confirmado por el administrador (Fase 0)." };
    if (!(await isSystemKpiLinked(systemCode)))
      return { ok: false, error: "Este sistema no está vinculado a ningún indicador; el mapeo técnico no está habilitado." };

    const system = await prisma.systemInventory.findUnique({ where: { systemCode } });
    if (!system) return { ok: false, error: "Sistema no encontrado." };

    const variables = await prisma.kpiSourceVariable.findMany({
      where: { id: { in: mappings.map((m) => m.variableId) }, sourceSystemCode: systemCode },
    });
    const byId = new Map(variables.map((v) => [v.id, v]));

    // Si el esquema fue cargado, las tablas y columnas deben existir en él.
    const columnsByTable = new Map<string, Set<string>>();
    if (system.phase2SchemaUploaded) {
      const tables = Array.from(new Set(mappings.map((m) => m.physicalTableName.trim()).filter(Boolean)));
      const cols = await prisma.systemRawSchema.findMany({
        where: { systemCode, tableName: { in: tables } },
        select: { tableName: true, columnName: true },
      });
      for (const c of cols) {
        if (!columnsByTable.has(c.tableName)) columnsByTable.set(c.tableName, new Set());
        columnsByTable.get(c.tableName)!.add(c.columnName);
      }
    }

    const fieldErrors: Record<string, string> = {};
    for (const m of mappings) {
      if (!byId.has(m.variableId)) return { ok: false, error: "Una de las variables no pertenece a este sistema." };
      for (const [k, msg] of Object.entries(validateMapping(m))) fieldErrors[`${m.variableId}.${k}`] = msg;
      const table = m.physicalTableName.trim();
      if (!system.phase2SchemaUploaded || !table) continue;
      const cols = columnsByTable.get(table);
      if (!cols) {
        fieldErrors[`${m.variableId}.physicalTableName`] = "La tabla no existe en el esquema cargado";
        continue;
      }
      for (const key of ["physicalColumnName", "primaryKeyColumn", "incrementalDateColumn"] as const) {
        const col = m[key].trim();
        if (col && !cols.has(col)) fieldErrors[`${m.variableId}.${key}`] = "La columna no existe en esa tabla";
      }
    }
    if (Object.keys(fieldErrors).length) return { ok: false, error: "Revise los campos marcados.", fieldErrors };

    const now = new Date();
    await prisma.$transaction(
      mappings.map((m) => {
        const data = {
          physicalTableName: nul(m.physicalTableName),
          physicalColumnName: nul(m.physicalColumnName),
          primaryKeyColumn: nul(m.primaryKeyColumn),
          incrementalDateColumn: nul(m.incrementalDateColumn),
          transformationRule: nul(m.transformationRule),
        };
        return prisma.kpiSourceVariable.update({
          where: { id: m.variableId },
          data: { ...data, mappedAt: isVariableMapped(data) ? now : null },
        });
      }),
    );
    for (const kpiId of new Set(variables.map((v) => v.kpiId))) await recomputeKpiStatus(kpiId);
    await logActivity(user.id, "MAPPING_SAVED", "SYSTEM", systemCode, `${mappings.length} variables`);
    revalidatePath("/", "layout");
    return { ok: true, message: "Mapeo guardado." };
  } catch (err) {
    return fail(err);
  }
}
