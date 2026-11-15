import type { CalendarCell } from "@/lib/types";
import type { EngineCalibration } from "./calibrate";
import { emptyCounts, type MonthCounts } from "./cells";

export const FIRST_YEAR = 2000;
/** Primer año de VIIRS (Suomi NPP). */
export const VIIRS_START_YEAR = 2012;
/** Antes de este mes solo había MODIS en Terra (Aqua empezó el 2002-07-04). */
export const AQUA_START = "2002-07";
/** Por debajo de esta fracción de la estimación NOAA-20, el mes de Suomi NPP se considera incompleto. */
const PARTIAL_SNPP_RATIO = 0.5;

export const ymKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

function harmonizedValue(year: number, single: boolean, c: MonthCounts, cal: EngineCalibration): number {
  if (year < VIIRS_START_YEAR) return c.modisCd * (single ? cal.kTerra : cal.k);
  // Suomi NPP es la referencia. Si en el mes tiene menos de la mitad de lo que estima NOAA-20, el mes está incompleto
  // (p. ej. sin datos de Suomi NPP desde el 2 de noviembre de 2026) y se usa la estimación de NOAA-20.
  const fromNoaa20 = cal.kNoaa20 !== null ? c.noaa20Cd * cal.kNoaa20 : 0;
  return c.viirsCd >= fromNoaa20 * PARTIAL_SNPP_RATIO ? c.viirsCd : fromNoaa20;
}

/** Serie mensual 2000–untilYear en «unidades VIIRS»: MODIS × k antes de 2012, VIIRS después. */
export function harmonizedSeries(m: Map<string, MonthCounts>, cal: EngineCalibration, untilYear: number): CalendarCell[] {
  const cells: CalendarCell[] = [];
  for (let year = FIRST_YEAR; year <= untilYear; year++)
    for (let month = 1; month <= 12; month++) {
      const ym = ymKey(year, month);
      const c = m.get(ym) ?? emptyCounts();
      const singleSatellite = ym < AQUA_START;
      const harmonized = harmonizedValue(year, singleSatellite, c, cal);
      cells.push({ year, month, modis: c.modisRaw, viirs: c.viirsRaw, harmonized, value: harmonized, anomaly: null, singleSatellite });
    }
  return cells;
}
