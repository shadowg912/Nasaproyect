import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listCountries, seedCountries } from "@/server/history/countries";
import { importAreaFile, importCountry } from "@/server/history/importCountry";
import { getLoad, startLoad } from "@/server/history/jobs";
import { rebuildHarmonized } from "@/server/history/rebuild";
import { fixture, tempDb } from "../helpers";

let ctx: ReturnType<typeof tempDb>;
beforeEach(() => {
  ctx = tempDb();
  seedCountries(ctx.db, ctx.cfg.geoDir);
});
afterEach(() => ctx.cleanup());

const YEARS = { modis: [2005, 2006] as [number, number], viirs: [2015, 2015] as [number, number] };

/** FIRMS simulado: solo existen MODIS 2005 y VIIRS 2015 de RD; el resto responde 404. */
function firmsMock() {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    if (url.endsWith("/modis/2005/modis_2005_Dominican_Republic.csv")) return new Response(fixture("country-modis-2005.csv"));
    if (url.endsWith("/viirs-snpp/2015/viirs-snpp_2015_Dominican_Republic.csv")) return new Response(fixture("country-viirs-2015.csv"));
    return new Response("Not Found", { status: 404 });
  };
  return { impl, calls };
}

const count = (where = "1=1") =>
  (ctx.db.$client.prepare(`SELECT COUNT(*) AS n FROM fire_detections WHERE ${where}`).get() as { n: number }).n;

describe("países", () => {
  it("siembra los países del mapa mundial con su nombre en FIRMS", () => {
    expect(seedCountries(ctx.db, ctx.cfg.geoDir)).toBeGreaterThan(150);
    const dom = ctx.db.$client.prepare("SELECT name_es, firms_name FROM countries WHERE iso3='DOM'").get();
    expect(dom).toEqual({ name_es: "República Dominicana", firms_name: "Dominican_Republic" });
  });
});

describe("importación de archivos anuales por país", () => {
  it("importa MODIS y VIIRS, marca los años inexistentes y no duplica al repetir", async () => {
    const f = firmsMock();
    const r = await importCountry(ctx.db, ctx.cfg, "DOM", { fetchImpl: f.impl, years: YEARS });
    expect(r).toEqual({ rows: 6, mode: "full" });
    await importCountry(ctx.db, ctx.cfg, "DOM", { fetchImpl: f.impl, years: YEARS });
    expect(count()).toBe(6);
    expect(count("sensor_family='MODIS' AND fire_type=2")).toBe(1);
    expect(count("country_iso3='DOM' AND province_id IS NOT NULL")).toBeGreaterThan(0);
    const loads = ctx.db.$client.prepare("SELECT product, year, state FROM country_loads ORDER BY product, year").all();
    expect(loads).toEqual([
      { product: "modis", year: 2005, state: "done" },
      { product: "modis", year: 2006, state: "missing" },
      { product: "viirs-snpp", year: 2015, state: "done" },
    ]);
  });

  it("lee primero los archivos locales si existen", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fuego-raw-"));
    fs.mkdirSync(path.join(dir, "modis"));
    fs.writeFileSync(path.join(dir, "modis", "2005.csv"), fixture("country-modis-2005.csv"));
    const f = firmsMock();
    await importCountry(ctx.db, ctx.cfg, "DOM", { fetchImpl: f.impl, localDir: dir, years: { modis: [2005, 2005], viirs: [2015, 2014] } });
    expect(f.calls).toHaveLength(0);
    expect(count()).toBe(3);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("importAreaFile descarta los puntos fuera de RD", () => {
    const file = path.join(path.dirname(ctx.file), "area.csv");
    const header = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight";
    fs.writeFileSync(
      file,
      [header, "18.55,-72.33,330,0.4,0.4,2026-09-01,0630,N20,VIIRS,n,2.0NRT,290,3,N", "18.75,-70.16,330,0.4,0.4,2026-09-01,0630,N20,VIIRS,n,2.0NRT,290,3,N"].join("\n"),
    );
    expect(importAreaFile(ctx.db, file, "VIIRS_NOAA20_NRT", "DOM")).toBe(1);
  });
});

describe("trabajos de carga y reconstrucción", () => {
  it("startLoad es idempotente mientras la carga está en curso", async () => {
    const f = firmsMock();
    const a = startLoad(ctx.db, ctx.cfg, "DOM", { fetchImpl: f.impl, years: YEARS });
    const b = startLoad(ctx.db, ctx.cfg, "DOM", { fetchImpl: f.impl, years: YEARS });
    expect(b.jobId).toBe(a.jobId);
    await a.finished;
    expect(getLoad("DOM")?.state).toBe("done");
  });

  it("rebuildHarmonized escribe la serie del país y de sus provincias", async () => {
    await importCountry(ctx.db, ctx.cfg, "DOM", { fetchImpl: firmsMock().impl, years: YEARS });
    rebuildHarmonized(ctx.db, "DOM", 2015);
    const keys = (ctx.db.$client.prepare("SELECT DISTINCT region_key FROM harmonized_monthly").all() as { region_key: string }[]).map(
      (r) => r.region_key,
    );
    expect(keys).toContain("DOM");
    expect(keys.some((k) => k.startsWith("DOM:p:"))).toBe(true);
    const row = ctx.db.$client.prepare("SELECT modis_raw, viirs_raw FROM harmonized_monthly WHERE region_key='DOM' AND year=2005 AND month=1").get();
    expect(row).toEqual({ modis_raw: 3, viirs_raw: 0 });
  });
});

describe("lista de países para el mapa global", () => {
  it("marca RD como cargada con sus años y la fecha del último foco", async () => {
    await importCountry(ctx.db, ctx.cfg, "DOM", { fetchImpl: firmsMock().impl, years: YEARS });
    const list = listCountries(ctx.db);
    expect(list.length).toBeGreaterThan(150);
    expect(list.find((c) => c.iso3 === "DOM")).toEqual({
      iso3: "DOM", name: "República Dominicana", loaded: true, mode: "full", progress: 1,
      years: { modis: [2005, 2005], viirs: [2015, 2015] }, dataUntil: "2015-01-01",
    });
    expect(list.find((c) => c.iso3 === "HTI")).toMatchObject({ loaded: false, mode: null, progress: 0, dataUntil: null });
  });
});

describe("hallazgos de la revisión final", () => {
  it("una carga en la que fallan todos los archivos termina en error", async () => {
    const job = startLoad(ctx.db, ctx.cfg, "HTI", { fetchImpl: async () => new Response("caído", { status: 503 }), years: YEARS });
    await job.finished;
    expect(getLoad("HTI")).toMatchObject({ state: "error" });
    expect(getLoad("HTI")!.error).toMatch(/Fallaron/);
  });
});
