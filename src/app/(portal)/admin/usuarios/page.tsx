import { prisma } from "@/lib/server/db";
import { requireModule } from "@/lib/server/auth";
import { PageHeader } from "@/components/ui";
import { UsersManager } from "./users-manager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireModule("admin");
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { spocBusinessFor: true, spocTechFor: true } } },
  });
  return (
    <>
      <PageHeader
        title="Usuarios y roles"
        subtitle="Administrador / Consultor BI: acceso total. Líder funcional / Usuario clave: Módulos 1 (funcional), 2 y 5. Custodio técnico / DBA: Módulos 1 (técnico), 3 y 4."
      />
      <UsersManager
        meId={me.id}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
          spocCount: u._count.spocBusinessFor + u._count.spocTechFor,
        }))}
      />
    </>
  );
}
