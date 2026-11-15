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

const OPEN_METEO_RECENT = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
/** El endpoint «forecast» de Open-Meteo cubre ~3 meses hacia atrás; antes se usa el archivo histórico. */
const RECENT_DAYS = 80;
const OM_DAILY = ["wind_speed_10m_max", "wind_direction_10m_dominant", "temperature_2m_mean", "relative_humidity_2m_mean", "precipitation_sum"] as const;

type SourcedWeather = Weather & { source: string };

/** Clima diario de Open-Meteo (respaldo cuando NASA POWER aún no publica el día). */
export async function fetchOpenMeteo(db: DB, lat: number, lon: number, date: string, fetchImpl: FetchLike = fetch): Promise<Weather | null> {
  const recent = Date.now() - Date.parse(`${date}T00:00:00Z`) < RECENT_DAYS * 86400000;
  const base = recent ? OPEN_METEO_RECENT : OPEN_METEO_ARCHIVE;
  const url = `${base}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=${date}&end_date=${date}&daily=${OM_DAILY.join(",")}&wind_speed_unit=ms&timezone=UTC`;
  const parse = (body: string): Weather | null => {
    try {
      const d = (JSON.parse(body) as { daily?: Record<string, (number | null)[]> }).daily;
      const values = OM_DAILY.map((k) => d?.[k]?.[0]);
      if (values.some((x) => typeof x !== "number")) return null;
      const [windSpeed, windDir, t2m, rh, precip] = values as number[];
      return { windSpeed, windDir, t2m, rh, precip };
    } catch {
      return null;
    }
  };
  const body = await cached(db, `openmeteo:${lat.toFixed(2)}:${lon.toFixed(2)}:${date}`, POWER_TTL_MS, async () => {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(NASA_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const text = await res.text();
    if (!parse(text)) throw new Error("Open-Meteo sin datos");
    return text;
  });
  return body ? parse(body) : null;
}

/** Clima del día: consulta NASA POWER y Open-Meteo a la vez; prefiere POWER si tiene el día. Indica la fuente usada. */
export async function fetchWeather(db: DB, lat: number, lon: number, date: string, fetchImpl: FetchLike = fetch): Promise<SourcedWeather | null> {
  const [nasa, om] = await Promise.all([
    fetchPower(db, lat, lon, date, fetchImpl).catch(() => null),
    fetchOpenMeteo(db, lat, lon, date, fetchImpl).catch(() => null),
  ]);
  if (nasa) return { ...nasa, source: "NASA POWER" };
  return om ? { ...om, source: "Open-Meteo" } : null;
}
