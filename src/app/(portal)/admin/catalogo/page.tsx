import { prisma } from "@/lib/server/db";
import { requireModule } from "@/lib/server/auth";
import { getProjectSettings } from "@/lib/server/project";
import { SYSTEM_CODES } from "@/lib/catalogs";
import { PageHeader } from "@/components/ui";
import { CatalogEditor } from "./catalog-editor";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  await requireModule("admin");
  const [systems, users, settings] = await Promise.all([
    prisma.systemInventory.findMany(),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true, email: true } }),
    getProjectSettings(),
  ]);
  const rows = SYSTEM_CODES.map((code) => {
    const s = systems.find((x) => x.systemCode === code);
    return {
      systemCode: code,
      commonName: s?.commonName ?? "",
      spocBusinessId: s?.spocBusinessId ?? "",
      spocTechId: s?.spocTechId ?? "",
    };
  });

  return (
    <>
      <PageHeader
        phase="Fase 0 · Inicialización"
        title="Catálogo base de los 22 sistemas"
        subtitle="Cargue o confirme el nombre común acordado de cada sistema (SIS-01 a SIS-22) y asigne su Single Point of Contact funcional y técnico. Hasta que confirme el catálogo, los formularios permanecen bloqueados para los usuarios finales."
      />
      <CatalogEditor
        initialRows={rows}
        businessUsers={users.filter((u) => u.role !== "TECH")}
        techUsers={users.filter((u) => u.role !== "BUSINESS")}
        confirmedAt={settings.catalogConfirmedAt?.toISOString() ?? null}
        confirmedBy={settings.catalogConfirmedBy}
      />
    </>
  );
}
