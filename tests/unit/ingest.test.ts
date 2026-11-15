import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/db/client";
import { runSync, SYNC_LOCK } from "@/server/firms/ingest";
import { acquireLock, releaseLock } from "@/server/lock";
import { getSyncStatus } from "@/server/status";
import { fixture, HEADER, mockFetch, tempDb } from "../helpers";

let ctx: ReturnType<typeof tempDb>;
beforeEach(() => (ctx = tempDb()));
afterEach(() => ctx.cleanup());

const count = () => (ctx.db.$client.prepare("SELECT COUNT(*) AS n FROM fire_detections").get() as { n: number }).n;
const now = new Date("2026-11-14T12:00:00Z");

describe("runSync", () => {
  it("guarda solo las detecciones dentro de RD y registra la ejecución y cobertura", async () => {
    const f = mockFetch(() => ({ body: fixture("area-viirs.csv") }));
    const r = await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: f, now, dayRange: 2 });
    expect(r.status).toBe("success");
    expect(r.rowsFetched).toBe(6);
    expect(r.rowsRejected).toBe(1);
    expect(r.rowsInCountry).toBe(3); // Haití y mar excluidos
    expect(r.rowsInserted).toBe(3);
    expect(count()).toBe(3);
    expect(f.calls[0]).toBe(
      "https://firms.modaps.eosdis.nasa.gov/api/area/csv/TESTKEY123/VIIRS_NOAA20_NRT/-72.01,17.47,-68.32,19.93/2",
    );
    const cov = ctx.db.$client.prepare("SELECT * FROM ingestion_coverage").all();
    expect(cov).toMatchObject([{ source: "VIIRS_NOAA20_NRT", date_from: "2026-11-13", date_to: "2026-11-14" }]);
    const run = ctx.db.$client.prepare("SELECT * FROM ingestion_runs").get() as Record<string, unknown>;
    expect(run).toMatchObject({ status: "success", rows_inserted: 3, kind: "sync" });
  });

  it("puede repetirse sin duplicar registros", async () => {
    const f = mockFetch(() => ({ body: fixture("area-viirs.csv") }));
    await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: f, now });
    const r2 = await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: f, now });
    expect(r2.rowsInserted).toBe(0);
    expect(r2.rowsUpdated).toBe(0);
    expect(count()).toBe(3);
  });

  it("actualiza un registro cuando NASA corrige sus valores", async () => {
    await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: mockFetch(() => ({ body: fixture("area-viirs.csv") })), now });
    const changed = fixture("area-viirs.csv").replace(",4.2,N", ",9.9,N");
    const r = await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: mockFetch(() => ({ body: changed })), now });
    expect(r.rowsUpdated).toBe(1);
    expect(count()).toBe(3);
  });

  it("un error de NASA no elimina datos existentes y se clasifica como sin conexión", async () => {
    await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: mockFetch(() => ({ body: fixture("area-viirs.csv") })), now });
    const offline = await runSync(ctx.db, ctx.cfg, {
      kind: "sync",
      fetchImpl: mockFetch(() => new TypeError("fetch failed: getaddrinfo ENOTFOUND")),
      now,
    });
    expect(offline.status).toBe("failed");
    expect(offline.errors[0].type).toBe("network");
    expect(count()).toBe(3);
    expect(getSyncStatus(ctx.db, ctx.cfg).state).toBe("offline");

    const server = await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: mockFetch(() => ({ status: 503, body: "down" })), now });
    expect(server.errors[0].type).toBe("server");
    const garbage = await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: mockFetch(() => ({ body: "<html>oops</html>" })), now });
    expect(garbage.errors[0].type).toBe("invalid_response");
    expect(count()).toBe(3);
  });

  it("cero detecciones nuevas es un éxito, no un fallo de conectividad", async () => {
    const r = await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: mockFetch(() => ({ body: HEADER })), now });
    expect(r.status).toBe("success");
    expect(r.rowsInserted).toBe(0);
    const st = getSyncStatus(ctx.db, ctx.cfg, new Date());
    expect(st.state).toBe("fresh");
    expect(st.lastErrorType).toBeNull();
  });

  it("clasifica una MAP_KEY inválida y no la expone en los mensajes", async () => {
    const r = await runSync(ctx.db, ctx.cfg, {
      kind: "sync",
      fetchImpl: mockFetch(() => new Error("boom at /api/area/csv/TESTKEY123/x")),
      now,
    });
    expect(r.errors[0].message).not.toContain("TESTKEY123");
    const auth = await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: mockFetch(() => ({ status: 400, body: "Invalid MAP_KEY." })), now });
    expect(auth.errors[0].type).toBe("auth");
    const runs = ctx.db.$client.prepare("SELECT error_message FROM ingestion_runs").all() as { error_message: string }[];
    for (const run of runs) expect(run.error_message ?? "").not.toContain("TESTKEY123");
  });

  it("sin MAP_KEY usa el feed público de FIRMS", async () => {
    const f = mockFetch(() => ({ body: fixture("area-viirs.csv") }));
    const r = await runSync(ctx.db, { ...ctx.cfg, mapKey: "" }, { fetchImpl: f, now });
    expect(r.kind).toBe("public_feed");
    expect(f.calls[0]).toContain("/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Central_America_7d.csv");
    expect(r.rowsInserted).toBe(3);
  });

  it("no permite dos sincronizaciones simultáneas", async () => {
    const owner = acquireLock(ctx.db, SYNC_LOCK, 60_000)!;
    // Otro proceso con su propia conexión al mismo archivo
    const other = openDatabase(ctx.file);
    const f = mockFetch(() => ({ body: fixture("area-viirs.csv") }));
    const r = await runSync(other, ctx.cfg, { kind: "sync", fetchImpl: f, now });
    expect(r.status).toBe("locked");
    expect(f.calls).toHaveLength(0);
    releaseLock(ctx.db, SYNC_LOCK, owner);
    expect((await runSync(other, ctx.cfg, { kind: "sync", fetchImpl: f, now })).status).toBe("success");
    other.$client.close();
  });

  it("ejecuciones concurrentes en el mismo proceso: solo una escribe", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = Object.assign(async () => (await gate, new Response(fixture("area-viirs.csv"))), { calls: [] });
    const a = runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: slow, now });
    const b = await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: slow, now });
    expect(b.status).toBe("locked");
    release();
    expect((await a).status).toBe("success");
  });

  it("historial: procesa en lotes de 5 días y omite intervalos cubiertos", async () => {
    const f = mockFetch(() => ({ body: HEADER }));
    const r = await runSync(ctx.db, ctx.cfg, { kind: "history", sources: ["VIIRS_NOAA20_SP"], from: "2025-01-01", to: "2025-01-12", fetchImpl: f });
    expect(r.requests).toBe(3);
    expect(f.calls.map((u) => u.split("/").slice(-2).join("/"))).toEqual(["5/2025-01-01", "5/2025-01-06", "2/2025-01-11"]);
    const again = mockFetch(() => ({ body: HEADER }));
    const r2 = await runSync(ctx.db, ctx.cfg, { kind: "history", sources: ["VIIRS_NOAA20_SP"], from: "2025-01-01", to: "2025-01-15", fetchImpl: again });
    expect(r2.requests).toBe(1);
    expect(again.calls[0]).toMatch(/\/3\/2025-01-13$/);
  });

  it("historial: registra cobertura solo de los lotes exitosos", async () => {
    let i = 0;
    const f = mockFetch(() => (i++ === 1 ? { status: 500, body: "err" } : { body: HEADER }));
    const r = await runSync(ctx.db, ctx.cfg, { kind: "history", sources: ["VIIRS_NOAA20_SP"], from: "2025-02-01", to: "2025-02-15", fetchImpl: f });
    expect(r.status).toBe("partial");
    const cov = ctx.db.$client.prepare("SELECT date_from AS f FROM ingestion_coverage ORDER BY f").all();
    expect(cov).toEqual([{ f: "2025-02-01" }, { f: "2025-02-11" }]);
  });
});

describe("persistencia", () => {
  it("los datos persisten tras cerrar y reabrir la base", async () => {
    await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: mockFetch(() => ({ body: fixture("area-viirs.csv") })), now });
    ctx.db.$client.close();
    const reopened = openDatabase(ctx.file);
    expect((reopened.$client.prepare("SELECT COUNT(*) AS n FROM fire_detections").get() as { n: number }).n).toBe(3);
    expect(reopened.$client.pragma("journal_mode", { simple: true })).toBe("wal");
    ctx.db = reopened;
  });
});

describe("estado de sincronización", () => {
  it("nunca sincronizado", () => {
    expect(getSyncStatus(ctx.db, ctx.cfg).state).toBe("never");
  });
  it("datos almacenados cuando la última sincronización es antigua", async () => {
    await runSync(ctx.db, ctx.cfg, { kind: "sync", fetchImpl: mockFetch(() => ({ body: HEADER })), now });
    const later = new Date(Date.now() + (ctx.cfg.freshHours + 1) * 3600_000);
    expect(getSyncStatus(ctx.db, ctx.cfg, later).state).toBe("stored");
  });
});
