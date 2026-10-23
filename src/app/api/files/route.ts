import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { assertModule, AuthError, type CurrentUser } from "@/lib/server/auth";
import { formsLockedFor } from "@/lib/server/project";
import { logActivity } from "@/lib/server/activity";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, extensionOf, mimeFor, saveFile } from "@/lib/server/storage";
import { ATTACHMENT_KINDS, type AttachmentKind } from "@/lib/catalogs";
import { recomputeKpiStatus } from "@/lib/server/kpis";

export const runtime = "nodejs";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// Carga de adjuntos: documentación de sistema (Módulo 1 · Bloque C) y evidencias de KPI (Módulo 2 · Bloque D).
export async function POST(req: Request) {
  let user: CurrentUser;
  const form = await req.formData().catch(() => null);
  if (!form) return bad("Solicitud no válida.");
  const kind = String(form.get("kind") ?? "") as AttachmentKind;
  if (!(kind in ATTACHMENT_KINDS) || kind === "SCHEMA_UPLOAD") return bad("Tipo de adjunto no válido.");

  try {
    user = await assertModule(kind === "SYSTEM_DOC" ? "m1" : "m2");
  } catch (err) {
    return bad(err instanceof AuthError ? err.message : "No autorizado.", 403);
  }
  if (kind === "SYSTEM_DOC" && user.role === "BUSINESS")
    return bad("La documentación técnica la carga el custodio técnico.", 403);
  if (await formsLockedFor(user)) return bad("El catálogo aún no ha sido confirmado (Fase 0).", 403);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return bad("Seleccione un archivo.");
  if (file.size > MAX_UPLOAD_BYTES) return bad(`El archivo supera el máximo de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS[kind].includes(ext))
    return bad(`Formato no permitido. Formatos aceptados: ${ALLOWED_EXTENSIONS[kind].join(", ")}.`);

  let systemCode: string | null = null;
  let kpiId: string | null = null;
  let kpiCode: string | null = null;
  if (kind === "SYSTEM_DOC") {
    systemCode = String(form.get("systemCode") ?? "");
    if (!(await prisma.systemInventory.findUnique({ where: { systemCode } }))) return bad("Sistema no encontrado.", 404);
  } else {
    kpiId = String(form.get("kpiId") ?? "");
    const kpi = /^[0-9a-f-]{36}$/i.test(kpiId) ? await prisma.kpiCatalog.findUnique({ where: { id: kpiId } }) : null;
    if (!kpi) return bad("Guarde el KPI como borrador antes de adjuntar evidencias.", 404);
    kpiCode = kpi.kpiCode;
  }

  const storagePath = await saveFile(Buffer.from(await file.arrayBuffer()), file.name);
  const att = await prisma.attachment.create({
    data: {
      kind,
      systemCode,
      kpiId,
      originalName: file.name.slice(0, 255),
      mimeType: mimeFor(file.name),
      sizeBytes: file.size,
      storagePath,
      uploadedById: user.id,
    },
  });
  if (kpiId) await recomputeKpiStatus(kpiId);
  await logActivity(user.id, "FILE_UPLOADED", kpiId ? "KPI" : "SYSTEM", kpiCode ?? systemCode!, `${ATTACHMENT_KINDS[kind]}: ${file.name}`);
  return NextResponse.json({
    ok: true,
    attachment: { id: att.id, kind: att.kind, originalName: att.originalName, sizeBytes: att.sizeBytes, createdAt: att.createdAt },
  });
}
