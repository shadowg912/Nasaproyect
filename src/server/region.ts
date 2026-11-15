import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import turfBbox from "@turf/bbox";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { isIsoDate } from "@/lib/dates";
import type { RegionQuery } from "@/lib/types";
import { HttpError } from "./http";

export type Bbox = [w: number, s: number, e: number, n: number];

export interface ParsedAoi {
  bbox: Bbox;
  polygon: Feature<Polygon | MultiPolygon> | null;
}

const posInt = (v: string | null) => {
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n > 0 ? n : undefined;
};

const invalid = () => new HttpError(400, "Área de interés inválida: use «oeste,sur,este,norte» o un polígono GeoJSON.");

/** `aoi` = `w,s,e,n` (grados) o GeoJSON de un polígono (geometría o Feature). */
export function parseAoi(aoi: string): ParsedAoi {
  const parts = aoi.split(",").map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite)) {
    const [w, s, e, n] = parts;
    if (w < -180 || e > 180 || s < -90 || n > 90 || w >= e || s >= n) throw invalid();
    return { bbox: [w, s, e, n], polygon: null };
  }
  let geo: unknown;
  try {
    geo = JSON.parse(aoi);
  } catch {
    throw invalid();
  }
  const g = geo as { type?: string };
  const feature = (g.type === "Feature" ? g : { type: "Feature", properties: {}, geometry: g }) as Feature<Polygon | MultiPolygon>;
  if (feature.geometry?.type !== "Polygon" && feature.geometry?.type !== "MultiPolygon") throw invalid();
  return { bbox: turfBbox(feature) as Bbox, polygon: feature };
}

export const inAoi = (a: ParsedAoi, lat: number, lon: number) =>
  lon >= a.bbox[0] && lon <= a.bbox[2] && lat >= a.bbox[1] && lat <= a.bbox[3] &&
  (!a.polygon || booleanPointInPolygon([lon, lat], a.polygon));

/** Región de la consulta. Ignora parámetros mal formados salvo `iso3` y `aoi`, que responden 400. */
export function parseRegion(sp: URLSearchParams): RegionQuery {
  const iso3 = (sp.get("iso3") ?? "DOM").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(iso3)) throw new HttpError(400, "Código de país inválido (ISO 3166-1 alfa-3).");
  const q: RegionQuery = { iso3 };
  const provinceId = posInt(sp.get("provinceId") ?? sp.get("province"));
  const municipalityId = posInt(sp.get("municipalityId") ?? sp.get("municipality"));
  if (provinceId) q.provinceId = provinceId;
  if (municipalityId) q.municipalityId = municipalityId;
  const aoi = sp.get("aoi");
  if (aoi) {
    parseAoi(aoi);
    q.aoi = aoi;
  }
  const from = sp.get("from");
  const to = sp.get("to");
  if (isIsoDate(from)) q.from = from;
  if (isIsoDate(to)) q.to = to;
  return q;
}

export const regionKey = (q: RegionQuery) =>
  q.municipalityId ? `${q.iso3}:m:${q.municipalityId}` : q.provinceId ? `${q.iso3}:p:${q.provinceId}` : q.iso3;
