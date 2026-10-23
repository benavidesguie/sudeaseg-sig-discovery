import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

// Redirige a /login cualquier página protegida sin sesión válida.
// La verificación fina (usuario activo, rol) se repite en cada página y acción.
// Las rutas /api quedan fuera: cada handler valida la sesión por sí mismo, y pasar por el
// middleware truncaría los adjuntos de más de 10 MB (middlewareClientMaxBodySize).
export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = req.nextUrl.pathname === "/" ? "" : `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api/|login|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
