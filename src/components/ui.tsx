import Link from "next/link";
import type { ReactNode } from "react";
import { TOTAL_SYSTEMS } from "@/lib/catalogs";

export function PageHeader({
  title,
  subtitle,
  phase,
  actions,
  back,
}: {
  title: string;
  subtitle?: ReactNode;
  phase?: string;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back && (
          <Link href={back.href} className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-700">
            ← {back.label}
          </Link>
        )}
        {phase && <div className="mb-1 text-xs font-semibold tracking-wider text-brand-600 uppercase">{phase}</div>}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <div className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-brand-50 text-brand-700 ring-brand-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const STATUS: Record<string, [string, Tone]> = {
  PENDING: ["Pendiente", "gray"],
  DRAFT: ["Borrador", "amber"],
  COMPLETED: ["Completado", "green"],
  BUSINESS_COMPLETED: ["Completado negocio", "blue"],
  TECH_MAPPED: ["Mapeado por TI", "green"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, tone] = STATUS[status] ?? [status, "gray"];
  return <Badge tone={tone}>{label}</Badge>;
}

export function WaveBadge({ wave }: { wave: number | null }) {
  if (!wave) return <Badge>Sin clasificar</Badge>;
  const tone: Tone = wave === 1 ? "green" : wave === 2 ? "amber" : "violet";
  return <Badge tone={tone}>Oleada {wave}</Badge>;
}

export function RiskBadge() {
  return <Badge tone="red">● Riesgo proveedor</Badge>;
}

export function ProgressBar({ value, max, tone = "blue" }: { value: number; max: number; tone?: "blue" | "green" | "amber" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const color = tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-brand-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Notice({ tone = "blue", title, children }: { tone?: "blue" | "amber" | "red" | "green"; title?: string; children: ReactNode }) {
  const cls = {
    blue: "border-brand-100 bg-brand-50 text-brand-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="text-base font-medium text-slate-900">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function LockedForms() {
  return (
    <Notice tone="amber" title="Portal en inicialización (Fase 0)">
      El administrador del proyecto aún no confirmó el catálogo base de los {TOTAL_SYSTEMS} sistemas ni la asignación de responsables. Los
      formularios se habilitarán en cuanto lo haga.
    </Notice>
  );
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
}
