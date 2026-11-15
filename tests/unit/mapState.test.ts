import { describe, expect, it } from "vitest";
import { decodeState, defaultState, encodeState, periodBounds } from "@/lib/map/state";
import { buildStyle, fireAgeColor, fireColorExpression } from "@/lib/map/style";

const TODAY = "2026-11-15";

describe("estado del mapa en la URL", () => {
  it("ida y vuelta conserva el estado", () => {
    const s = { ...defaultState("global", TODAY), center: [-70.12, 18.5] as [number, number], zoom: 6.5, imagery: ["viirs-noaa20"], aerosol: "omps-noaa20", fireStyle: "confidence" as const, projection: "globe" as const, iso3: "HTI" };
    expect(decodeState(encodeState(s), "global", TODAY)).toEqual(s);
  });

  it("ignora parámetros inválidos y usa los valores por defecto", () => {
    const d = defaultState("local", TODAY);
    const s = decodeState("bg=nope&ov=x,reference-basic&z=abc&d=2099-01-01&st=raro&fs=fires-modis-aqua,zzz", "local", TODAY);
    expect(s.background).toBe(d.background);
    expect(s.overlays).toEqual(["reference-basic"]);
    expect(s.zoom).toBe(d.zoom);
    expect(s.date).toBe(TODAY);
    expect(s.fireStyle).toBe("age");
    expect(s.fireSats).toEqual(["fires-modis-aqua"]);
    expect(d).toMatchObject({ iso3: "DOM", background: "esri-dark-gray", fireStyle: "age", center: [-70.2, 18.9] });
  });

  it("periodBounds calcula el periodo de la línea de tiempo", () => {
    expect(periodBounds("2026-11-15", "week")).toEqual({ from: "2026-11-09", to: "2026-11-15", end: "2026-11-15T23:59:59Z" });
    expect(periodBounds("2026-11-15", "48h")).toMatchObject({ from: "2026-11-14", to: "2026-11-15" });
    expect(periodBounds("2026-11-15", "24h")).toMatchObject({ from: "2026-11-15", to: "2026-11-15" });
  });
});

describe("estilo MapLibre", () => {
  it("usa la fecha en las capas con fecha y omite las que no tienen datos ese día", () => {
    const s = { ...defaultState("global", "2026-11-10"), imagery: ["viirs-noaa20", "viirs-snpp"] };
    const json = JSON.stringify(buildStyle(s, { offline: false }));
    expect(json).toContain("/api/tiles/gibs/VIIRS_NOAA20_CorrectedReflectance_TrueColor/2026-11-10/");
    expect(json).not.toContain("VIIRS_SNPP_CorrectedReflectance_TrueColor");
    expect(json).toContain("server.arcgisonline.com");
  });

  it("sin Internet no contiene ninguna URL remota", () => {
    const s = { ...defaultState("global", TODAY), overlays: ["reference-basic", "protected-areas"] };
    expect(JSON.stringify(buildStyle(s, { offline: true }))).not.toMatch(/https?:\/\//);
  });

  it("colorea los focos por antigüedad respecto al fin del periodo", () => {
    expect(fireAgeColor("2026-11-15T23:29:59Z", "2026-11-15T23:59:59Z")).toBe("#8b0000");
    expect(fireAgeColor("2026-11-14T17:59:59Z", "2026-11-15T23:59:59Z")).toBe("#d9d2b5");
    expect(JSON.stringify(fireColorExpression("confidence", "2026-11-15T23:59:59Z"))).toContain("nominal");
  });
});
