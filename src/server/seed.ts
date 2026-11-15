import fs from "node:fs";
import path from "node:path";
import type { DB } from "@/db/client";

interface GeoProps { id: number; code: string; name: string; province_id?: number | null; area_km2?: number }

/** Siembra (o actualiza) provincias y municipios desde los GeoJSON locales. */
export function seedTerritory(db: DB, geoDir: string) {
  const read = (f: string) =>
    (JSON.parse(fs.readFileSync(path.join(geoDir, f), "utf8")) as { features: { properties: GeoProps }[] }).features.map(
      (x) => x.properties,
    );
  const provinces = read("provinces.geojson");
  const municipalities = read("municipalities.geojson");
  const sqlite = db.$client;
  const up = sqlite.prepare(
    `INSERT INTO provinces (id, code, name, area_km2) VALUES (@id, @code, @name, @area_km2)
     ON CONFLICT(id) DO UPDATE SET code = excluded.code, name = excluded.name, area_km2 = excluded.area_km2`,
  );
  const um = sqlite.prepare(
    `INSERT INTO municipalities (id, code, name, province_id, area_km2) VALUES (@id, @code, @name, @province_id, @area_km2)
     ON CONFLICT(id) DO UPDATE SET code = excluded.code, name = excluded.name, province_id = excluded.province_id, area_km2 = excluded.area_km2`,
  );
  sqlite.transaction(() => {
    for (const p of provinces) up.run({ area_km2: null, ...p });
    for (const m of municipalities) um.run({ area_km2: null, province_id: null, ...m });
  })();
  return { provinces: provinces.length, municipalities: municipalities.length };
}
