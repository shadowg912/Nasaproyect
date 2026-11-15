import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { csvRow, exportCsv } from "@/server/export";
import { getCalendar } from "@/server/calendar";
import type { NormalizedDetection } from "@/server/firms/csv";
import { seedCountries } from "@/server/history/countries";
import { rebuildHarmonized } from "@/server/history/rebuild";
import { saveDetections } from "@/server/history/store";
import { HttpError } from "@/server/http";
import { parseRegion } from "@/server/region";
import { tempDb } from "../helpers";

let ctx: ReturnType<typeof tempDb>;
const NOW = new Date("2014-06-15T12:00:00Z");

function mk(date: string, family: "MODIS" | "VIIRS", lat: number, lon: number, satellite = family === "MODIS" ? "Aqua" : "N"): NormalizedDetection {
  const time = "1800";
  return {
    id: `${family}-${date}-${lat}-${lon}`,
    source: family === "MODIS" ? "MODIS_SP" : "VIIRS_SNPP_SP",
    satellite,
    instrument: family,
    latitude: lat,
    longitude: lon,
    acqDate: date,
    acqTime: time,
    acquiredAt: `${date}T18:00:00Z`,
    brightness: 320,
    brightnessT31: 300,
    scan: 1,
    track: 1,
    frp: 5,
    confidence: "nominal",
    confidenceRaw: "n",
    version: "6.1",
    daynight: "D",
    fireType: 0,
    sensorFamily: family,
  };
}

/** Santo Domingo: 1 MODIS por mes 2005–2014 y, desde 2012, 3 VIIRS en celdas distintas. Más un foco aislado en Pedernales (2005). */
function seed() {
  const rows: NormalizedDetection[] = [];
  for (let y = 2005; y <= 2014; y++)
    for (let m = 1; m <= 12; m++) {
      const date = `${y}-${String(m).padStart(2, "0")}-10`;
      rows.push(mk(date, "MODIS", 18.48, -69.93));
      if (y >= 2012) for (let i = 0; i < 3; i++) rows.push(mk(date, "VIIRS", 18.48 + i * 0.02, -69.93));
    }
  rows.push(mk("2005-03-10", "MODIS", 18.04, -71.74));
  saveDetections(ctx.db, rows, { iso3: "DOM", geoDir: ctx.cfg.geoDir, runId: null, onlyInCountry: true });
  rebuildHarmonized(ctx.db, "DOM", 2014);
}

beforeEach(() => {
  ctx = tempDb();
  seedCountries(ctx.db, ctx.cfg.geoDir);
  seed();
});
afterEach(() => ctx.cleanup());

describe("calendario armonizado", () => {
  it("devuelve celdas ordenadas 2000–año actual con la calibración del país", () => {
    const cal = getCalendar(ctx.db, { iso3: "DOM" }, "harmonized", NOW);
    expect(cal.cells).toHaveLength(15 * 12);
    expect(cal.cells[0]).toMatchObject({ year: 2000, month: 1 });
    expect(cal.cells.at(-1)).toMatchObject({ year: 2014, month: 12 });
    expect(cal.calibration).toMatchObject({ k: 3, r2: 1, source: "region", overlapYears: [2012, 2013] });
    expect(cal.cells.find((c) => c.year === 2010 && c.month === 4)).toMatchObject({ modis: 1, harmonized: 3, value: 3 });
    expect(cal.current).toMatchObject({ year: 2014, month: 5, value: 3, median: 3, ratio: 1 });
    expect(cal.validation.length).toBeGreaterThan(0);
  });

  it("en modo crudo pinta MODIS antes de 2012 y VIIRS después", () => {
    const cal = getCalendar(ctx.db, { iso3: "DOM" }, "raw", NOW);
    const at = (y: number, m: number) => cal.cells.find((c) => c.year === y && c.month === m)!;
    expect(at(2011, 5).value).toBe(1);
    expect(at(2012, 5).value).toBe(3);
  });

  it("un área sin focos da ceros y anomalías nulas, sin errores", () => {
    const cal = getCalendar(ctx.db, { iso3: "DOM", aoi: "-60,10,-59,11" }, "harmonized", NOW);
    expect(cal.cells.every((c) => c.value === 0 && c.anomaly === null)).toBe(true);
    expect(cal.current).toMatchObject({ value: 0, ratio: null });
    expect(cal.calibration?.source).toBe("country");
  });

  it("un municipio sin solape MODIS/VIIRS usa la calibración del país", () => {
    const id = (ctx.db.$client.prepare("SELECT municipality_id AS id FROM fire_detections WHERE latitude = 18.04").get() as { id: number }).id;
    const cal = getCalendar(ctx.db, { iso3: "DOM", municipalityId: id }, "harmonized", NOW);
    expect(cal.calibration).toMatchObject({ k: 3, source: "country" });
    expect(cal.cells.find((c) => c.year === 2005 && c.month === 3)!.harmonized).toBe(3);
  });

  it("filtra por rango de fechas", () => {
    const cal = getCalendar(ctx.db, { iso3: "DOM", from: "2010-01-01", to: "2010-12-31" }, "harmonized", NOW);
    expect(cal.cells).toHaveLength(12);
    expect(cal.cells.every((c) => c.year === 2010)).toBe(true);
  });
});

describe("región y exportación", () => {
  it("rechaza un área de interés inválida con 400", () => {
    expect(() => parseRegion(new URLSearchParams("aoi=1,2,3"))).toThrow(HttpError);
    expect(() => parseRegion(new URLSearchParams("aoi=-60,11,-59,10"))).toThrow(HttpError);
    expect(parseRegion(new URLSearchParams("iso3=hti&provinceId=x"))).toEqual({ iso3: "HTI" });
  });

  it("escapa comas y comillas en el CSV", () => {
    expect(csvRow(["San Juan, RD", 'dijo "hola"', 3, null])).toBe('"San Juan, RD","dijo ""hola""",3,');
  });

  it("exporta focos y tabla mensual con encabezados en español", () => {
    const det = exportCsv(ctx.db, { iso3: "DOM", from: "2014-01-01", to: "2014-01-31" }, "detections").split("\n");
    expect(det[0]).toBe("fecha,hora_utc,latitud,longitud,sensor,satelite,confianza,frp,tipo,provincia,municipio");
    expect(det.filter(Boolean)).toHaveLength(1 + 4);
    const monthly = exportCsv(ctx.db, { iso3: "DOM", from: "2014-01-01", to: "2014-12-31" }, "monthly", NOW).split("\n");
    expect(monthly[0]).toBe("anio,mes,modis_crudo,viirs_crudo,armonizado,anomalia");
    expect(monthly[1].startsWith("2014,1,1,3,3,")).toBe(true);
  });
});
