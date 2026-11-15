import type { DB } from "@/db/client";
import type { DetectionContext } from "@/lib/types";
import type { FetchLike } from "@/server/firms/client";
import { cached } from "./cache";

const POWER_DAILY = "https://power.larc.nasa.gov/api/temporal/daily/point";
const PARAMETERS = ["WS10M", "WD10M", "T2M", "RH2M", "PRECTOTCORR"] as const;
const POWER_TTL_MS = 30 * 86400000;
const MISSING = -999;

type Weather = NonNullable<DetectionContext["weather"]>;

/** Clima diario de NASA POWER en el punto del foco: viento a 10 m, temperatura, humedad y lluvia. Null si no hay datos. */
export async function fetchPower(db: DB, lat: number, lon: number, date: string, fetchImpl: FetchLike = fetch): Promise<Weather | null> {
  const day = date.replace(/-/g, "");
  const url = `${POWER_DAILY}?parameters=${PARAMETERS.join(",")}&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&start=${day}&end=${day}&format=JSON`;
  const body = await cached(db, `power:${lat.toFixed(2)}:${lon.toFixed(2)}:${date}`, POWER_TTL_MS, async () => {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`POWER ${res.status}`);
    return res.text();
  });
  if (!body) return null;
  try {
    const p = (JSON.parse(body) as { properties?: { parameter?: Record<string, Record<string, number>> } }).properties?.parameter;
    const v = (k: (typeof PARAMETERS)[number]) => p?.[k]?.[day];
    const values = PARAMETERS.map(v);
    if (values.some((x) => typeof x !== "number" || x <= MISSING)) return null;
    const [windSpeed, windDir, t2m, rh, precip] = values as number[];
    return { windSpeed, windDir, t2m, rh, precip };
  } catch {
    return null;
  }
}
