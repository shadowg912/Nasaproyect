import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runSync } from "@/server/firms/ingest";
import { getHistory, getStats, listDetections, parseFilters } from "@/server/queries";
import { fixture, HEADER, mockFetch, tempDb } from "../helpers";

let ctx: ReturnType<typeof tempDb>;
beforeEach(async () => {
  ctx = tempDb();
  await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: mockFetch(() => ({ body: fixture("area-viirs.csv") })), now: new Date("2026-11-14T12:00:00Z") });
});
afterEach(() => ctx.cleanup());

describe("consultas locales", () => {
  it("filtra por fecha, confianza y provincia", () => {
    expect(getStats(ctx.db, {}).total).toBe(3);
    expect(getStats(ctx.db, { from: "2026-11-14" }).total).toBe(1);
    expect(getStats(ctx.db, { confidence: ["high"] }).total).toBe(1);
    const santiago = getStats(ctx.db, {}).byProvince.find((p) => p.name === "Santiago")!;
    expect(getStats(ctx.db, { provinceId: santiago.id! }).total).toBe(1);
    expect(getStats(ctx.db, { daynight: "D" }).total).toBe(1);
    expect(getStats(ctx.db, { satellites: ["NOAA21"] }).total).toBe(0);
  });

  it("parseFilters ignora parámetros inválidos", () => {
    const f = parseFilters(new URLSearchParams("from=2026-02-30&to=2026-11-14&confidence=high,bogus&satellite=NOAA20,X&province=abc"));
    expect(f).toEqual({ to: "2026-11-14", confidence: ["high"], satellites: ["NOAA20"] });
  });

  it("listDetections devuelve provincia y municipio", () => {
    const { rows } = listDetections(ctx.db, {});
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.province && r.municipality)).toBe(true);
  });

  it("no cuenta dos veces un día cubierto por NRT y SP", async () => {
    const sp = fixture("area-viirs.csv").replace(/2\.0NRT/g, "2");
    await runSync(ctx.db, ctx.cfg, {
      kind: "history",
      sources: ["VIIRS_NOAA20_SP"],
      from: "2026-11-13",
      to: "2026-11-14",
      fetchImpl: mockFetch(() => ({ body: sp })),
    });
    // 6 filas guardadas (3 NRT + 3 SP), pero estadísticas cuentan 3
    expect((ctx.db.$client.prepare("SELECT COUNT(*) AS n FROM fire_detections").get() as { n: number }).n).toBe(6);
    expect(getStats(ctx.db, {}).total).toBe(3);
    expect(getHistory(ctx.db, {}).byMonth).toEqual([{ month: "2026-11", count: 3, frp: 18.5 }]);
  });

  it("estadísticas vacías sin datos", async () => {
    expect(getStats(ctx.db, { from: "2020-01-01", to: "2020-01-31" })).toMatchObject({ total: 0, byDay: [] });
    void HEADER;
  });
});

describe("filtros de país, área y sensor", () => {
  it("parseFilters acepta iso3, aoi en bbox y familia de sensor", () => {
    expect(parseFilters(new URLSearchParams("iso3=dom&aoi=-70.5,18,-69,19.5&sensor=VIIRS"))).toEqual({
      iso3: "DOM", bbox: [-70.5, 18, -69, 19.5], sensorFamily: "VIIRS",
    });
    expect(parseFilters(new URLSearchParams("aoi=basura&sensor=OTRO"))).toEqual({});
  });

  it("listDetections filtra por área y sensor", () => {
    const all = listDetections(ctx.db, {}).rows;
    const one = all[0];
    const box: [number, number, number, number] = [one.longitude - 0.001, one.latitude - 0.001, one.longitude + 0.001, one.latitude + 0.001];
    expect(listDetections(ctx.db, { bbox: box }).rows.map((r) => r.id)).toEqual([one.id]);
    expect(listDetections(ctx.db, { sensorFamily: "MODIS" }).rows).toHaveLength(0);
    expect(listDetections(ctx.db, { iso3: "HTI" }).rows).toHaveLength(0);
  });
});
