import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { assertModule, AuthError, getCurrentUser, type CurrentUser } from "@/lib/server/auth";
import { formsLockedFor } from "@/lib/server/project";
import { logActivity } from "@/lib/server/activity";
import { isSystemKpiLinked } from "@/lib/server/systems";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, deleteStoredFile, extensionOf, mimeFor, saveFile } from "@/lib/server/storage";
import { parseSchemaFile } from "@/lib/schema-parser";
import { canAccess } from "@/lib/permissions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ code: string }> };

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// Módulo 3 · carga y parseo del esquema exportado (schema_csv_upload). Reemplaza la carga anterior.
export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  let user: CurrentUser;
  try {
    user = await assertModule("m3");
  } catch (err) {
    return bad(err instanceof AuthError ? err.message : "No autorizado.", 403);
  }
  if (await formsLockedFor(user)) return bad("El catálogo aún no ha sido confirmado (Fase 0).", 403);
  const system = await prisma.systemInventory.findUnique({ where: { systemCode: code } });
  if (!system) return bad("Sistema no encontrado.", 404);
  if (!(await isSystemKpiLinked(code)))
    return bad("Este sistema no está vinculado a ningún KPI. Según la regla KPI-Driven Discovery, la carga técnica aún no está habilitada.", 409);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return bad("Seleccione un archivo.");
  if (file.size > MAX_UPLOAD_BYTES) return bad(`El archivo supera el máximo de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  if (!ALLOWED_EXTENSIONS.SCHEMA_UPLOAD.includes(extensionOf(file.name)))
    return bad("Formato no permitido. Suba un archivo .csv, .tsv, .txt o .json.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = parseSchemaFile(file.name, buffer.toString("utf8"));
  if (result.error) return bad(result.error, 422);

  const storagePath = await saveFile(buffer, file.name);
  const previous = await prisma.attachment.findMany({ where: { systemCode: code, kind: "SCHEMA_UPLOAD" } });
  const CHUNK = 5000;
  await prisma.$transaction(
    async (tx) => {
      await tx.systemRawSchema.deleteMany({ where: { systemCode: code } });
      for (let i = 0; i < result.rows.length; i += CHUNK) {
        await tx.systemRawSchema.createMany({
          data: result.rows.slice(i, i + CHUNK).map((r) => ({ ...r, systemCode: code })),
        });
      }
      await tx.attachment.deleteMany({ where: { systemCode: code, kind: "SCHEMA_UPLOAD" } });
      await tx.attachment.create({
        data: {
          kind: "SCHEMA_UPLOAD",
          systemCode: code,
          originalName: file.name.slice(0, 255),
          mimeType: mimeFor(file.name),
          sizeBytes: file.size,
          storagePath,
          uploadedById: user.id,
        },
      });
      await tx.systemInventory.update({
        where: { systemCode: code },
        data: { phase2SchemaUploaded: true, phase2SchemaUpdatedAt: new Date() },
      });
    },
    { timeout: 120_000 },
  );
  await Promise.all(previous.map((p) => deleteStoredFile(p.storagePath)));

  const tables = new Set(result.rows.map((r) => `${r.tableSchema ?? ""}.${r.tableName}`)).size;
  await logActivity(user.id, "SCHEMA_UPLOADED", "SYSTEM", code, `${result.rows.length} columnas, ${tables} tablas`);
  return NextResponse.json({ ok: true, columns: result.rows.length, tables, skipped: result.skipped });
}

// Buscador rápido de tablas y columnas, y listas para los desplegables de la mesa de cruce.
//   ?q=texto      → coincidencias en tabla o columna (máx. 200)
//   ?tables=1     → todas las tablas con su cantidad de columnas
//   ?table=nombre → columnas de una tabla
export async function GET(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return bad("No autenticado.", 401);
  if (!canAccess(user.role, "m3")) return bad("No autorizado.", 403);
  const { code } = await params;
  const url = new URL(req.url);

  if (url.searchParams.get("tables")) {
    const tables = await prisma.systemRawSchema.groupBy({
      by: ["tableSchema", "tableName"],
      where: { systemCode: code },
      _count: { _all: true },
      orderBy: [{ tableName: "asc" }],
    });
    return NextResponse.json({
      tables: tables.map((t) => ({ schema: t.tableSchema, name: t.tableName, columns: t._count._all })),
    });
  }

  const table = url.searchParams.get("table");
  if (table) {
    const columns = await prisma.systemRawSchema.findMany({
      where: { systemCode: code, tableName: table },
      orderBy: { ordinal: "asc" },
      select: { tableSchema: true, columnName: true, dataType: true, isNullable: true, charMaxLength: true },
    });
    return NextResponse.json({ columns });
  }

  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [], total: 0 });
  const where = {
    systemCode: code,
    OR: [
      { tableName: { contains: q, mode: "insensitive" as const } },
      { columnName: { contains: q, mode: "insensitive" as const } },
    ],
  };
  const [results, total] = await Promise.all([
    prisma.systemRawSchema.findMany({
      where,
      take: 200,
      orderBy: [{ tableName: "asc" }, { ordinal: "asc" }],
      select: { tableSchema: true, tableName: true, columnName: true, dataType: true, isNullable: true, charMaxLength: true },
    }),
    prisma.systemRawSchema.count({ where }),
  ]);
  return NextResponse.json({ results, total });
}
