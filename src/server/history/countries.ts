import fs from "node:fs";
import path from "node:path";
import bbox from "@turf/bbox";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { DB } from "@/db/client";
import type { CountryInfo, LoadJob } from "@/lib/types";

interface WorldProps {
  iso3: string;
  name: string;
  firmsName: string;
}

export interface CountryRow {
  iso3: string;
  nameEs: string;
  firmsName: string;
  bbox: [number, number, number, number];
  mode: "full" | "aggregate" | null;
}

/** Carga los países de `world.geojson` (Natural Earth) en la tabla `countries`. Conserva el `mode` ya calculado. */
export function seedCountries(db: DB, geoDir: string): number {
  const fc = JSON.parse(fs.readFileSync(path.join(geoDir, "world.geojson"), "utf8")) as FeatureCollection<Polygon | MultiPolygon, WorldProps>;
  const upsert = db.$client.prepare(`
    INSERT INTO countries (iso3, name_es, firms_name, bbox_json) VALUES (?, ?, ?, ?)
    ON CONFLICT(iso3) DO UPDATE SET name_es = excluded.name_es, firms_name = excluded.firms_name, bbox_json = excluded.bbox_json`);
  const run = db.$client.transaction((features: Feature<Polygon | MultiPolygon, WorldProps>[]) => {
    for (const f of features) upsert.run(f.properties.iso3, f.properties.name, f.properties.firmsName, JSON.stringify(bbox(f)));
  });
  run(fc.features);
  return fc.features.length;
}

export function getCountry(db: DB, iso3: string): CountryRow | null {
  const r = db.$client.prepare("SELECT iso3, name_es, firms_name, bbox_json, mode FROM countries WHERE iso3 = ?").get(iso3) as
    | { iso3: string; name_es: string; firms_name: string; bbox_json: string; mode: CountryRow["mode"] }
    | undefined;
  return r ? { iso3: r.iso3, nameEs: r.name_es, firmsName: r.firms_name, bbox: JSON.parse(r.bbox_json), mode: r.mode } : null;
}

/** Países del mapa global con su estado de carga. `jobOf` aporta el progreso de una carga en curso. */
export function listCountries(db: DB, jobOf: (iso3: string) => LoadJob | null = () => null): CountryInfo[] {
  const sqlite = db.$client;
  const loads = sqlite
    .prepare("SELECT iso3, product, MIN(year) AS a, MAX(year) AS b FROM country_loads WHERE state = 'done' GROUP BY iso3, product")
    .all() as { iso3: string; product: string; a: number; b: number }[];
  const until = new Map(
    (sqlite.prepare("SELECT country_iso3 AS iso3, MAX(acq_date) AS d FROM fire_detections GROUP BY country_iso3").all() as { iso3: string; d: string }[]).map(
      (r) => [r.iso3, r.d],
    ),
  );
  const countries = sqlite.prepare("SELECT iso3, name_es, mode FROM countries ORDER BY name_es").all() as {
    iso3: string;
    name_es: string;
    mode: CountryInfo["mode"];
  }[];
  return countries.map((c) => {
    const range = (product: string) => {
      const l = loads.find((x) => x.iso3 === c.iso3 && x.product === product);
      return l ? ([l.a, l.b] as [number, number]) : null;
    };
    const years = { modis: range("modis"), viirs: range("viirs-snpp") };
    const loaded = years.modis !== null || years.viirs !== null;
    const job = jobOf(c.iso3);
    const running = job && (job.state === "queued" || job.state === "running");
    return {
      iso3: c.iso3,
      name: c.name_es,
      loaded,
      mode: c.mode,
      progress: running ? (job.total ? job.done / job.total : 0) : loaded ? 1 : 0,
      years,
      dataUntil: until.get(c.iso3) ?? null,
    };
  });
}

export function setCountryMode(db: DB, iso3: string, mode: "full" | "aggregate") {
  db.$client.prepare("UPDATE countries SET mode = ? WHERE iso3 = ?").run(mode, iso3);
}
