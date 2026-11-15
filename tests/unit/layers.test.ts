import { describe, expect, it } from "vitest";
import { availableOn, DEFAULT_BACKGROUND, GIBS_ALLOWED, LAYERS, layerById, tileUrls } from "@/lib/layers";

const count = (g: string) => LAYERS.filter((l) => l.group === g).length;

describe("registro de capas", () => {
  it("tiene los grupos de FIRMS completos", () => {
    expect(count("background")).toBe(6);
    expect(count("overlay")).toBe(7);
    expect(count("imagery")).toBe(7);
    expect(count("aerosol")).toBe(6);
    expect(count("fires")).toBe(5);
    expect(DEFAULT_BACKGROUND).toBe("esri-dark-gray");
  });

  it("toda capa de terceros declara su atribución y los ids son únicos", () => {
    for (const l of LAYERS.filter((x) => x.source !== "gibs")) expect(l.attribution.length).toBeGreaterThan(3);
    expect(new Set(LAYERS.map((l) => l.id)).size).toBe(LAYERS.length);
  });

  it("Suomi NPP no tiene datos después del 2026-11-02", () => {
    expect(availableOn(layerById("viirs-snpp")!, "2026-11-10")).toBe(false);
    expect(availableOn(layerById("viirs-snpp")!, "2026-10-10")).toBe(true);
    expect(availableOn(layerById("viirs-noaa20")!, "2026-11-15")).toBe(true);
  });

  it("las capas de la NASA pasan por el proxy local y las de Esri van directas", () => {
    expect(tileUrls(layerById("blue-marble")!, "2026-11-15")).toEqual(["/api/tiles/gibs/BlueMarble_ShadedRelief_Bathymetry/default/{z}/{y}/{x}"]);
    expect(tileUrls(layerById("viirs-noaa20")!, "2026-11-10")[0]).toBe("/api/tiles/gibs/VIIRS_NOAA20_CorrectedReflectance_TrueColor/2026-11-10/{z}/{y}/{x}");
    expect(tileUrls(layerById("reference-basic")!, "2026-11-10")).toHaveLength(2);
    expect(tileUrls(layerById("esri-dark-gray")!, "2026-11-10")[0]).toMatch(/^https:\/\/server\.arcgisonline\.com\/.+\{z\}\/\{y\}\/\{x\}$/);
    expect(GIBS_ALLOWED.has("VIIRS_NOAA20_Thermal_Anomalies_375m_All")).toBe(true);
    expect(GIBS_ALLOWED.has("Nada")).toBe(false);
  });
});
