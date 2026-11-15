import fs from "node:fs";
import path from "node:path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import bbox from "@turf/bbox";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

type Props = { id?: number; code: string; name: string; province_id?: number | null; area_km2?: number };
type Poly = Feature<Polygon | MultiPolygon, Props> & { _bbox: number[] };

export interface Territory {
  country: Poly[];
  provinces: Poly[];
  municipalities: Poly[];
}

function load(dir: string, name: string): Poly[] {
  const fc = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as FeatureCollection<Polygon | MultiPolygon, Props>;
  return fc.features.map((f) => Object.assign(f, { _bbox: bbox(f) }));
}

const cache = new Map<string, Territory>();

export function loadTerritory(geoDir: string): Territory {
  let t = cache.get(geoDir);
  if (!t) {
    t = {
      country: load(geoDir, "country.geojson"),
      provinces: load(geoDir, "provinces.geojson"),
      municipalities: load(geoDir, "municipalities.geojson"),
    };
    cache.set(geoDir, t);
  }
  return t;
}

function find(features: Poly[], lon: number, lat: number) {
  return features.find(
    (f) =>
      lon >= f._bbox[0] && lon <= f._bbox[2] && lat >= f._bbox[1] && lat <= f._bbox[3] && booleanPointInPolygon([lon, lat], f),
  );
}

export interface Classification {
  inCountry: boolean;
  provinceId: number | null;
  municipalityId: number | null;
}

/**
 * Determina si una coordenada pertenece a República Dominicana y, en ese caso,
 * a qué provincia y municipio. El polígono nacional (ADM0) es la referencia
 * para excluir puntos de Haití o del mar.
 */
export function classifyPoint(t: Territory, lat: number, lon: number): Classification {
  if (!find(t.country, lon, lat)) return { inCountry: false, provinceId: null, municipalityId: null };
  const muni = find(t.municipalities, lon, lat);
  const prov = find(t.provinces, lon, lat);
  return {
    inCountry: true,
    provinceId: prov?.properties.id ?? muni?.properties.province_id ?? null,
    municipalityId: muni?.properties.id ?? null,
  };
}
