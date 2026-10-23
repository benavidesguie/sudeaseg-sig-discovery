import type { Role } from "./session-token";

export type ModuleKey = "dashboard" | "m1" | "m2" | "m3" | "m4" | "m5" | "admin" | "export";

// RBAC simplificado (PRD §3).
const ACCESS: Record<Role, ModuleKey[]> = {
  ADMIN: ["dashboard", "m1", "m2", "m3", "m4", "m5", "admin", "export"],
  BUSINESS: ["dashboard", "m1", "m2", "m5"],
  TECH: ["dashboard", "m1", "m3", "m4"],
};

export function canAccess(role: Role, module: ModuleKey) {
  return ACCESS[role].includes(module);
}

// Módulo 1: qué bloques edita cada rol. El admin edita todo.
export function systemFieldScope(role: Role): "all" | "business" | "tech" {
  if (role === "ADMIN") return "all";
  return role === "BUSINESS" ? "business" : "tech";
}
