import type { DB } from "@/db/client";
import { calibrate, type EngineCalibration } from "@/server/harmonize/calibrate";
import { type CellDetection, cellKey, emptyCounts, type MonthCounts, monthlyCounts } from "@/server/harmonize/cells";
import { harmonizedSeries, VIIRS_START_YEAR, ymKey } from "@/server/harmonize/series";
import { DEDUPE } from "@/server/queries";
import { getCountry } from "./countries";

interface Row {
  lat: number;
  lon: number;
  acq_date: string;
  sensor_family: "MODIS" | "VIIRS" | null;
  instrument: string;
  satellite: string;
  confidence: CellDetection["confidence"];
  fire_type: number | null;
  province_id: number | null;
  municipality_id: number | null;
}

/** Generador determinista (los IC del bootstrap no cambian entre reconstrucciones). */
const seededRng = (seed = 42) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

export const overlapFor = (untilYear: number): [number, number] => [VIIRS_START_YEAR, untilYear - 1];

function loadGroups(db: DB, iso3: string): Map<string, CellDetection[]> {
  const rows = db.$client
    .prepare(
      `SELECT latitude AS lat, longitude AS lon, acq_date, sensor_family, instrument, satellite, confidence, fire_type, province_id, municipality_id
       FROM fire_detections d WHERE country_iso3 = ? AND ${DEDUPE}`,
    )
    .all(iso3) as Row[];
  const staticCells = new Set(rows.filter((r) => r.fire_type === 2).map((r) => cellKey(r.lat, r.lon)));
  const groups = new Map<string, CellDetection[]>([[iso3, []]]);
  const push = (key: string, d: CellDetection) => (groups.get(key) ?? groups.set(key, []).get(key)!).push(d);
  for (const r of rows) {
    const d: CellDetection = {
      lat: r.lat,
      lon: r.lon,
      acqDate: r.acq_date,
      family: r.sensor_family ?? (r.instrument.toUpperCase().includes("MODIS") ? "MODIS" : "VIIRS"),
      satellite: r.satellite,
      confidence: r.confidence,
      fireType: r.fire_type,
      staticCell: r.fire_type === null && staticCells.has(cellKey(r.lat, r.lon)),
    };
    push(iso3, d);
    if (r.province_id !== null) push(`${iso3}:p:${r.province_id}`, d);
    if (r.municipality_id !== null) push(`${iso3}:m:${r.municipality_id}`, d);
  }
  return groups;
}

function aggregatedCounts(db: DB, iso3: string): Map<string, MonthCounts> {
  const rows = db.$client
    .prepare("SELECT year, month, modis_raw, viirs_raw, modis_cd, viirs_cd, terra_cd, noaa20_cd FROM harmonized_monthly WHERE region_key = ?")
    .all(iso3) as { year: number; month: number; modis_raw: number; viirs_raw: number; modis_cd: number; viirs_cd: number; terra_cd: number; noaa20_cd: number }[];
  return new Map(
    rows.map((r) => [
      ymKey(r.year, r.month),
      { modisRaw: r.modis_raw, viirsRaw: r.viirs_raw, modisCd: r.modis_cd, viirsCd: r.viirs_cd, terraCd: r.terra_cd, noaa20Cd: r.noaa20_cd },
    ]),
  );
}

function write(db: DB, key: string, counts: Map<string, MonthCounts>, cal: EngineCalibration | null, untilYear: number) {
  const sqlite = db.$client;
  const upsert = sqlite.prepare(`
    INSERT OR REPLACE INTO harmonized_monthly (region_key, year, month, modis_raw, viirs_raw, modis_cd, viirs_cd, terra_cd, noaa20_cd, harmonized, single_satellite)
    VALUES (@key, @year, @month, @modisRaw, @viirsRaw, @modisCd, @viirsCd, @terraCd, @noaa20Cd, @harmonized, @single)`);
  const series = cal ? harmonizedSeries(counts, cal, untilYear) : null;
  for (let year = 2000, i = 0; year <= untilYear; year++)
    for (let month = 1; month <= 12; month++, i++) {
      const c = counts.get(ymKey(year, month)) ?? emptyCounts();
      upsert.run({ key, year, month, ...c, harmonized: series ? series[i].harmonized : null, single: ymKey(year, month) < "2002-07" ? 1 : 0 });
    }
  if (cal)
    sqlite
      .prepare(
        `INSERT OR REPLACE INTO calibration (region_key, k, ci_lo, ci_hi, r2, k_terra, overlap_from, overlap_to, source, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(key, cal.k, cal.ci[0], cal.ci[1], cal.r2, cal.kTerra, cal.overlapYears[0], cal.overlapYears[1], cal.source, new Date().toISOString());
}

/** Reconstruye la serie armonizada del país y, para RD, de cada provincia y municipio. Devuelve la calibración del país. */
export function rebuildHarmonized(db: DB, iso3: string, untilYear = new Date().getUTCFullYear()): EngineCalibration | null {
  const overlap = overlapFor(untilYear);
  const aggregate = getCountry(db, iso3)?.mode === "aggregate";
  const groups: Map<string, Map<string, MonthCounts>> = aggregate
    ? new Map([[iso3, aggregatedCounts(db, iso3)]])
    : new Map([...loadGroups(db, iso3)].map(([k, ds]) => [k, monthlyCounts(ds)]));
  const countryCal = calibrate(groups.get(iso3)!, overlap, seededRng());
  const tx = db.$client.transaction(() => {
    for (const [key, counts] of groups) {
      const own = key === iso3 ? countryCal : calibrate(counts, overlap, seededRng());
      const cal = own ?? (countryCal ? { ...countryCal, source: "country" as const } : null);
      write(db, key, counts, cal, untilYear);
    }
  });
  tx();
  return countryCal;
}
