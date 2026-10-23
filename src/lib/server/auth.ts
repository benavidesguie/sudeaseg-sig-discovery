import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession, type Role } from "../session-token";
import { canAccess, type ModuleKey } from "../permissions";

export type CurrentUser = { id: string; name: string; email: string; role: Role };

// Lee la sesión y confirma contra la BD que el usuario sigue activo y con el mismo rol.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireModule(module: ModuleKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canAccess(user.role, module)) redirect("/?denied=1");
  return user;
}

// Variante para server actions y route handlers: lanza en vez de redirigir.
export class AuthError extends Error {}

export async function assertModule(module: ModuleKey): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sesión expirada. Vuelva a iniciar sesión.");
  if (!canAccess(user.role, module)) throw new AuthError("No tiene permisos para esta acción.");
  return user;
}
