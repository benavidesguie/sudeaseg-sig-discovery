import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { canAccess } from "@/lib/permissions";
import { rowsToCsv, rowsToXlsx, traceabilityRows } from "@/lib/server/exports";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user.role, "export")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const format = new URL(req.url).searchParams.get("format") ?? "csv";
  const rows = await traceabilityRows();
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "xlsx") {
    const buf = await rowsToXlsx(rows);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="matriz-trazabilidad-${stamp}.xlsx"`,
      },
    });
  }
  return new NextResponse(rowsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="matriz-trazabilidad-${stamp}.csv"`,
    },
  });
}
