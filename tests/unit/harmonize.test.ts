import { describe, expect, it } from "vitest";
import { type CellDetection, isValid, monthlyCounts } from "@/server/harmonize/cells";
import { calibrate } from "@/server/harmonize/calibrate";
import { harmonizedSeries } from "@/server/harmonize/series";
import { monthStats, withAnomaly } from "@/server/harmonize/stats";
import type { CalendarCell } from "@/lib/types";

const det = (o: Partial<CellDetection>): CellDetection => ({
  lat: 18.5,
  lon: -70.2,
  acqDate: "2015-03-10",
  family: "VIIRS",
  satellite: "N",
  confidence: "nominal",
  fireType: 0,
  ...o,
});

/** Meses sintéticos del solape donde VIIRS = factor × MODIS exacto. */
function overlap(factor: number, years: [number, number] = [2012, 2025]) {
  const m: ReturnType<typeof monthlyCounts> = new Map();
  for (let y = years[0]; y <= years[1]; y++)
    for (let mo = 1; mo <= 12; mo++) {
      const modisCd = 5 + ((y * 7 + mo * 3) % 11);
      m.set(`${y}-${String(mo).padStart(2, "0")}`, {
        modisRaw: modisCd * 2,
        viirsRaw: modisCd * factor * 3,
        modisCd,
        viirsCd: modisCd * factor,
        terraCd: modisCd / 2,
        noaa20Cd: modisCd * factor,
      });
    }
  return m;
}

const rng = (() => {
  let s = 42;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
})();

describe("celdas-día", () => {
  it("cuenta una vez por celda y día, pero conserva el conteo crudo", () => {
    const m = monthlyCounts([det({}), det({ lat: 18.5004 }), det({ acqDate: "2015-03-11" })]);
    expect(m.get("2015-03")).toMatchObject({ viirsRaw: 3, viirsCd: 2 });
  });

  it("excluye fuentes fijas, confianza baja y celdas marcadas como fijas", () => {
    expect(isValid(det({ fireType: 2 }))).toBe(false);
    expect(isValid(det({ confidence: "low" }))).toBe(false);
    expect(isValid(det({ fireType: null, staticCell: true }))).toBe(false);
    expect(isValid(det({ fireType: null }))).toBe(true);
    const m = monthlyCounts([det({ fireType: 2 }), det({ confidence: "low" })]);
    expect(m.get("2015-03")).toMatchObject({ viirsRaw: 2, viirsCd: 0 });
  });

  it("separa MODIS, Terra y NOAA-20", () => {
    const m = monthlyCounts([
      det({ family: "MODIS", satellite: "Terra" }),
      det({ family: "MODIS", satellite: "Aqua", lat: 18.7 }),
      det({ satellite: "N20" }),
    ]);
    expect(m.get("2015-03")).toMatchObject({ modisCd: 2, terraCd: 1, viirsCd: 0, noaa20Cd: 1 });
  });
});

describe("calibración en el solape", () => {
  it("recupera k exacto con R² = 1 e intervalo que lo contiene", () => {
    const cal = calibrate(overlap(3), [2012, 2025], rng)!;
    expect(cal.k).toBeCloseTo(3, 9);
    expect(cal.r2).toBeCloseTo(1, 9);
    expect(cal.ci[0]).toBeLessThanOrEqual(3);
    expect(cal.ci[1]).toBeGreaterThanOrEqual(3);
    expect(cal.kTerra).toBeCloseTo(6, 9);
    expect(cal.kNoaa20).toBeCloseTo(1, 9);
    expect(cal.overlapYears).toEqual([2012, 2025]);
  });

  it("devuelve null con menos de 12 meses de solape", () => {
    const m = overlap(3, [2012, 2012]);
    m.delete("2012-12");
    expect(calibrate(m, [2012, 2025], rng)).toBeNull();
  });
});

