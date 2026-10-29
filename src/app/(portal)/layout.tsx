import { requireUser } from "@/lib/server/auth";
import { isCatalogConfirmed } from "@/lib/server/project";
import { canAccess } from "@/lib/permissions";
import { labelOf, ROLES, TOTAL_SYSTEMS } from "@/lib/catalogs";
import { logout } from "@/app/actions/auth";
import { Nav, type NavGroup } from "@/components/nav";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const confirmed = await isCatalogConfirmed();
  const can = (m: Parameters<typeof canAccess>[1]) => canAccess(user.role, m);

  const groups: NavGroup[] = [
    { title: "General", items: [{ href: "/", label: "Tablero de avance" }] },
    {
      title: "Relevamiento",
      items: [
        can("m1") && { href: "/sistemas", label: "1 · Ficha de sistemas", hint: "Fase 1 · Censo" },
        can("m2") && { href: "/kpis", label: "2 · Indicadores de gestión", hint: "Fase 2A · Negocio" },
        can("m3") && { href: "/metadatos", label: "3 · Metadatos y trazabilidad", hint: "Fase 2B · TI" },
        can("m4") && { href: "/conectividad", label: "4 · Conectividad", hint: "Fase 3 · TI" },
        can("m5") && { href: "/homologacion", label: "5 · Homologación de maestros", hint: "Transversal" },
      ].filter(Boolean) as NavGroup["items"],
    },
  ];
  if (can("admin"))
    groups.push({
      title: "Administración",
      items: [
        { href: "/admin/catalogo", label: "Catálogo semilla", hint: "Fase 0" },
        { href: "/admin/usuarios", label: "Usuarios y roles" },
        { href: "/exportar", label: "Exportables", hint: "Fase 4" },
      ],
    });

  return (
    <div className="lg:flex">
      <aside className="no-print bg-brand-900 px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:py-6">
        <div className="flex items-center justify-between lg:mb-8 lg:block">
          <div className="px-3">
            <div className="text-[11px] font-semibold tracking-wider text-brand-100/70 uppercase">SUDEASEG</div>
            <div className="text-base font-semibold text-white">Inventario de Sistemas</div>
          </div>
        </div>
        <div className="lg:flex-1">
          <Nav groups={groups} />
        </div>
        <div className="mt-4 border-t border-white/10 px-3 pt-4 text-sm">
          <div className="font-medium text-white">{user.name}</div>
          <div className="text-xs text-brand-100/70">{labelOf(ROLES, user.role)}</div>
          <form action={logout} className="mt-3">
            <button className="text-xs text-brand-100 hover:text-white hover:underline">Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        {!confirmed && (
          <div className="no-print border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
            <strong>Fase 0 pendiente:</strong>{" "}
            {user.role === "ADMIN"
              ? `confirme el catálogo base de los ${TOTAL_SYSTEMS} sistemas y sus responsables para habilitar los formularios al resto de los usuarios.`
              : "el administrador aún no confirmó el catálogo de sistemas; los formularios están en solo lectura."}
          </div>
        )}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
