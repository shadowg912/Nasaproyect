import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { getConfig } from "@/lib/config";
import type { LoadJob } from "@/lib/types";
import { getCountry, seedCountries } from "@/server/history/countries";
import { getLoad, startLoad } from "@/server/history/jobs";
import { handle, HttpError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ iso3: string }> };

async function country(ctx: Ctx) {
  const iso3 = (await ctx.params).iso3.toUpperCase();
  const db = getDb();
  if (!getCountry(db, iso3)) seedCountries(db, getConfig().geoDir);
  if (!getCountry(db, iso3)) throw new HttpError(404, `País desconocido: ${iso3}`);
  return { db, iso3 };
}

/** Inicia (o reutiliza) la descarga del historial MODIS + VIIRS del país. */
export const POST = (_req: NextRequest, ctx: Ctx) =>
  handle(async () => {
    const { db, iso3 } = await country(ctx);
    return { jobId: startLoad(db, getConfig(), iso3).jobId };
  });

/** Progreso de la carga. Sin trabajo en memoria, se deduce de lo ya guardado. */
export const GET = (_req: NextRequest, ctx: Ctx) =>
  handle(async (): Promise<LoadJob> => {
    const { db, iso3 } = await country(ctx);
    const job = getLoad(iso3);
    if (job) return job;
    const r = db.$client
      .prepare("SELECT COUNT(*) AS total, SUM(state IN ('done', 'missing')) AS done FROM country_loads WHERE iso3 = ?")
      .get(iso3) as { total: number; done: number | null };
    const finished = r.total > 0 && r.done === r.total;
    return { jobId: "", iso3, state: finished ? "done" : "queued", done: r.done ?? 0, total: r.total, error: null };
  });
