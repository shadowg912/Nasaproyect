import type { DB } from "@/db/client";
import type { NormalizedDetection } from "@/server/firms/csv";
import { classifyPoint, loadTerritory } from "@/server/geo";
import type { MonthCounts } from "@/server/harmonize/cells";

/** Inserta o actualiza detecciones con su país, tipo de fuego y familia de sensor. Devuelve las filas tratadas. */
export function saveDetections(
  db: DB,
  rows: NormalizedDetection[],
  opts: { iso3: string; geoDir: string; runId: number | null; onlyInCountry: boolean },
): number {
  const territory = opts.iso3 === "DOM" ? loadTerritory(opts.geoDir) : null;
  const upsert = db.$client.prepare(`
    INSERT INTO fire_detections (id, source, satellite, instrument, latitude, longitude, acq_date, acq_time, acquired_at,
      brightness, bright_t31, scan, track, frp, confidence, confidence_raw, version, daynight,
      province_id, municipality_id, ingestion_run_id, first_seen_at, updated_at, country_iso3, fire_type, sensor_family)
    VALUES (@id, @source, @satellite, @instrument, @latitude, @longitude, @acqDate, @acqTime, @acquiredAt,
      @brightness, @brightnessT31, @scan, @track, @frp, @confidence, @confidenceRaw, @version, @daynight,
      @provinceId, @municipalityId, @runId, @now, @now, @iso3, @fireType, @sensorFamily)
    ON CONFLICT(id) DO UPDATE SET
      fire_type = excluded.fire_type, sensor_family = excluded.sensor_family, country_iso3 = excluded.country_iso3,
      province_id = excluded.province_id, municipality_id = excluded.municipality_id, updated_at = excluded.updated_at
    WHERE fire_detections.fire_type IS NOT excluded.fire_type OR fire_detections.sensor_family IS NOT excluded.sensor_family
      OR fire_detections.province_id IS NOT excluded.province_id`);
  const now = new Date().toISOString();
  let saved = 0;
  const run = db.$client.transaction(() => {
    for (const r of rows) {
      const c = territory ? classifyPoint(territory, r.latitude, r.longitude) : null;
      if (opts.onlyInCountry && c && !c.inCountry) continue;
      upsert.run({ ...r, provinceId: c?.provinceId ?? null, municipalityId: c?.municipalityId ?? null, runId: opts.runId, now, iso3: opts.iso3 });
      saved++;
    }
  });
  run();
  return saved;
}

export function recordCoverage(db: DB, source: string, from: string, to: string, rows: number, runId: number | null) {
  db.$client
    .prepare(
      `INSERT INTO ingestion_coverage (source, date_from, date_to, row_count, run_id, fetched_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(source, date_from, date_to) DO UPDATE SET row_count = excluded.row_count, run_id = excluded.run_id, fetched_at = excluded.fetched_at`,
    )
    .run(source, from, to, rows, runId, new Date().toISOString());
}

/** Modo agregado: suma los conteos mensuales de un archivo a la fila del país en `harmonized_monthly`. */
export function addMonthlyCounts(db: DB, regionKey: string, counts: Map<string, MonthCounts>) {
  const add = db.$client.prepare(`
    INSERT INTO harmonized_monthly (region_key, year, month, modis_raw, viirs_raw, modis_cd, viirs_cd, terra_cd, noaa20_cd)
    VALUES (@regionKey, @year, @month, @modisRaw, @viirsRaw, @modisCd, @viirsCd, @terraCd, @noaa20Cd)
    ON CONFLICT(region_key, year, month) DO UPDATE SET
      modis_raw = modis_raw + excluded.modis_raw, viirs_raw = viirs_raw + excluded.viirs_raw,
      modis_cd = modis_cd + excluded.modis_cd, viirs_cd = viirs_cd + excluded.viirs_cd,
      terra_cd = terra_cd + excluded.terra_cd, noaa20_cd = noaa20_cd + excluded.noaa20_cd`);
  const run = db.$client.transaction(() => {
    for (const [ym, c] of counts) add.run({ regionKey, year: Number(ym.slice(0, 4)), month: Number(ym.slice(5, 7)), ...c });
  });
  run();
}
