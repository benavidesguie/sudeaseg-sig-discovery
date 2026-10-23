import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { formsLockedFor } from "@/lib/server/project";
import { logActivity } from "@/lib/server/activity";
import { INLINE_TYPES, deleteStoredFile, readStoredFile } from "@/lib/server/storage";
import { canAccess } from "@/lib/permissions";
import { recomputeKpiStatus } from "@/lib/server/kpis";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  let data: Buffer;
  try {
    data = await readStoredFile(att.storagePath);
  } catch {
    return NextResponse.json({ error: "Archivo no disponible en el almacenamiento" }, { status: 410 });
  }
  const inline = INLINE_TYPES.has(att.mimeType);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(att.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=0",
    },
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });
  const att = await prisma.attachment.findUnique({ where: { id }, include: { kpi: { select: { kpiCode: true } } } });
  if (!att) return NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });

  const module = att.kind === "SYSTEM_DOC" ? "m1" : att.kind === "SCHEMA_UPLOAD" ? "m3" : "m2";
  const allowed = user.role === "ADMIN" || (canAccess(user.role, module) && att.uploadedById === user.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Solo quien subió el archivo o un administrador puede eliminarlo." }, { status: 403 });
  if (await formsLockedFor(user))
    return NextResponse.json({ ok: false, error: "El catálogo aún no ha sido confirmado (Fase 0)." }, { status: 403 });

  await prisma.attachment.delete({ where: { id } });
  await deleteStoredFile(att.storagePath);
  if (att.kpiId) await recomputeKpiStatus(att.kpiId);
  await logActivity(user.id, "FILE_DELETED", att.kpiId ? "KPI" : "SYSTEM", att.kpi?.kpiCode ?? att.systemCode ?? "-", att.originalName);
  return NextResponse.json({ ok: true });
}
