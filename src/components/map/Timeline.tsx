"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useMapApp } from "./MapAppContext";

const rangeLabels = { "24h": "24 h", "48h": "48 h", week: "Semana" } as const;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function Timeline() {
  const { state, setState, setHistoryOpen } = useMapApp();
  const [cursor, setCursor] = useState(() => new Date(state.date + "T12:00:00Z"));
  const today = isoDate(new Date());
  const days = useMemo(() => {
    const start = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    const count = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
    return Array.from({ length: count }, (_, index) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), index + 1)));
  }, [cursor]);
  const label = new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" }).format(cursor);

  return (
    <section className="glass fixed inset-x-3 bottom-3 z-30 mx-auto max-w-6xl p-2 sm:px-4" aria-label="Línea de tiempo">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="glass" size="sm" aria-label="Mes anterior" onClick={() => setCursor((value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() - 1, 1)))}>‹</Button>
        <p className="min-w-28 text-sm font-bold capitalize text-white">{label}</p>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="group" aria-label="Día seleccionado">
          {days.map((day) => {
            const value = isoDate(day);
            const future = value > today;
            return <button key={value} type="button" disabled={future} aria-pressed={state.date === value} onClick={() => setState({ date: value })} className="min-h-8 min-w-8 rounded-md px-1 text-xs font-semibold text-white enabled:hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30 aria-pressed:bg-[var(--color-brand-500)]">{day.getUTCDate()}</button>;
          })}
        </div>
        <Button variant="glass" size="sm" aria-label="Mes siguiente" onClick={() => setCursor((value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1)))}>›</Button>
        <select aria-label="Rango temporal" value={state.range} onChange={(event) => setState({ range: event.target.value as keyof typeof rangeLabels })} className="min-h-8 rounded-md border border-white/25 bg-[var(--color-brand-900)] px-2 text-xs text-white">
          {Object.entries(rangeLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
        <Button variant="glass" size="sm" icon="history" onClick={() => setHistoryOpen(true)}>Historia</Button>
      </div>
    </section>
  );
}
