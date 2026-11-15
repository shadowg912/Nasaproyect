import { RD_BBOX, type AppConfig } from "@/lib/config";
import { FirmsResponseError } from "./csv";

export type ErrorType = "network" | "auth" | "rate_limit" | "invalid_response" | "server" | "config" | "other";

export class FirmsError extends Error {
  constructor(public type: ErrorType, message: string, public status?: number) {
    super(message);
    this.name = "FirmsError";
  }
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Feeds públicos de FIRMS (sin clave, últimos 7 días, región Centroamérica y Caribe). */
const PUBLIC_FEEDS: Record<string, string> = {
  VIIRS_NOAA20_NRT: "noaa-20-viirs-c2/csv/J1_VIIRS_C2_Central_America_7d.csv",
  VIIRS_NOAA21_NRT: "noaa-21-viirs-c2/csv/J2_VIIRS_C2_Central_America_7d.csv",
  VIIRS_SNPP_NRT: "suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Central_America_7d.csv",
  MODIS_NRT: "modis-c6.1/csv/MODIS_C6_1_Central_America_7d.csv",
};
export const PUBLIC_FEED_DAYS = 7;
export const hasPublicFeed = (source: string) => source in PUBLIC_FEEDS;

export function areaUrl(cfg: AppConfig, source: string, dayRange: number, date?: string) {
  const parts = [cfg.firmsBaseUrl, "api/area/csv", encodeURIComponent(cfg.mapKey), source, RD_BBOX.join(","), String(dayRange)];
  if (date) parts.push(date);
  return parts.join("/");
}

export function publicFeedUrl(cfg: AppConfig, source: string) {
  const p = PUBLIC_FEEDS[source];
  if (!p) throw new FirmsError("config", `No existe feed público para ${source}`);
  return `${cfg.firmsBaseUrl}/data/active_fire/${p}`;
}

/** Oculta la MAP_KEY en mensajes y registros. */
export const redact = (s: string, key: string) => (key ? s.split(key).join("***") : s);

export async function fetchText(cfg: AppConfig, url: string, fetchImpl: FetchLike = fetch): Promise<string> {
  let res: Response;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(cfg.timeoutMs), headers: { Accept: "text/csv,text/plain" } });
  } catch (e) {
    const err = e as Error;
    const msg = err.name === "TimeoutError" ? "Tiempo de espera agotado" : err.message;
    throw new FirmsError("network", `Sin conexión con NASA FIRMS: ${redact(msg, cfg.mapKey)}`);
  }
  let body: string;
  try {
    body = await res.text();
  } catch (e) {
    throw new FirmsError("network", `Conexión interrumpida: ${(e as Error).message}`);
  }
  const snippet = redact(body.trim().slice(0, 200), cfg.mapKey);
  if (/invalid\s+map_key/i.test(body)) throw new FirmsError("auth", "MAP_KEY inválida o no autorizada", res.status);
  if (res.status === 429 || /transaction limit|exceed/i.test(body.slice(0, 300)))
    throw new FirmsError("rate_limit", `Límite de transacciones de FIRMS excedido: ${snippet}`, res.status);
  if (res.status >= 500) throw new FirmsError("server", `Error del servidor FIRMS (HTTP ${res.status})`, res.status);
  if (!res.ok) throw new FirmsError("invalid_response", `HTTP ${res.status}: ${snippet}`, res.status);
  return body;
}

export async function fetchDataAvailability(cfg: AppConfig, sensor: string, fetchImpl: FetchLike = fetch) {
  if (!cfg.mapKey) throw new FirmsError("config", "Se requiere FIRMS_MAP_KEY");
  const url = `${cfg.firmsBaseUrl}/api/data_availability/csv/${encodeURIComponent(cfg.mapKey)}/${sensor}`;
  const text = await fetchText(cfg, url, fetchImpl);
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const [iId, iMin, iMax] = ["data_id", "min_date", "max_date"].map((c) => header.indexOf(c));
  if (iId < 0 || iMin < 0 || iMax < 0) throw new FirmsError("invalid_response", "Respuesta de disponibilidad no válida");
  return lines.slice(1).map((l) => {
    const c = l.split(",");
    return { dataId: c[iId], minDate: c[iMin], maxDate: c[iMax] };
  });
}

export function toFirmsError(e: unknown): FirmsError {
  if (e instanceof FirmsError) return e;
  if (e instanceof FirmsResponseError) return new FirmsError("invalid_response", e.message);
  return new FirmsError("other", (e as Error)?.message ?? String(e));
}
