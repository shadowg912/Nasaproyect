import type { CalendarCell, MonthStat } from "@/lib/types";

const quantile = (sorted: number[], p: number) => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
};

/** Mediana y percentiles 25/75 de `value` por mes del año, solo con los años de la línea base. */
export function monthStats(cells: CalendarCell[], baseline: [number, number]): MonthStat[] {
  return Array.from({ length: 12 }, (_, i) => {
    const vals = cells
      .filter((c) => c.month === i + 1 && c.year >= baseline[0] && c.year <= baseline[1])
      .map((c) => c.value)
      .sort((a, b) => a - b);
    return { month: i + 1, median: quantile(vals, 0.5), p25: quantile(vals, 0.25), p75: quantile(vals, 0.75) };
  });
}

/** Copia de las celdas con anomalía = valor / mediana del mes (null si la mediana es 0). */
export function withAnomaly(cells: CalendarCell[], stats: MonthStat[]): CalendarCell[] {
  return cells.map((c) => {
    const median = stats[c.month - 1]?.median ?? 0;
    return { ...c, anomaly: median > 0 ? c.value / median : null };
  });
}
