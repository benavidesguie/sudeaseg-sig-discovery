import "server-only";
import { AuthError } from "./auth";
import type { ActionResult } from "../action-result";

export function fail(err: unknown): ActionResult<never> {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Ocurrió un error inesperado. Intente nuevamente." };
}
