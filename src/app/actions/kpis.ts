"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { assertModule } from "@/lib/server/auth";
import { fail } from "@/lib/server/fail";
import { formsLockedFor } from "@/lib/server/project";
import { logActivity } from "@/lib/server/activity";
import { evidenceCounts, recomputeKpiStatus } from "@/lib/server/kpis";
import { deleteStoredFile } from "@/lib/server/storage";
import { kpiCodePrefix, nextKpiCode } from "@/lib/kpi-code";
import {
  validateKpiComplete,
  validateKpiDraft,
  validateKpiEvidence,
  type KpiFormData,
} from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";

const LOCKED = "El catálogo de sistemas aún no ha sido confirmado por el administrador (Fase 0).";
const nul = (s: string) => (s.trim() === "" ? null : s.trim());

async function allocateCode(tx: Prisma.TransactionClient, domain: string) {
  const existing = await tx.kpiCatalog.findMany({
    where: { kpiCode: { startsWith: kpiCodePrefix(domain) } },
    select: { kpiCode: true },
  });
  return nextKpiCode(domain, existing.map((e) => e.kpiCode));
}

// Módulo 2 · guarda la ficha del KPI y sus variables. Devuelve el id (se crea en el primer guardado).
export async function saveKpi(
  kpiId: string | null,
  data: KpiFormData,
  complete: boolean,
): Promise<ActionResult<{ id: string; kpiCode: string; status: string; variableIds: string[] }>> {
  try {
    const user = await assertModule("m2");
    if (await formsLockedFor(user)) return { ok: false, error: LOCKED };

    const draftErrors = validateKpiDraft(data);
    if (Object.keys(draftErrors).length)
      return { ok: false, error: "Revise los campos marcados (nombre y dominio son obligatorios incluso en borrador).", fieldErrors: draftErrors };

    const fields = {
      kpiName: data.kpiName.trim(),
      businessDomain: data.businessDomain,
      kpiObjective: nul(data.kpiObjective),
      unitOfMeasure: nul(data.unitOfMeasure),
      frequency: nul(data.frequency),
      trendDirection: nul(data.trendDirection),
      calculationFormula: nul(data.calculationFormula),
      businessRules: nul(data.businessRules),
      dimensions: Array.from(new Set(data.dimensions)),
      currentCalculationMethod: nul(data.currentCalculationMethod),
    };

    // Reintenta si dos personas crean un KPI del mismo dominio a la vez (choque de código único).
    let saved: { id: string; kpiCode: string; variableIds: string[] } | null = null;
    for (let attempt = 0; attempt < 3 && !saved; attempt++) {
      try {
        saved = await prisma.$transaction(async (tx) => {
          let kpi;
          if (kpiId) {
            const current = await tx.kpiCatalog.findUnique({ where: { id: kpiId } });
            if (!current) throw new Error("NOT_FOUND");
            // El código sigue al dominio: si cambia el dominio se reasigna (KPI-FIN-01 → KPI-COM-03).
            const kpiCode =
              current.businessDomain === fields.businessDomain ? current.kpiCode : await allocateCode(tx, fields.businessDomain);
            kpi = await tx.kpiCatalog.update({ where: { id: kpiId }, data: { ...fields, kpiCode } });
          } else {
            kpi = await tx.kpiCatalog.create({
              data: { ...fields, kpiCode: await allocateCode(tx, fields.businessDomain), createdById: user.id },
            });
          }

          // Variables: se actualizan por id para conservar el mapeo físico que haya hecho TI.
          const existing = await tx.kpiSourceVariable.findMany({ where: { kpiId: kpi.id } });
          const variableIds: string[] = [];
          const keepIds = new Set(data.variables.map((v) => v.id).filter(Boolean));
          await tx.kpiSourceVariable.deleteMany({ where: { kpiId: kpi.id, id: { notIn: [...keepIds] as string[] } } });
          for (const [position, v] of data.variables.entries()) {
            const values = {
              position,
              varName: v.varName.trim(),
              sourceSystemCode: v.sourceSystemCode || null,
              screenModuleName: v.screenModuleName.trim(),
              sampleTransactionId: v.sampleTransactionId.trim(),
              existsInOtherSystem: v.existsInOtherSystem,
              isSystemOfRecord: v.isSystemOfRecord,
            };
            const prev = v.id ? existing.find((e) => e.id === v.id) : undefined;
            if (prev) {
              // Si cambia el sistema fuente, el mapeo físico anterior deja de ser válido.
              const reset =
                prev.sourceSystemCode !== values.sourceSystemCode
                  ? {
                      physicalTableName: null,
                      physicalColumnName: null,
                      primaryKeyColumn: null,
                      incrementalDateColumn: null,
                      mappedAt: null,
                    }
                  : {};
              await tx.kpiSourceVariable.update({ where: { id: prev.id }, data: { ...values, ...reset } });
              variableIds.push(prev.id);
            } else {
              const created = await tx.kpiSourceVariable.create({ data: { ...values, kpiId: kpi.id } });
              variableIds.push(created.id);
            }
          }
          return { id: kpi.id, kpiCode: kpi.kpiCode, variableIds };
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
        if (err instanceof Error && err.message === "NOT_FOUND") return { ok: false, error: "KPI no encontrado." };
        throw err;
      }
    }
    if (!saved) return { ok: false, error: "No se pudo asignar un código al KPI. Intente nuevamente." };

    let errors: Record<string, string> = {};
    if (complete) {
      errors = {
        ...validateKpiComplete(data),
        ...validateKpiEvidence(data.currentCalculationMethod, await evidenceCounts(saved.id)),
      };
    }
    const status = (await recomputeKpiStatus(saved.id, complete ? { requestComplete: true } : {})) ?? "DRAFT";
    await logActivity(user.id, status === "DRAFT" ? "KPI_DRAFT_SAVED" : "KPI_COMPLETED", "KPI", saved.kpiCode);
    revalidatePath("/", "layout");

    const result = { ...saved, status };
    if (complete && Object.keys(errors).length)
      return {
        ok: false,
        error: "Se guardó como borrador, pero faltan campos o evidencias obligatorias para completar el KPI.",
        fieldErrors: errors,
        data: result,
      };
    return { ok: true, message: status === "DRAFT" ? "Borrador guardado." : "KPI completado.", data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteKpi(kpiId: string): Promise<ActionResult> {
  try {
    const user = await assertModule("m2");
    if (await formsLockedFor(user)) return { ok: false, error: LOCKED };
    const kpi = await prisma.kpiCatalog.findUnique({ where: { id: kpiId }, include: { attachments: true } });
    if (!kpi) return { ok: false, error: "KPI no encontrado." };
    if (user.role !== "ADMIN" && kpi.createdById !== user.id)
      return { ok: false, error: "Solo quien creó el KPI o un administrador puede eliminarlo." };
    await prisma.kpiCatalog.delete({ where: { id: kpiId } });
    await Promise.all(kpi.attachments.map((a) => deleteStoredFile(a.storagePath)));
    await logActivity(user.id, "KPI_DELETED", "KPI", kpi.kpiCode);
    revalidatePath("/", "layout");
    return { ok: true, message: "KPI eliminado." };
  } catch (err) {
    return fail(err);
  }
}
