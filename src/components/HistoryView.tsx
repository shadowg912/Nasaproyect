"use client";
import { useFilters, PRESETS } from "@/lib/filters";
import { useApi } from "@/lib/useApi";
import type { HistoryStats } from "@/lib/types";
import { fmtNumber } from "@/lib/format";
import { addDays } from "@/lib/dates";
import { FilterBar } from "./FilterBar";
import { MonthlyChart, SeasonalityChart } from "./Charts";
import { Skeleton, SkeletonLines } from "./ui/Skeleton";

const HISTORY_PRESETS = PRESETS.filter((p) => p.id === "30d" || p.id === "365d" || p.id === "all");

/** Agrupa los intervalos cubiertos por fuente para mostrar la cobertura real. */
function mergeCoverage(rows: HistoryStats["coverage"]) {
  const out: Record<string, { from: string; to: string }[]> = {};
  for (const r of rows) {
    const list = (out[r.source] ??= []);
    const last = list.at(-1);
    if (last && r.dateFrom <= addDays(last.to, 1)) last.to = r.dateTo > last.to ? r.dateTo : last.to;
    else list.push({ from: r.dateFrom, to: r.dateTo });
  }
  return out;
}

export function HistoryView() {
  const { filters, update, apiQuery } = useFilters("all");
  const { data } = useApi<HistoryStats>(`/api/history?${apiQuery}`);
  const coverage = data ? mergeCoverage(data.coverage) : {};
  const total = data?.byYear.reduce((s, y) => s + y.count, 0) ?? 0;

  return (
    <article className="space-y-5 rounded-[var(--radius-lg)] bg-[var(--color-brand-50)] p-4 sm:p-7">
      <header className="max-w-3xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand-700)]">Contexto temporal</p>
        <h1 className="text-3xl font-black tracking-tight text-[var(--color-brand-900)]">Análisis histórico</h1>
        <p className="mt-2 text-[var(--color-text)]">
          Basado únicamente en los datos guardados en la base local. El historial depende de los intervalos importados
          (ver cobertura abajo); los productos de tiempo casi real (NRT) solo cubren los últimos meses.
        </p>
      </header>
      <FilterBar filters={filters} update={update} presets={HISTORY_PRESETS} />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-[var(--radius-md)] bg-white p-5 shadow-[var(--shadow-float)] lg:col-span-2">
          <h2 className="text-lg font-bold text-[var(--color-brand-900)]">Detecciones por mes</h2>
          <div className="mt-4 h-64">{data ? <MonthlyChart data={data.byMonth} /> : <Skeleton className="h-full" label="Cargando detecciones por mes…" />}</div>
        </section>
        <section className="rounded-[var(--radius-md)] bg-white p-5 shadow-[var(--shadow-float)]">
          <h2 className="text-lg font-bold text-[var(--color-brand-900)]">Por año</h2>
          {!data && <div className="mt-4"><SkeletonLines lines={5} /></div>}
          <ul className="space-y-1 text-sm">
            {data?.byYear.map((y) => (
              <li key={y.year} className="flex justify-between border-b border-stone-100 py-1"><span>{y.year}</span><span className="tabular-nums">{fmtNumber(y.count)}</span></li>
            ))}
            {!data?.byYear.length && <li className="text-stone-400">Sin datos</li>}
          </ul>
          <p className="mt-2 text-xs text-stone-500">Total: {fmtNumber(total)}</p>
        </section>
        <section className="rounded-[var(--radius-md)] bg-white p-5 shadow-[var(--shadow-float)] lg:col-span-2">
          <h2 className="text-lg font-bold text-[var(--color-brand-900)]">Estacionalidad: promedio mensual por año</h2>
          <div className="mt-4 h-56">{data ? <SeasonalityChart data={data.monthOfYear} /> : <Skeleton className="h-full" label="Cargando estacionalidad…" />}</div>
          <p className="mt-2 text-xs text-stone-500">En RD la temporada seca (aprox. enero–abril) concentra la mayoría de los incendios forestales y quemas agrícolas.</p>
        </section>
        <section className="rounded-[var(--radius-md)] bg-white p-5 shadow-[var(--shadow-float)]">
          <h2 className="text-lg font-bold text-[var(--color-brand-900)]">Municipios con más detecciones</h2>
          <ol className="space-y-1 text-sm">
            {data?.topMunicipalities.map((m, i) => (
              <li key={m.id} className="flex justify-between gap-2">
                <span><span className="text-stone-400">{i + 1}.</span> {m.name} <span className="text-stone-500">({m.province})</span></span>
                <span className="tabular-nums">{fmtNumber(m.count)}</span>
              </li>
            ))}
            {!data?.topMunicipalities.length && <li className="text-stone-400">Sin datos</li>}
          </ol>
        </section>
      </div>
      <section className="rounded-[var(--radius-md)] bg-white p-5 shadow-[var(--shadow-float)]">
        <h2 className="text-lg font-bold text-[var(--color-brand-900)]">Cobertura de datos descargados</h2>
        {Object.keys(coverage).length === 0 ? (
          <p className="text-sm text-stone-500">Aún no hay intervalos registrados. Use <code>npm run sync:firms</code> o <code>npm run import:history</code>.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-stone-500"><tr><th>Producto</th><th>Intervalos cubiertos (UTC)</th></tr></thead>
            <tbody>
              {Object.entries(coverage).map(([src, list]) => (
                <tr key={src} className="border-t border-stone-100 align-top">
                  <td className="py-1 pr-4 font-mono text-xs">{src}</td>
                  <td className="py-1">{list.map((r) => `${r.from} → ${r.to}`).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </article>
  );
}
