import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempDb } from "../helpers";

let ctx: ReturnType<typeof tempDb>;
beforeEach(() => (ctx = tempDb()));
afterEach(() => ctx.cleanup());

const columns = (table: string) =>
  (ctx.db.$client.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

describe("esquema de historial por país y armonización", () => {
  it("fire_detections tiene país, tipo de fuego y familia de sensor", () => {
    expect(columns("fire_detections")).toEqual(expect.arrayContaining(["country_iso3", "fire_type", "sensor_family"]));
  });

  it("existen las tablas nuevas", () => {
    const tables = (ctx.db.$client.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
      (t) => t.name,
    );
    expect(tables).toEqual(
      expect.arrayContaining(["countries", "country_loads", "harmonized_monthly", "calibration", "context_cache"]),
    );
    expect(columns("harmonized_monthly")).toEqual(
      expect.arrayContaining(["region_key", "year", "month", "modis_raw", "viirs_raw", "modis_cd", "viirs_cd", "harmonized", "single_satellite"]),
    );
    expect(columns("calibration")).toEqual(expect.arrayContaining(["region_key", "k", "ci_lo", "ci_hi", "r2", "k_terra", "source"]));
  });

  it("una detección insertada sin país queda asignada a RD", () => {
    ctx.db.$client
      .prepare(
        `INSERT INTO fire_detections (id, source, satellite, instrument, latitude, longitude, acq_date, acq_time, acquired_at,
          confidence, confidence_raw, first_seen_at, updated_at)
         VALUES ('x', 'MODIS_SP', 'Terra', 'MODIS', 18.5, -70, '2005-01-02', '1513', '2005-01-02T15:13:00Z', 'nominal', '62', 'now', 'now')`,
      )
      .run();
    expect(ctx.db.$client.prepare("SELECT country_iso3 FROM fire_detections WHERE id='x'").get()).toEqual({ country_iso3: "DOM" });
  });
});
