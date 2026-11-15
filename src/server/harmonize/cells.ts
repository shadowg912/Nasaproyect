import type { Confidence, SensorFamily } from "@/lib/types";

/** Tamaño de celda común (~1 km, resolución nominal de MODIS). */
export const CELL_DEG = 0.01;

export interface CellDetection {
  lat: number;
  lon: number;
  acqDate: string;
  family: SensorFamily;
  satellite: string;
  confidence: Confidence;
  fireType: number | null;
  /** Celda que tuvo `type = 2` (fuente fija) en algún año; se usa para filas NRT sin `type`. */
  staticCell?: boolean;
}

export interface MonthCounts {
  /** Detecciones crudas (sin filtrar). VIIRS = Suomi NPP + NOAA-20. */
  modisRaw: number;
  viirsRaw: number;
  /** Celdas-día válidas. `viirsCd` es Suomi NPP (referencia de la serie). */
  modisCd: number;
  viirsCd: number;
  terraCd: number;
  noaa20Cd: number;
}

const SNPP = new Set(["N", "NPP", "SUOMI NPP", "SUOMI-NPP"]);
const NOAA20 = new Set(["N20", "J1", "NOAA-20", "NOAA20"]);
const TERRA = new Set(["TERRA", "T"]);
const norm = (s: string) => s.trim().toUpperCase();
export const isSnpp = (satellite: string) => SNPP.has(norm(satellite));
export const isNoaa20 = (satellite: string) => NOAA20.has(norm(satellite));
export const isTerra = (satellite: string) => TERRA.has(norm(satellite));

export const cellKey = (lat: number, lon: number) =>
  `${Math.floor(lat / CELL_DEG + 1e-9)}:${Math.floor(lon / CELL_DEG + 1e-9)}`;

/** Presunto fuego de vegetación con confianza nominal o alta. */
export function isValid(d: CellDetection): boolean {
  if (d.confidence === "low") return false;
  if (d.fireType === null) return !d.staticCell;
  return d.fireType === 0;
}

export const emptyCounts = (): MonthCounts => ({ modisRaw: 0, viirsRaw: 0, modisCd: 0, viirsCd: 0, terraCd: 0, noaa20Cd: 0 });

/** Conteos mensuales (clave `AAAA-MM`): crudos y en celdas-día de 0,01°, una por día y grupo de sensor. */
export function monthlyCounts(ds: Iterable<CellDetection>): Map<string, MonthCounts> {
  const out = new Map<string, MonthCounts>();
  const seen = new Set<string>();
  for (const d of ds) {
    const ym = d.acqDate.slice(0, 7);
    const m = out.get(ym) ?? emptyCounts();
    out.set(ym, m);
    const snpp = d.family === "VIIRS" && isSnpp(d.satellite);
    const n20 = d.family === "VIIRS" && isNoaa20(d.satellite);
    if (d.family === "MODIS") m.modisRaw++;
    else if (snpp || n20) m.viirsRaw++;
    if (!isValid(d)) continue;
    const cell = `${d.acqDate}|${cellKey(d.lat, d.lon)}`;
    const mark = (group: string, field: keyof MonthCounts) => {
      const k = `${group}|${cell}`;
      if (seen.has(k)) return;
      seen.add(k);
      m[field]++;
    };
    if (d.family === "MODIS") {
      mark("modis", "modisCd");
      if (isTerra(d.satellite)) mark("terra", "terraCd");
    } else if (snpp) mark("snpp", "viirsCd");
    else if (n20) mark("n20", "noaa20Cd");
  }
  return out;
}
