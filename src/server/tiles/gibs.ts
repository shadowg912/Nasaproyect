import fs from "node:fs";
import path from "node:path";
import { GIBS_META } from "@/lib/layers";
import { isIsoDate } from "@/lib/dates";
import type { FetchLike } from "@/server/firms/client";

const WMTS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const WMS = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi";
const HALF_WORLD = 20037508.34;
const TODAY_TTL_MS = 3600_000;
const FETCH_TIMEOUT_MS = 15_000;
export const GIBS_CACHE_DIR = path.resolve(/*turbopackIgnore: true*/ "data/cache/gibs");

const num = (v: number) => String(Number(v.toFixed(2)));

/** Recuadro EPSG:3857 de una tesela XYZ: [minx, miny, maxx, maxy]. */
export function tileBbox3857(z: number, y: number, x: number): [number, number, number, number] {
  const size = (2 * HALF_WORLD) / 2 ** z;
  const minx = -HALF_WORLD + x * size;
  const maxy = HALF_WORLD - y * size;
  return [minx, maxy - size, minx + size, maxy];
}

/** URL de GIBS: WMTS para imágenes y fondos; WMS (256 px) para capas de focos, que en WMTS solo existen como vectores. */
export function gibsUpstreamUrl(id: string, date: string, z: number, y: number, x: number): string {
  const meta = GIBS_META[id];
  if (meta.wms) {
    const p = new URLSearchParams({
      SERVICE: "WMS", REQUEST: "GetMap", VERSION: "1.3.0", LAYERS: id, CRS: "EPSG:3857",
      BBOX: tileBbox3857(z, y, x).map(num).join(","), WIDTH: "256", HEIGHT: "256", FORMAT: "image/png", TRANSPARENT: "true",
    });
    if (date !== "default") p.set("TIME", date);
    return `${WMS}?${decodeURIComponent(p.toString())}`;
  }
  const time = date === "default" ? "default" : meta.subdaily ? `${date}T12:00:00Z` : date;
  return `${WMTS}/${id}/default/${time}/GoogleMapsCompatible_Level${meta.maxZoom}/${z}/${y}/${x}.${meta.format}`;
}

/** ¿Es válida la petición? (capa en la lista blanca, fecha y z/x/y dentro de rango) */
export function validTileRequest(id: string, date: string, z: number, y: number, x: number): boolean {
  const meta = GIBS_META[id];
  if (!meta || !(date === "default" || isIsoDate(date))) return false;
  if (![z, y, x].every(Number.isInteger) || z < 0 || z > meta.maxZoom) return false;
  const n = 2 ** z;
  return x >= 0 && x < n && y >= 0 && y < n;
}

interface Opts {
  fetchImpl?: FetchLike;
  cacheDir?: string;
  now?: Date;
}

/** Tesela de GIBS con caché en disco: fechas pasadas no caducan; hoy (o «default» con fecha) caduca en 1 h. */
export async function fetchGibsTile(id: string, date: string, z: number, y: number, x: number, opts: Opts = {}): Promise<{ body: Buffer; type: string } | null> {
  if (!validTileRequest(id, date, z, y, x)) return null;
  const meta = GIBS_META[id];
  const type = meta.wms ? "image/png" : `image/${meta.format}`;
  const today = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const file = path.join(opts.cacheDir ?? GIBS_CACHE_DIR, id, date, String(z), String(y), String(x));
  const volatile = date >= today;
  try {
    const st = fs.statSync(file);
    if (!volatile || Date.now() - st.mtimeMs < TODAY_TTL_MS) return { body: fs.readFileSync(file), type };
  } catch {
    /* sin caché */
  }
  try {
    const res = await (opts.fetchImpl ?? fetch)(gibsUpstreamUrl(id, date, z, y, x), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const body = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
    return { body, type };
  } catch {
    return null;
  }
}
