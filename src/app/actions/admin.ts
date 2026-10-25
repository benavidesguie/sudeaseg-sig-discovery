"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/db";
import { assertModule } from "@/lib/server/auth";
import { fail } from "@/lib/server/fail";
import { logActivity } from "@/lib/server/activity";
import { SYSTEM_CODES, TOTAL_SYSTEMS } from "@/lib/catalogs";
import type { ActionResult } from "@/lib/action-result";

// ---------------------------------------------------------------------------
// Fase 0 · Catálogo semilla
// ---------------------------------------------------------------------------

export type CatalogRow = { systemCode: string; commonName: string; spocBusinessId: string; spocTechId: string };

const catalogSchema = z.array(
  z.object({
    systemCode: z.enum(SYSTEM_CODES as [string, ...string[]]),
    commonName: z.string().trim().max(150),
    spocBusinessId: z.string(),
    spocTechId: z.string(),
  }),
);

export async function saveCatalog(rows: CatalogRow[]): Promise<ActionResult> {
  try {
    const user = await assertModule("admin");
    const parsed = catalogSchema.safeParse(rows);
    if (!parsed.success) return { ok: false, error: "Datos del catálogo no válidos." };

    const ids = new Set(parsed.data.flatMap((r) => [r.spocBusinessId, r.spocTechId]).filter(Boolean));
    const users = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, role: true } });
    const roleOf = new Map(users.map((u) => [u.id, u.role]));
    const fieldErrors: Record<string, string> = {};
    parsed.data.forEach((r, i) => {
      if (r.spocBusinessId && !["BUSINESS", "ADMIN"].includes(roleOf.get(r.spocBusinessId) ?? ""))
        fieldErrors[`${i}.spocBusinessId`] = "Debe ser un usuario de negocio";
      if (r.spocTechId && !["TECH", "ADMIN"].includes(roleOf.get(r.spocTechId) ?? ""))
        fieldErrors[`${i}.spocTechId`] = "Debe ser un usuario técnico";
    });
    if (Object.keys(fieldErrors).length) return { ok: false, error: "Revise los responsables asignados.", fieldErrors };

    await prisma.$transaction(
      parsed.data.map((r) =>
        prisma.systemInventory.upsert({
          where: { systemCode: r.systemCode },
          update: {
            commonName: r.commonName || null,
            spocBusinessId: r.spocBusinessId || null,
            spocTechId: r.spocTechId || null,
          },
          create: {
            systemCode: r.systemCode,
            commonName: r.commonName || null,
            spocBusinessId: r.spocBusinessId || null,
            spocTechId: r.spocTechId || null,
          },
        }),
      ),
    );
    await logActivity(user.id, "CATALOG_SAVED", "CATALOG", "SIS-01..22");
    revalidatePath("/", "layout");
    return { ok: true, message: "Catálogo guardado." };
  } catch (err) {
    return fail(err);
  }
}

export async function confirmCatalog(): Promise<ActionResult> {
  try {
    const user = await assertModule("admin");
    const systems = await prisma.systemInventory.findMany({ orderBy: { systemCode: "asc" } });
    const incomplete = SYSTEM_CODES.filter((code) => {
      const s = systems.find((x) => x.systemCode === code);
      return !s || !s.commonName || !s.spocBusinessId || !s.spocTechId;
    });
    if (systems.length < TOTAL_SYSTEMS || incomplete.length)
      return {
        ok: false,
        error: `Para confirmar, los ${TOTAL_SYSTEMS} sistemas deben tener nombre común y responsable funcional y técnico. Pendientes: ${incomplete.join(", ")}.`,
      };
    await prisma.projectSettings.upsert({
      where: { id: 1 },
      update: { catalogConfirmedAt: new Date(), catalogConfirmedBy: user.name },
      create: { id: 1, catalogConfirmedAt: new Date(), catalogConfirmedBy: user.name },
    });
    await logActivity(user.id, "CATALOG_CONFIRMED", "CATALOG", "SIS-01..22");
    revalidatePath("/", "layout");
    return { ok: true, message: "Catálogo confirmado. Los formularios quedan habilitados para todos los roles." };
  } catch (err) {
    return fail(err);
  }
}

export async function reopenCatalog(): Promise<ActionResult> {
  try {
    const user = await assertModule("admin");
    await prisma.projectSettings.upsert({
      where: { id: 1 },
      update: { catalogConfirmedAt: null, catalogConfirmedBy: null },
      create: { id: 1 },
    });
    await logActivity(user.id, "CATALOG_REOPENED", "CATALOG", "SIS-01..22");
    revalidatePath("/", "layout");
    return { ok: true, message: "Catálogo reabierto. Los formularios quedan bloqueados para usuarios finales." };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

const userSchema = z.object({
  name: z.string().trim().min(1, "Campo obligatorio").max(150),
  email: z.string().trim().toLowerCase().email("Correo no válido"),
  role: z.enum(["ADMIN", "BUSINESS", "TECH"]),
  password: z.string().min(10, "Mínimo 10 caracteres"),
});

export async function createUser(input: z.input<typeof userSchema>): Promise<ActionResult> {
  try {
    const admin = await assertModule("admin");
    const parsed = userSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
      return { ok: false, error: "Revise los datos del usuario.", fieldErrors };
    }
    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (exists) return { ok: false, error: "Ya existe un usuario con ese correo.", fieldErrors: { email: "Correo ya registrado" } };
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash: await bcrypt.hash(parsed.data.password, 10),
      },
    });
    await logActivity(admin.id, "USER_CREATED", "USER", parsed.data.email, parsed.data.role);
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuario creado." };
  } catch (err) {
    return fail(err);
  }
}

const updateSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["ADMIN", "BUSINESS", "TECH"]),
  active: z.boolean(),
  password: z.string().optional(),
});

export async function updateUser(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  try {
    const admin = await assertModule("admin");
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos no válidos." };
    const { id, role, active, password } = parsed.data;
    if (id === admin.id && (role !== "ADMIN" || !active))
      return { ok: false, error: "No puede quitarse a sí mismo el rol de administrador ni desactivarse." };
    if (password && password.length < 10) return { ok: false, error: "La nueva contraseña debe tener al menos 10 caracteres." };
    const target = await prisma.user.update({
      where: { id },
      data: { role, active, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
    });
    await logActivity(admin.id, "USER_UPDATED", "USER", target.email, `${role} ${active ? "activo" : "inactivo"}`);
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuario actualizado." };
  } catch (err) {
    return fail(err);
  }
}