describe("serie armonizada", () => {
  const cal = { k: 3, ci: [2.8, 3.2] as [number, number], r2: 0.9, overlapYears: [2012, 2025] as [number, number], kTerra: 6, kNoaa20: 1.1, source: "region" as const };

  it("escala MODIS antes de 2012 y usa VIIRS después", () => {
    const m: ReturnType<typeof monthlyCounts> = new Map([
      ["2011-06", { modisRaw: 25, viirsRaw: 0, modisCd: 10, viirsCd: 0, terraCd: 6, noaa20Cd: 0 }],
      ["2013-06", { modisRaw: 25, viirsRaw: 90, modisCd: 10, viirsCd: 31, terraCd: 6, noaa20Cd: 30 }],
    ]);
    const cells = harmonizedSeries(m, cal, 2013);
    const at = (y: number, mo: number) => cells.find((c) => c.year === y && c.month === mo)!;
    expect(at(2011, 6)).toMatchObject({ harmonized: 30, modis: 25, viirs: 0, singleSatellite: false });
    expect(at(2013, 6).harmonized).toBe(31);
    expect(cells).toHaveLength(14 * 12);
    expect(at(2000, 1)).toMatchObject({ harmonized: 0, modis: 0 });
  });

  it("usa kTerra en los meses de un solo satélite (antes de julio de 2002)", () => {
    const m: ReturnType<typeof monthlyCounts> = new Map([
      ["2001-03", { modisRaw: 8, viirsRaw: 0, modisCd: 4, viirsCd: 0, terraCd: 4, noaa20Cd: 0 }],
      ["2002-07", { modisRaw: 8, viirsRaw: 0, modisCd: 4, viirsCd: 0, terraCd: 2, noaa20Cd: 0 }],
    ]);
    const cells = harmonizedSeries(m, cal, 2002);
    expect(cells.find((c) => c.year === 2001 && c.month === 3)).toMatchObject({ harmonized: 24, singleSatellite: true });
    expect(cells.find((c) => c.year === 2002 && c.month === 7)).toMatchObject({ harmonized: 12, singleSatellite: false });
  });

  it("cubre con NOAA-20 los meses recientes sin Suomi NPP", () => {
    const m: ReturnType<typeof monthlyCounts> = new Map([
      ["2026-11", { modisRaw: 5, viirsRaw: 40, modisCd: 3, viirsCd: 0, terraCd: 1, noaa20Cd: 20 }],
    ]);
    const cells = harmonizedSeries(m, cal, 2026);
    expect(cells.find((c) => c.year === 2026 && c.month === 11)!.harmonized).toBeCloseTo(22, 9);
  });
});

describe("mediana y anomalías", () => {
  const cell = (year: number, month: number, value: number): CalendarCell => ({
    year, month, modis: 0, viirs: 0, harmonized: value, value, anomaly: null, singleSatellite: false,
  });

  it("calcula mediana y percentiles por mes en la línea base", () => {
    const cells = [cell(2003, 3, 10), cell(2004, 3, 20), cell(2005, 3, 30), cell(2010, 3, 1000)];
    const stats = monthStats(cells, [2003, 2005]);
    expect(stats).toHaveLength(12);
    expect(stats[2]).toEqual({ month: 3, median: 20, p25: 15, p75: 25 });
    expect(stats[0]).toEqual({ month: 1, median: 0, p25: 0, p75: 0 });
  });

  it("anomalía = valor / mediana y null si la mediana es 0", () => {
    const cells = [cell(2003, 3, 10), cell(2004, 3, 10), cell(2006, 3, 20), cell(2006, 1, 5)];
    const out = withAnomaly(cells, monthStats(cells, [2003, 2004]));
    expect(out.find((c) => c.year === 2006 && c.month === 3)!.anomaly).toBe(2);
    expect(out.find((c) => c.month === 1)!.anomaly).toBeNull();
    expect(cells[2].anomaly).toBeNull();
  });
});
