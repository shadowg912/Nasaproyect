import type { CalendarCell } from "@/lib/types";
import type { EngineCalibration } from "./calibrate";
import { emptyCounts, type MonthCounts } from "./cells";

export const FIRST_YEAR = 2000;
/** Primer año de VIIRS (Suomi NPP). */
export const VIIRS_START_YEAR = 2012;
/** Antes de este mes solo había MODIS en Terra (Aqua empezó el 2002-07-04). */
export const AQUA_START = "2002-07";

export const ymKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

function harmonizedValue(year: number, single: boolean, c: MonthCounts, cal: EngineCalibration): number {
  if (year < VIIRS_START_YEAR) return c.modisCd * (single ? cal.kTerra : cal.k);
  if (c.viirsCd > 0) return c.viirsCd;
  if (c.noaa20Cd > 0 && cal.kNoaa20 !== null) return c.noaa20Cd * cal.kNoaa20;
  return 0;
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
