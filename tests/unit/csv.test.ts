import { describe, expect, it } from "vitest";
import { detectionId, normalizeConfidence, parseFirmsCsv, FirmsResponseError } from "@/server/firms/csv";
import { fixture, HEADER } from "../helpers";

describe("parseFirmsCsv", () => {
  it("normaliza registros válidos y rechaza filas inválidas", () => {
    const r = parseFirmsCsv(fixture("area-viirs.csv"), "VIIRS_NOAA20_NRT");
    expect(r.totalRows).toBe(6);
    expect(r.rejected).toBe(1);
    expect(r.records).toHaveLength(5);
    const first = r.records[0];
    expect(first).toMatchObject({
      latitude: 18.4861,
      longitude: -69.9312,
      acqDate: "2026-11-13",
      acqTime: "0612",
      acquiredAt: "2026-11-13T06:12:00Z",
      satellite: "N20",
      confidence: "nominal",
      brightness: 330.5,
      brightnessT31: 290.1,
      frp: 4.2,
      daynight: "N",
    });
    // acq_time sin ceros a la izquierda
    expect(r.records[4].acqTime).toBe("0600");
  });

  it("acepta un CSV con solo encabezado (cero detecciones)", () => {
    expect(parseFirmsCsv(HEADER, "VIIRS_SNPP_NRT").records).toEqual([]);
  });

  it("rechaza respuestas que no son CSV de FIRMS", () => {
    expect(() => parseFirmsCsv("Invalid MAP_KEY.", "X")).toThrow(FirmsResponseError);
    expect(() => parseFirmsCsv("<html><body>Error</body></html>", "X")).toThrow(FirmsResponseError);
    expect(() => parseFirmsCsv("", "X")).toThrow(FirmsResponseError);
  });

  it("acepta el formato del feed público (sin columna instrument, confianza en palabras)", () => {
    const csv = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight\n" +
      "18.5,-70.0,300,0.4,0.4,2026-11-10,0606,N21,high,2.0NRT,290,5,N\n";
    const r = parseFirmsCsv(csv, "VIIRS_NOAA21_NRT");
    expect(r.records[0]).toMatchObject({ instrument: "VIIRS", confidence: "high" });
  });
});

describe("normalizeConfidence", () => {
  it.each([
    ["n", "nominal"], ["l", "low"], ["h", "high"], ["nominal", "nominal"], ["15", "low"], ["50", "nominal"], ["95", "high"], ["x", null], ["", null],
  ])("%s → %s", (raw, expected) => expect(normalizeConfidence(raw)).toBe(expected));
});

describe("detectionId", () => {
  it("es determinístico e independiente de la precisión de entrada", () => {
    expect(detectionId("S", 18.4861, -69.9312, "2026-11-13", "0612", "N20")).toBe(
      detectionId("S", 18.48610, -69.93120, "2026-11-13", "0612", "N20"),
    );
    expect(detectionId("S", 18.4861, -69.9312, "2026-11-13", "0612", "N20")).not.toBe(
      detectionId("S", 18.4861, -69.9312, "2026-11-13", "0613", "N20"),
    );
  });
});

describe("tipo de fuego y familia de sensor", () => {
  it("lee la columna type de los archivos anuales por país", () => {
    const r = parseFirmsCsv(fixture("country-modis-2005.csv"), "MODIS_SP");
    expect(r.records.map((d) => d.fireType)).toEqual([2, 0, 0]);
    expect(r.records.every((d) => d.sensorFamily === "MODIS")).toBe(true);
  });

  it("deja fireType en null cuando el CSV no trae type (NRT)", () => {
    const r = parseFirmsCsv(fixture("area-viirs.csv"), "VIIRS_NOAA20_NRT");
    expect(r.records.length).toBeGreaterThan(0);
    expect(r.records.every((d) => d.fireType === null && d.sensorFamily === "VIIRS")).toBe(true);
  });
});
