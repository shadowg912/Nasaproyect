import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CalendarResponse, CountryInfo, DetectionContext, LoadJob } from "@/lib/types";

const load = <T>(name: string): T =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "api", `${name}.json`), "utf8")) as T;

function isCalendarResponse(x: unknown): x is CalendarResponse {
  const r = x as CalendarResponse;
  return (
    (r.mode === "harmonized" || r.mode === "raw") &&
    typeof r.region?.iso3 === "string" &&
    Array.isArray(r.cells) &&
    r.cells.every(
      (c) =>
        Number.isInteger(c.year) &&
        c.month >= 1 &&
        c.month <= 12 &&
        typeof c.modis === "number" &&
        typeof c.viirs === "number" &&
        typeof c.value === "number" &&
        typeof c.singleSatellite === "boolean",
    ) &&
    Array.isArray(r.monthStats) &&
    r.monthStats.length === 12 &&
    Array.isArray(r.validation) &&
    "calibration" in r &&
    "current" in r
  );
}

describe("contrato de API: datos de ejemplo para la interfaz", () => {
  it("calendar-dom es un calendario armonizado 2000–2025 completo", () => {
    const cal = load<CalendarResponse>("calendar-dom");
    expect(isCalendarResponse(cal)).toBe(true);
    expect(cal.mode).toBe("harmonized");
    expect(cal.cells).toHaveLength(312);
    expect(cal.cells[0]).toMatchObject({ year: 2000, month: 1 });
    expect(cal.cells.at(-1)).toMatchObject({ year: 2025, month: 12 });
    expect(cal.calibration).not.toBeNull();
  });

  it("calendar-dom-raw empalma MODIS hasta 2011 y VIIRS desde 2012", () => {
    const cal = load<CalendarResponse>("calendar-dom-raw");
    expect(isCalendarResponse(cal)).toBe(true);
    expect(cal.mode).toBe("raw");
    const at = (y: number, m: number) => cal.cells.find((c) => c.year === y && c.month === m)!;
    expect(at(2011, 3).value).toBe(at(2011, 3).modis);
    expect(at(2012, 3).value).toBe(at(2012, 3).viirs);
  });

  it("countries incluye RD cargada", () => {
    const countries = load<CountryInfo[]>("countries");
    const dom = countries.find((c) => c.iso3 === "DOM");
    expect(dom).toMatchObject({ loaded: true, mode: "full" });
    expect(dom!.years.modis).toEqual([2000, 2025]);
  });

  it("context y load-progress tienen la forma del contrato", () => {
    const ctx = load<DetectionContext>("context");
    expect(["alta", "media", "baja"]).toContain(ctx.cause.likelihood);
    expect(Array.isArray(ctx.cause.reasons)).toBe(true);
    const job = load<LoadJob>("load-progress");
    expect(["queued", "running", "done", "error"]).toContain(job.state);
  });
});
