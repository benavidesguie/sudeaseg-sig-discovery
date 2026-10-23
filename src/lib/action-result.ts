import type { FieldErrors } from "./validation";

// En el caso de error, `data` permite devolver lo que sí se guardó (p. ej. un borrador recién creado).
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T; fieldErrors?: undefined }
  | { ok: false; error: string; fieldErrors?: FieldErrors; data?: T };
