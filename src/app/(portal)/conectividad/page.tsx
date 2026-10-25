import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { requireModule } from "@/lib/server/auth";
import { ACCESS_SHORT, PATTERN_SHORT, TOTAL_SYSTEMS, VOLUME_ESTIMATES, labelOf } from "@/lib/catalogs";
import { PageHeader, ProgressBar, RiskBadge, StatusBadge, WaveBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ConnectivityPage() {
  await requireModule("m4");
  const systems = await prisma.systemInventory.findMany({ orderBy: { systemCode: "asc" } });
  const done = systems.filter((s) => s.phase3Status === "COMPLETED").length;
  return (
    <>
      <PageHeader
        phase="Fase 3 · Módulo 4"
        title="Lista de verificación de conectividad, seguridad y volumetría"
        subtitle="Defina por sistema el patrón de extracción (Tipo A: BD directa, Tipo B: API, Tipo C: archivos SFTP, Tipo D: captura manual), los requisitos de red y la ventana de extracción."
      />
      <div className="mb-4 card p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium">Sistemas con protocolo definido</span>
          <span>{done} / {TOTAL_SYSTEMS}</span>
        </div>
        <ProgressBar value={done} max={TOTAL_SYSTEMS} tone={done === TOTAL_SYSTEMS ? "green" : "blue"} />
      </div>
      <div className="card overflow-x-auto">
        <table className="data-table min-w-[860px]">
          <thead>
            <tr>
              <th>Sistema</th>
              <th>Acceso (Módulo 1)</th>
              <th>Patrón</th>
              <th>Incremental</th>
              <th>Volumen</th>
              <th>Ventana</th>
              <th>Estado</th>
              <th>Oleada</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td>
                  <Link href={`/conectividad/${s.systemCode}`} className="link">
                    {s.systemCode}
                  </Link>{" "}
                  {s.officialName ?? s.commonName}
                </td>
                <td>
                  <div className="flex flex-col items-start gap-1">
                    {ACCESS_SHORT[s.accessLevel ?? ""] ?? "—"}
                    {s.vendorRiskAlert && <RiskBadge />}
                  </div>
                </td>
                <td>{PATTERN_SHORT[s.integrationPattern ?? ""] ?? "—"}</td>
                <td>{s.supportsIncrementalLoad === true ? "Sí" : s.supportsIncrementalLoad === false ? "No" : "—"}</td>
                <td className="text-xs">{labelOf(VOLUME_ESTIMATES, s.historicalVolumeEstimate)}</td>
                <td className="text-xs">{s.extractionWindow ?? "—"}</td>
                <td><StatusBadge status={s.phase3Status} /></td>
                <td><WaveBadge wave={s.waveNumber} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
