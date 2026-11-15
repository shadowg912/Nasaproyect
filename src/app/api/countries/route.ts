import { getDb } from "@/db/client";
import { getConfig } from "@/lib/config";
import { listCountries, seedCountries } from "@/server/history/countries";
import { getLoad } from "@/server/history/jobs";
import { handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Países del mapa global con su estado de carga del historial. */
export const GET = () =>
  handle(() => {
    const db = getDb();
    const list = listCountries(db, getLoad);
    if (list.length) return list;
    seedCountries(db, getConfig().geoDir);
    return listCountries(db, getLoad);
  });
