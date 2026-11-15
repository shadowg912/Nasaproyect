"use client";
import dynamic from "next/dynamic";
import { useFilters } from "@/lib/filters";
import { useApi } from "@/lib/useApi";
import type { Stats } from "@/lib/types";
import { CONFIDENCE_LABEL, SATELLITE_LABEL, type Confidence } from "@/lib/types";
import { fmtDateTime, fmtNumber, CONFIDENCE_COLOR } from "@/lib/format";
import { FilterBar } from "./FilterBar";
import { ConfidenceChart, DailyChart, ProvinceChart, SatelliteList } from "./Charts";
import { useStatus, STATE_INFO } from "./StatusIndicator";
import Link from "next/link";

const FireMap = dynamic(() => import("./FireMap"), { ssr: false, loading: () => <div className="h-[28rem] animate-pulse rounded-xl bg-stone-200" /> });

type Detections = GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, string | number | null>> & { truncated: boolean };

function Kpi({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId?: string }) {
  return (
    <div className="card">
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-stone-900" data-testid={testId}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

export function Dashboard({ basemap }: { basemap: "pmtiles" | "geojson" }) {
  const { filters, update, apiQuery } = useFilters("7d");
  const { status } = useStatus();
  const refreshKey = status?.lastSuccessAt ?? 0;
  const { data: stats, error } = useApi<Stats>(`/api/stats?${apiQuery}`, refreshKey);
  const { data: fires } = useApi<Detections>(`/api/detections?${apiQuery}`, refreshKey);
  const selectProvince = (id: number | undefined) =>
    update({ province: id && String(id) !== filters.province ? String(id) : undefined, municipality: undefined });

  return (
    <div className="space-y-4">
      {status && status.state !== "fresh" && (
        <div className={`rounded-xl border p-3 text-sm ${status.state === "offline" ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`} role="status">
          <b>{STATE_INFO[status.state].label}.</b> {STATE_INFO[status.state].desc}
          {status.lastErrorMessage && status.state === "offline" && <span className="block text-stone-600">Detalle: {status.lastErrorMessage}</span>}
          {" "}<Link href="/estado" className="text-fuego-700 underline">Ver estado de sincronización</Link>
        </div>
      )}
      <FilterBar filters={filters} update={update} />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi testId="kpi-total" label="Detecciones" value={stats ? fmtNumber(stats.total) : "…"} hint="Puntos de calor en el periodo" />
        <Kpi label="Confianza alta" value={stats ? fmtNumber(stats.highConfidence) : "…"} hint={stats && stats.total ? `${Math.round((stats.highConfidence / stats.total) * 100)} % del total` : undefined} />
        <Kpi label="Provincias afectadas" value={stats ? fmtNumber(stats.provincesAffected) : "…"} hint="De 32 (incl. Distrito Nacional)" />
        <Kpi label="FRP total" value={stats ? `${fmtNumber(stats.totalFrp)} MW` : "…"} hint="Potencia radiativa del fuego" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FireMap
            basemap={basemap}
            fires={fires}
            provinceCounts={stats?.byProvince}
            selectedProvince={filters.province ? Number(filters.province) : undefined}
            onSelectProvince={selectProvince}
          />
          {fires?.truncated && <p className="mt-1 text-xs text-amber-700">Se muestran las 20 000 detecciones más recientes. Acote el periodo para ver todas.</p>}
        </div>
        <div className="card flex flex-col">
          <h2 className="card-title">Por provincia</h2>
          <div className="min-h-[24rem] flex-1"><ProvinceChart data={stats?.byProvince ?? []} onSelect={(id) => selectProvince(id)} /></div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="card-title">Detecciones por día (UTC)</h2>
          <div className="h-56"><DailyChart data={stats?.byDay ?? []} /></div>
        </div>
        <div className="card">
          <h2 className="card-title">Nivel de confianza</h2>
          <div className="h-56"><ConfidenceChart data={stats?.byConfidence ?? []} /></div>
        </div>
        <div className="card">
          <h2 className="card-title">Por satélite</h2>
          <SatelliteList data={stats?.bySatellite ?? []} />
          <p className="mt-3 text-xs text-stone-500">
            Día: {fmtNumber(stats?.byDaynight.find((d) => d.daynight === "D")?.count ?? 0)} · Noche: {fmtNumber(stats?.byDaynight.find((d) => d.daynight === "N")?.count ?? 0)}
          </p>
        </div>
        <div className="card md:col-span-1 lg:col-span-2">
          <h2 className="card-title">Detecciones recientes</h2>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-sm" data-testid="recent-table">
              <thead className="sticky top-0 bg-white text-xs text-stone-500">
                <tr><th className="py-1 pr-3">Fecha (hora RD)</th><th className="pr-3">Ubicación</th><th className="pr-3">Confianza</th><th className="pr-3 text-right">FRP (MW)</th><th className="hidden sm:table-cell">Satélite</th></tr>
              </thead>
              <tbody>
                {fires?.features.slice(0, 50).map((f) => {
                  const p = f.properties;
                  return (
                    <tr key={String(p.id)} className="border-t border-stone-100">
                      <td className="py-1 pr-3 whitespace-nowrap">{fmtDateTime(String(p.acquiredAt))}</td>
                      <td className="pr-3">{p.municipality ?? "—"}<span className="text-stone-500">, {p.province ?? "—"}</span></td>
                      <td className="pr-3 whitespace-nowrap"><span style={{ color: CONFIDENCE_COLOR[p.confidence as Confidence] }}>●</span> {CONFIDENCE_LABEL[p.confidence as Confidence]}</td>
                      <td className="pr-3 text-right tabular-nums">{p.frp != null ? fmtNumber(Number(p.frp), 1) : "—"}</td>
                      <td className="hidden sm:table-cell">{SATELLITE_LABEL[String(p.satellite)] ?? p.satellite}</td>
                    </tr>
                  );
                })}
                {fires && fires.features.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-stone-400">Sin detecciones en el periodo seleccionado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="text-xs text-stone-500">
        Todas las cifras se calculan con la base de datos local. Dato más reciente: {fmtDateTime(status?.latestDetectionAt)}.
      </p>
    </div>
  );
}
