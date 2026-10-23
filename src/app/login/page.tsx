import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-xs font-semibold tracking-wider text-brand-100/70 uppercase">Discovery & Assessment</div>
          <h1 className="mt-1 text-2xl font-semibold text-white">Portal de Relevamiento</h1>
          <p className="mt-1 text-sm text-brand-100/80">22 sistemas · Indicadores de gestión (KPIs)</p>
        </div>
        <div className="card p-6">
          <LoginForm next={next ?? "/"} />
        </div>
      </div>
    </div>
  );
}
