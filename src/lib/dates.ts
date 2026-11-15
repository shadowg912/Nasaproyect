/** Utilidades de fechas en UTC (las fechas de FIRMS están en UTC). */
export const toDate = (d: Date) => d.toISOString().slice(0, 10);
export const parseDate = (s: string) => new Date(`${s}T00:00:00Z`);
export const addDays = (s: string, n: number) => toDate(new Date(parseDate(s).getTime() + n * 86400000));
export const daysBetween = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
export const isIsoDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime()) && toDate(parseDate(s)) === s;

/** Divide [from, to] en bloques de como máximo `size` días. */
export function chunkRange(from: string, to: string, size: number): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let start = from; start <= to; start = addDays(start, size)) {
    const end = addDays(start, size - 1);
    out.push([start, end > to ? to : end]);
  }
  return out;
}
