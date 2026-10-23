"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "@/lib/session-token";
import { logActivity } from "@/lib/server/activity";

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Ingrese correo y contraseña." };

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) return { error: "Credenciales inválidas o usuario inactivo." };

  const token = await signSession({ sub: user.id, role: user.role, name: user.name, email: user.email });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  await logActivity(user.id, "LOGIN", "USER", user.email);

  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
