"use client";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import type { CalendarResponse, CalendarMode, RegionQuery } from "@/lib/types";
import { fmtNumber } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";

export const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export function regionParams(region: RegionQuery) {
  const q = new URLSearchParams();
  Object.entries(region).forEach(([key, value]) => { if (value !== undefined && value !== "") q.set(key, String(value)); });
  return q;
}
export function Calendar({ region }: { region: RegionQuery }) {
  const [mode, setMode] = useState<CalendarMode>("harmonized");
  const [view, setView] = useState("count");
  const [detail, setDetail] = useState("Selecciona un mes para consultar su valor.");
  const q = regionParams(region); q.set("mode", mode);
  const { data, error, loading, source } = useApi<CalendarResponse>(`/api/calendar?${q}`);
  const years = [...new Set(data?.cells.map(c => c.year))].sort((a,b) => a-b);
  const max = Math.max(1, ...data?.cells.map(c => c.value) ?? []);
  const annual = years.map(year => ({ year, value: data!.cells.filter(c => c.year === year).reduce((sum,c) => sum + c.value, 0) }));
  const ratio = data?.current?.ratio;
  return <section className="card space-y-4" aria-labelledby="calendar-title" aria-busy={loading}>
    <div className="flex flex-wrap justify-between gap-4"><div><p className="eyebrow">Historia del fuego</p><h2 id="calendar-title" className="text-xl font-semibold">Calendario de actividad</h2><p className="text-sm text-stone-600">Cada fila es un año. Cada columna, un mes.</p></div>
      <div className="flex flex-wrap gap-2"><div role="group" aria-label="Procesamiento de datos">{([['raw','Crudo'],['harmonized','Armonizado']] as const).map(([v,label]) => <button className={`chip ${mode===v?'chip-on':'chip-off'}`} aria-pressed={mode===v} key={v} onClick={() => setMode(v)}>{label}</button>)}</div><label className="text-sm">Mostrar <select className="input" value={view} onChange={e=>setView(e.target.value)}><option value="count">Conteo</option><option value="anomaly">Anomalía</option></select></label></div>
    </div>
    <p className="text-sm">{mode === 'raw' ? 'Detecciones sin ajustar: MODIS antes de 2012 y VIIRS después. Un cambio de sensor puede parecer un aumento de incendios.' : 'Armonizado: agrupamos observaciones del mismo lugar y día y ajustamos MODIS para compararlo con VIIRS.'}</p>
    {source === 'fixture' && <p role="status" className="notice">Ejemplo provisional de RD: la API aún no está disponible. No representa una calibración científica validada. Las descargas requieren la API.</p>}
    {loading && <p role="status">Consultando calendario…</p>}{error && <p role="alert">Calendario no disponible para esta selección. {error}</p>}
    {data && <>
      <div className="border-l-4 border-teal-700 bg-stone-50 p-3"><h3 className="font-semibold">Este mes vs. mediana histórica</h3><p>{ratio == null ? 'Sin datos suficientes para comparar este mes.' : `${fmtNumber(ratio, 2)} veces la mediana histórica de ese mes.`}</p>{data.current && <p className="text-sm">Mes consultado: {MONTHS[data.current.month-1]} {data.current.year}. {fmtNumber(data.current.value)} {mode==='raw'?'detecciones':'unidades armonizadas'}.</p>}</div>
      <div className="h-44" aria-label="Serie anual de actividad"><ResponsiveContainer><LineChart data={annual}><XAxis dataKey="year"/><YAxis width={60}/><Tooltip formatter={v=>fmtNumber(Number(v))}/><ReferenceLine x={2012} stroke="#7c4a20"/><Line dataKey="value" name={mode==='raw'?'Detecciones':'Unidades armonizadas'} stroke="#076b80" dot={false}/></LineChart></ResponsiveContainer></div>
      <p className="text-xs text-stone-600">Línea vertical: entrada de VIIRS en 2012. Compara ambos modos; el ajuste no garantiza eliminar todos los cambios.</p>
      <p className="text-sm">{view==='anomaly'?'Anomalía = valor ÷ mediana histórica: azul, por debajo de 1; neutro, cerca de 1; marrón, por encima de 1.':'Azul claro → azul oscuro: de menor a mayor actividad dentro de esta selección.'} Rayado: un solo satélite. —: sin valor comparable.</p>
      <div className="overflow-x-auto"><table className="calendar-table"><caption className="sr-only">Actividad mensual. Usa las flechas para navegar entre meses y años. Los valores están disponibles en cada botón.</caption><thead><tr><th scope="col">Año</th>{MONTHS.map(m=><th scope="col" key={m}>{m}</th>)}</tr></thead><tbody>{years.map(year=><tr key={year}><th scope="row">{year}</th>{MONTHS.map((month,i)=>{
        const c=data.cells.find(c=>c.year===year && c.month===i+1);
        const value=c && (view==='anomaly'?c.anomaly:mode==='harmonized'?c.harmonized:c.value);
        const text=`${month} ${year}: ${value==null?'sin datos':fmtNumber(value,view==='anomaly'?2:0)}${view==='anomaly'?' veces la mediana':''}${c?.singleSatellite?', un solo satélite':''}`;
        const ramp=['#e5f0f5','#b4d7e7','#74adc7','#387996','#14465e'];
        const color=value==null?'#e7e5e4':view==='anomaly'?(value<.8?'#21667b':value>1.2?'#855125':'#eee9df'):ramp[Math.min(4,Math.floor(value/max*5))];
        return <td key={month}><button type="button" className={`calendar-cell ${c?.singleSatellite?'single-satellite':''}`} style={{backgroundColor:color}} aria-label={text} title={text} onMouseEnter={()=>setDetail(text)} onFocus={()=>setDetail(text)} onClick={()=>setDetail(text)} onKeyDown={e=>{const offset=({ArrowLeft:-1,ArrowRight:1,ArrowUp:-12,ArrowDown:12} as Record<string,number>)[e.key];if(offset){e.preventDefault();const buttons=Array.from(e.currentTarget.closest('tbody')!.querySelectorAll('button'));buttons[buttons.indexOf(e.currentTarget)+offset]?.focus();}}}><span className="sr-only">{text}</span><span aria-hidden className="cell-number">{value==null?'—':fmtNumber(value,view==='anomaly'?1:0)}</span></button></td>;
      })}</tr>)}</tbody></table></div><p className="min-h-6 text-sm font-medium" role="status">{detail}</p>
      <div className="flex flex-wrap gap-2">{(['detections','monthly'] as const).map(kind=>source==='api'?<a className="btn" key={kind} href={`/api/export.csv?${q}&kind=${kind}`} download>Descargar CSV {kind==='detections'?'de focos':'mensual'}</a>:<button className="btn" disabled key={kind}>CSV {kind==='detections'?'de focos':'mensual'} pendiente de API</button>)}</div>
    </>}
  </section>;
}
