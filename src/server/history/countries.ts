import fs from "node:fs";
import path from "node:path";
import bbox from "@turf/bbox";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { DB } from "@/db/client";

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

export function setCountryMode(db: DB, iso3: string, mode: "full" | "aggregate") {
  db.$client.prepare("UPDATE countries SET mode = ? WHERE iso3 = ?").run(mode, iso3);
}
