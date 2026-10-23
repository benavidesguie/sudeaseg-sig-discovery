import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AttachmentKind } from "../catalogs";

const ROOT = path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024;

const DOCS = ["pdf", "doc", "docx", "xls", "xlsx", "xlsm", "csv", "txt", "png", "jpg", "jpeg", "webp", "zip", "vsdx", "drawio", "sql", "json", "xml", "md", "pptx"];
const IMAGES = ["png", "jpg", "jpeg", "webp", "gif", "pdf"];

export const ALLOWED_EXTENSIONS: Record<AttachmentKind, string[]> = {
  SYSTEM_DOC: DOCS,
  KPI_EXCEL: ["xlsx", "xlsm", "xls", "csv"],
  KPI_SCREENSHOT_TRANSACTION: IMAGES,
  KPI_SCREENSHOT_REPORT: IMAGES,
  SCHEMA_UPLOAD: ["csv", "tsv", "txt", "json"],
};

// El tipo MIME servido se deduce de la extensión (nunca del navegador que subió el archivo).
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  json: "application/json",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
export const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

export function extensionOf(name: string) {
  return path.extname(name).slice(1).toLowerCase();
}

export function mimeFor(name: string) {
  return MIME[extensionOf(name)] ?? "application/octet-stream";
}

export async function saveFile(data: Buffer, originalName: string) {
  await mkdir(ROOT, { recursive: true });
  const ext = extensionOf(originalName);
  const storagePath = `${randomUUID()}${ext ? "." + ext : ""}`;
  await writeFile(path.join(ROOT, storagePath), data);
  return storagePath;
}

function resolveSafe(storagePath: string) {
  const full = path.resolve(ROOT, storagePath);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Ruta de archivo no válida");
  return full;
}

export async function readStoredFile(storagePath: string) {
  return readFile(resolveSafe(storagePath));
}

export async function deleteStoredFile(storagePath: string) {
  try {
    await unlink(resolveSafe(storagePath));
  } catch {
    // Si el archivo ya no existe no hay nada que limpiar.
  }
}
