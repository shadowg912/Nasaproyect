"use client";

import { ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { fmtNumber } from "@/lib/format";
import type { CalendarResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";
import { Skeleton, SkeletonLines } from "./ui/Skeleton";

const card = "rounded-[var(--radius-md)] bg-white p-5 shadow-[var(--shadow-float)]";

export function Methodology() {
  const { data, source, error } = useApi<CalendarResponse>("/api/calendar?iso3=DOM&mode=harmonized");
  const calibration = data?.calibration;

  if (!data && !error) {
    return (
      <article className="mx-auto max-w-5xl rounded-[var(--radius-lg)] bg-[var(--color-brand-50)] p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand-700)]">Método abierto</p>
        <Skeleton className="mt-3 h-11 max-w-md" label="Cargando metodología…" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        <div className="mt-5 rounded-[var(--radius-md)] bg-white p-5"><SkeletonLines /></div>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-5xl space-y-5 rounded-[var(--radius-lg)] bg-[var(--color-brand-50)] p-4 sm:p-7">
      <header className="max-w-3xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand-700)]">Método abierto</p>
        <h1 className="text-3xl font-black tracking-tight text-[var(--color-brand-900)]">Comparar años, no sensores</h1>
        <p className="mt-3 text-lg leading-relaxed text-[var(--color-text)]">Un satélite que ve más detalle encuentra más puntos calientes. Eso no significa necesariamente que haya más incendios.</p>
      </header>

      <section className={card}>
        <h2 className="text-xl font-bold text-[var(--color-brand-900)]">Cómo hacemos comparables las observaciones</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-6 leading-relaxed text-[var(--color-text)]">
          <li>Filtramos las detecciones para comparar señales de vegetación con confianza suficiente.</li>
          <li>Agrupamos las observaciones en celdas de aproximadamente un kilómetro. Una celda activa cuenta una vez por día, aunque el sensor vea varios puntos dentro.</li>
          <li>Comparamos los meses donde coinciden MODIS y VIIRS, en el solape de 2012–2025. El factor <b>k</b> ajusta la escala de MODIS para aproximarla a VIIRS.</li>
          <li>Usamos MODIS ajustado para los años anteriores y VIIRS para los posteriores. Los meses con Terra como único satélite reciben un ajuste propio.</li>
        </ol>
      </section>

      <section className={card}>
        <h2 className="text-xl font-bold text-[var(--color-brand-900)]">¿Qué tan bien coinciden?</h2>
        {source === "fixture" && <p className="notice mt-4">Validación de ejemplo provisional. El factor y los resultados no deben presentarse como un ajuste científico definitivo.</p>}
        {error && <p className="mt-4" role="alert">La validación no está disponible: {error}</p>}
        {calibration ? (
          <>
            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              {[["Factor k", fmtNumber(calibration.k, 2)], ["Intervalo de confianza", `${fmtNumber(calibration.ci[0], 2)} – ${fmtNumber(calibration.ci[1], 2)}`], ["R²", fmtNumber(calibration.r2, 3)]].map(([label, value]) => (
                <div key={label} className="rounded-[var(--radius-sm)] bg-[var(--color-brand-50)] p-3"><dt className="text-sm text-[var(--color-text)]/75">{label}</dt><dd className="mt-1 text-2xl font-bold text-[var(--color-brand-900)]">{value}</dd></div>
              ))}
            </dl>
            <p className="mt-4 text-[var(--color-text)]">Solape utilizado: {calibration.overlapYears.join("–")}. {calibration.source === "country" ? "Se utiliza el ajuste del país porque la región tiene pocos datos." : ""}</p>
          </>
        ) : <p className="mt-4">Sin calibración disponible.</p>}
        <p className="mt-4 leading-relaxed text-[var(--color-text)]">El intervalo de confianza muestra la incertidumbre del factor; se estima remuestreando meses. R² describe cuánto coinciden las variaciones mensuales: cuanto más cerca de uno, mayor coincidencia.</p>
        {!!data?.validation.length && <>
          <div className="mt-5 h-80" aria-label="Validación: MODIS ajustado frente a VIIRS"><ResponsiveContainer><ScatterChart margin={{ top: 15, right: 25, bottom: 30, left: 15 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="modisScaled" name="MODIS × k" label={{ value: "MODIS × k (celdas-día)", position: "bottom" }} /><YAxis type="number" dataKey="viirs" name="VIIRS" /><Tooltip cursor={{ strokeDasharray: "3 3" }} /><Scatter data={data.validation} name="Meses del solape" isAnimationActive={false} fill="#08569a" /></ScatterChart></ResponsiveContainer></div>
          <p className="text-sm text-[var(--color-text)]/75">Cada punto es un mes. Eje horizontal: MODIS × k; eje vertical: VIIRS, en celdas-día.</p>
          <details className="mt-4"><summary className="cursor-pointer font-semibold text-[var(--color-brand-900)]">Ver tabla accesible de validación</summary><div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-sm"><caption>Meses del solape</caption><thead><tr><th>Mes</th><th>MODIS × k</th><th>VIIRS</th></tr></thead><tbody>{data.validation.map((value) => <tr key={`${value.year}-${value.month}`}><th>{value.year}-{String(value.month).padStart(2, "0")}</th><td>{fmtNumber(value.modisScaled)}</td><td>{fmtNumber(value.viirs)}</td></tr>)}</tbody></table></div></details>
        </>}
      </section>

      <section className={card}>
        <h2 className="text-xl font-bold text-[var(--color-brand-900)]">Qué significa una anomalía</h2>
        <p className="mt-3 leading-relaxed text-[var(--color-text)]">Dividimos el valor de un mes por la mediana histórica de ese mismo mes. Uno equivale a lo habitual; dos representa el doble. La referencia empieza en 2003 y excluye el año actual. Si no hay suficientes datos o la mediana es cero, no mostramos comparación.</p>
        <h2 className="mt-6 text-xl font-bold text-[var(--color-brand-900)]">Lo que el ajuste no resuelve</h2>
        <p className="mt-3 leading-relaxed text-[var(--color-text)]">Las nubes, los horarios de observación, los cambios de órbita y los fuegos pequeños afectan el registro. Una celda-día no es un incendio individual ni una medida de superficie quemada. La causa probable y la dirección del viento aportan contexto; no son una confirmación ni un pronóstico operativo.</p>
      </section>
    </article>
  );
}
