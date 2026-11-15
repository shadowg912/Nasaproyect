import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fetchGibsTile, gibsUpstreamUrl } from "@/server/tiles/gibs";

let dir: string;
beforeEach(() => (dir = fs.mkdtempSync(path.join(os.tmpdir(), "gibs-"))));
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
function mock(status = 200) {
  const calls: string[] = [];
  return { calls, impl: async (url: string) => (calls.push(url), new Response(status === 200 ? png : "no", { status, headers: { "content-type": status === 200 ? "image/png" : "text/html" } })) };
}
const NOW = new Date("2026-11-15T12:00:00Z");

describe("proxy de teselas GIBS", () => {
  it("arma la URL WMTS y la WMS de focos", () => {
    expect(gibsUpstreamUrl("BlueMarble_ShadedRelief_Bathymetry", "default", 2, 1, 1)).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/default/GoogleMapsCompatible_Level8/2/1/1.jpeg",
    );
    const wms = gibsUpstreamUrl("VIIRS_NOAA20_Thermal_Anomalies_375m_All", "2026-11-14", 1, 0, 0);
    expect(wms).toContain("/wms/epsg3857/best/wms.cgi?");
    expect(wms).toContain("LAYERS=VIIRS_NOAA20_Thermal_Anomalies_375m_All");
    expect(wms).toContain("TIME=2026-11-14");
    expect(wms).toContain("BBOX=-20037508.34,0,0,20037508.34");
  });

  it("rechaza capas fuera de la lista, zoom excesivo y fechas inválidas sin llamar a GIBS", async () => {
    const f = mock();
    expect(await fetchGibsTile("Inventada", "default", 1, 0, 0, { fetchImpl: f.impl, cacheDir: dir, now: NOW })).toBeNull();
    expect(await fetchGibsTile("BlueMarble_ShadedRelief_Bathymetry", "default", 12, 0, 0, { fetchImpl: f.impl, cacheDir: dir, now: NOW })).toBeNull();
    expect(await fetchGibsTile("MODIS_Terra_CorrectedReflectance_TrueColor", "2026-13-40", 2, 0, 0, { fetchImpl: f.impl, cacheDir: dir, now: NOW })).toBeNull();
    expect(await fetchGibsTile("BlueMarble_ShadedRelief_Bathymetry", "default", 2, 0, 9, { fetchImpl: f.impl, cacheDir: dir, now: NOW })).toBeNull();
    expect(f.calls).toHaveLength(0);
  });

  it("guarda en caché las teselas de fechas pasadas y no las vuelve a pedir", async () => {
    const f = mock();
    const a = await fetchGibsTile("MODIS_Terra_CorrectedReflectance_TrueColor", "2026-11-10", 2, 1, 1, { fetchImpl: f.impl, cacheDir: dir, now: NOW });
    const b = await fetchGibsTile("MODIS_Terra_CorrectedReflectance_TrueColor", "2026-11-10", 2, 1, 1, { fetchImpl: f.impl, cacheDir: dir, now: NOW });
    expect(a?.type).toBe("image/jpeg");
    expect(b?.body.equals(png)).toBe(true);
    expect(f.calls).toHaveLength(1);
  });

  it("un 404 de GIBS devuelve null y no se guarda", async () => {
    const f = mock(404);
    expect(await fetchGibsTile("MODIS_Terra_CorrectedReflectance_TrueColor", "2026-11-10", 2, 1, 1, { fetchImpl: f.impl, cacheDir: dir, now: NOW })).toBeNull();
    await fetchGibsTile("MODIS_Terra_CorrectedReflectance_TrueColor", "2026-11-10", 2, 1, 1, { fetchImpl: f.impl, cacheDir: dir, now: NOW });
    expect(f.calls).toHaveLength(2);
  });
});
