import type { DB } from "@/db/client";
import type { DetectionContext } from "@/lib/types";
import type { FetchLike } from "@/server/firms/client";
import { cached } from "./cache";

const POWER_DAILY = "https://power.larc.nasa.gov/api/temporal/daily/point";
const PARAMETERS = ["WS10M", "WD10M", "T2M", "RH2M", "PRECTOTCORR"] as const;
const POWER_TTL_MS = 30 * 86400000;
const MISSING = -999;
/** Tiempo máximo de espera a un servicio de la NASA antes de responder sin ese dato. */
export const NASA_TIMEOUT_MS = 10_000;

type Weather = NonNullable<DetectionContext["weather"]>;

/** Clima diario de NASA POWER en el punto del foco: viento a 10 m, temperatura, humedad y lluvia. Null si no hay datos. */
export async function fetchPower(db: DB, lat: number, lon: number, date: string, fetchImpl: FetchLike = fetch): Promise<Weather | null> {
  const day = date.replace(/-/g, "");
  const url = `${POWER_DAILY}?parameters=${PARAMETERS.join(",")}&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&start=${day}&end=${day}&format=JSON`;
  const parse = (body: string): Weather | null => {
    try {
      const p = (JSON.parse(body) as { properties?: { parameter?: Record<string, Record<string, number>> } }).properties?.parameter;
      const values = PARAMETERS.map((k) => p?.[k]?.[day]);
      if (values.some((x) => typeof x !== "number" || x <= MISSING)) return null;
      const [windSpeed, windDir, t2m, rh, precip] = values as number[];
      return { windSpeed, windDir, t2m, rh, precip };
    } catch {
      return null;
    }
  };
  // POWER publica con unos días de retraso: una respuesta sin datos (-999) no se guarda, para reintentar más tarde.
  const body = await cached(db, `power:${lat.toFixed(2)}:${lon.toFixed(2)}:${date}`, POWER_TTL_MS, async () => {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(NASA_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`POWER ${res.status}`);
    const text = await res.text();
    if (!parse(text)) throw new Error("POWER sin datos todavía");
    return text;
  });
  return body ? parse(body) : null;
}
