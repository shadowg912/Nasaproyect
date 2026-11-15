import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getContext } from "@/server/context";
import type { NormalizedDetection } from "@/server/firms/csv";
import { saveDetections } from "@/server/history/store";
import { gibsUrl, GIBS_LAYER } from "@/server/nasa/gibs";
import { fetchPower } from "@/server/nasa/power";
import { tempDb } from "../helpers";

let ctx: ReturnType<typeof tempDb>;
beforeEach(() => (ctx = tempDb()));
afterEach(() => ctx.cleanup());

function det(id: string, date: string, fireType: number | null, lat = 18.75, lon = -70.16): NormalizedDetection {
  return {
    id, source: "VIIRS_SNPP_SP", satellite: "N", instrument: "VIIRS", latitude: lat, longitude: lon, acqDate: date, acqTime: "1800",
    acquiredAt: `${date}T18:00:00Z`, brightness: 330, brightnessT31: 300, scan: 0.4, track: 0.4, frp: 4, confidence: "nominal",
    confidenceRaw: "n", version: "2", daynight: "D", fireType, sensorFamily: "VIIRS",
  };
}
const save = (rows: NormalizedDetection[]) => saveDetections(ctx.db, rows, { iso3: "DOM", geoDir: ctx.cfg.geoDir, runId: null, onlyInCountry: false });

const power = (ws: number, wd: number) =>
  JSON.stringify({ properties: { parameter: { WS10M: { "20230315": ws }, WD10M: { "20230315": wd }, T2M: { "20230315": 29.1 }, RH2M: { "20230315": 58 }, PRECTOTCORR: { "20230315": 0 } } } });

function mockFetch(body: () => string) {
  const calls: string[] = [];
  return { calls, impl: async (url: string) => (calls.push(url), new Response(body())) };
}

describe("NASA GIBS y POWER", () => {
  it("arma la URL WMS de GIBS para el día y el recuadro", () => {
    const url = gibsUrl(GIBS_LAYER, "2023-03-15", [18.5, -70.4, 19, -69.9]);
    expect(url).toContain("gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi");
    expect(url).toContain("LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor");
    expect(url).toContain("TIME=2023-03-15");
    expect(url).toContain("BBOX=18.5,-70.4,19,-69.9");
  });

  it("POWER con valores -999 se considera sin datos", async () => {
    const f = mockFetch(() => power(-999, -999));
    expect(await fetchPower(ctx.db, 18.75, -70.16, "2023-03-15", f.impl)).toBeNull();
  });

  it("guarda POWER en caché y no vuelve a consultar", async () => {
    const f = mockFetch(() => power(4.2, 90));
    const a = await fetchPower(ctx.db, 18.75, -70.16, "2023-03-15", f.impl);
    const b = await fetchPower(ctx.db, 18.75, -70.16, "2023-03-15", f.impl);
    expect(a).toEqual({ windSpeed: 4.2, windDir: 90, t2m: 29.1, rh: 58, precip: 0 });
    expect(b).toEqual(a);
    expect(f.calls).toHaveLength(1);
  });
});

describe("contexto de un foco", () => {
  it("sin Internet devuelve la imagen local y clima nulo, sin lanzar", async () => {
    save([det("a", "2023-03-15", 0)]);
    const c = await getContext(ctx.db, "a", async () => {
      throw new Error("offline");
    });
    expect(c!.imagery!.url.startsWith("/api/imagery?")).toBe(true);
    expect(c).toMatchObject({ weather: null, spread: null });
  });

  it("la propagación va hacia donde sopla el viento (desde 90° → 270°)", async () => {
    save([det("a", "2023-03-15", 0)]);
    const c = await getContext(ctx.db, "a", mockFetch(() => power(4.2, 90)).impl);
    expect(c!.spread).toEqual({ bearing: 270, note: "Estimación según el viento del día (NASA POWER); no es una predicción." });
  });

  it("una fuente fija se identifica como industrial", async () => {
    save([det("a", "2023-03-15", 2)]);
    const c = await getContext(ctx.db, "a", mockFetch(() => power(1, 0)).impl);
    expect(c!.cause.label).toBe("Fuente industrial o fija");
  });

  it("una celda que arde en 5 años distintos de la misma temporada es quema recurrente probable (alta)", async () => {
    save([2018, 2019, 2020, 2021, 2023].map((y) => det(`r${y}`, `${y}-03-1${y % 9}`, 0, 18.7512, -70.1612)));
    const c = await getContext(ctx.db, "r2023", mockFetch(() => power(1, 0)).impl);
    expect(c!.cause).toMatchObject({ label: "Probable quema agrícola o de limpieza recurrente", likelihood: "alta" });
    expect(c!.cause.reasons.length).toBeGreaterThan(0);
  });

  it("un foco inexistente devuelve null", async () => {
    expect(await getContext(ctx.db, "nope", mockFetch(() => "").impl)).toBeNull();
  });
});
