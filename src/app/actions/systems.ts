"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { assertModule } from "@/lib/server/auth";
import { fail } from "@/lib/server/fail";
import { formsLockedFor } from "@/lib/server/project";
import { logActivity } from "@/lib/server/activity";
import { recomputeSystemDerived } from "@/lib/server/systems";
import { systemFieldScope } from "@/lib/permissions";
import { mergeByScope, systemFormToRecord, toSystemForm } from "@/lib/system-form";
import {
  validateConnectivityComplete,
  validateConnectivityDraft,
  validateSystemComplete,
  validateSystemDraft,
  type ConnectivityFormData,
  type SystemFormData,
} from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";

const LOCKED = "El catálogo de sistemas aún no ha sido confirmado por el administrador (Fase 0).";

// Módulo 1 · guarda la ficha. complete=true exige todos los campos obligatorios.
export async function saveSystem(
  systemCode: string,
  submitted: SystemFormData,
  complete: boolean,
): Promise<ActionResult<{ status: string }>> {
  try {
    const user = await assertModule("m1");
    if (await formsLockedFor(user)) return { ok: false, error: LOCKED };
    const current = await prisma.systemInventory.findUnique({ where: { systemCode } });
    if (!current) return { ok: false, error: "Sistema no encontrado." };

    const data = mergeByScope(toSystemForm(current), submitted, systemFieldScope(user.role));
    const draftErrors = validateSystemDraft(data);
    if (Object.keys(draftErrors).length)
      return { ok: false, error: "Hay campos con formato inválido.", fieldErrors: draftErrors };

    const completeErrors = validateSystemComplete(data);
    const isComplete = Object.keys(completeErrors).length === 0;

    // Un borrador sobre una ficha ya completada la mantiene completada solo si sigue siendo válida.
    // Si se pidió completar y faltan campos, se guarda igualmente como borrador para no perder lo cargado.
    const status = isComplete && (complete || current.phase1Status === "COMPLETED") ? "COMPLETED" : "DRAFT";
    const record = systemFormToRecord(data);
    await prisma.systemInventory.update({
      where: { systemCode },
      data: {
        ...record,
        businessOwner: record.businessOwner ?? Prisma.DbNull,
        techCustodian: record.techCustodian ?? Prisma.DbNull,
        vendorInfo: record.vendorInfo ?? Prisma.DbNull,
        phase1Status: status,
      },
    });
    await recomputeSystemDerived(systemCode);
    await logActivity(user.id, status === "COMPLETED" ? "SYSTEM_COMPLETED" : "SYSTEM_DRAFT_SAVED", "SYSTEM", systemCode);
    revalidatePath("/", "layout");
    if (complete && !isComplete)
      return {
        ok: false,
        error: "Se guardó como borrador, pero faltan campos obligatorios para completar la ficha (pueden pertenecer a la sección del otro rol).",
        fieldErrors: completeErrors,
      };
    return { ok: true, message: status === "COMPLETED" ? "Ficha completada." : "Borrador guardado.", data: { status } };
  } catch (err) {
    return fail(err);
  }
}

// Módulo 4 · checklist de conectividad, seguridad y volumetría.
export async function saveConnectivity(
  systemCode: string,
  data: ConnectivityFormData,
  complete: boolean,
): Promise<ActionResult<{ status: string }>> {
  try {
    const user = await assertModule("m4");
    if (await formsLockedFor(user)) return { ok: false, error: LOCKED };
    const current = await prisma.systemInventory.findUnique({ where: { systemCode } });
    if (!current) return { ok: false, error: "Sistema no encontrado." };

    const draftErrors = validateConnectivityDraft(data);
    if (Object.keys(draftErrors).length)
      return { ok: false, error: "Hay campos con formato inválido.", fieldErrors: draftErrors };
    const completeErrors = validateConnectivityComplete(data);
    const isComplete = Object.keys(completeErrors).length === 0;
    const status = isComplete && (complete || current.phase3Status === "COMPLETED") ? "COMPLETED" : "DRAFT";
    await prisma.systemInventory.update({
      where: { systemCode },
      data: {
        integrationPattern: data.integrationPattern || null,
        networkRequirements: Array.from(new Set(data.networkRequirements)),
        supportsIncrementalLoad: data.supportsIncrementalLoad,
        historicalVolumeEstimate: data.historicalVolumeEstimate || null,
        extractionWindow: data.extractionWindow.trim() || null,
        phase3Status: status,
      },
    });
    await recomputeSystemDerived(systemCode);
    await logActivity(user.id, status === "COMPLETED" ? "CONNECTIVITY_COMPLETED" : "CONNECTIVITY_DRAFT_SAVED", "SYSTEM", systemCode);
    revalidatePath("/", "layout");
    if (complete && !isComplete)
      return { ok: false, error: "Se guardó como borrador, pero faltan campos obligatorios.", fieldErrors: completeErrors };
    return { ok: true, message: status === "COMPLETED" ? "Checklist completado." : "Borrador guardado.", data: { status } };
  } catch (err) {
    return fail(err);
  }
}
