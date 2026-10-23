import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { canAccess } from "@/lib/permissions";
import { buildDossier, dossierToMarkdown } from "@/lib/server/exports";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user.role, "export")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const dossier = await buildDossier();
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "md") {
    return new NextResponse(dossierToMarkdown(dossier), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="dossier-tecnico-${stamp}.md"`,
      },
    });
  }
  return new NextResponse(JSON.stringify(dossier, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dossier-tecnico-${stamp}.json"`,
    },
  });
}
