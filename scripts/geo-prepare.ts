/**
 * Prepara los límites administrativos locales de República Dominicana.
 *
 * Herramienta de DESARROLLO: descarga una sola vez desde geoBoundaries (GitHub) y
 * escribe archivos GeoJSON simplificados en public/geo/. La aplicación en ejecución
 * solo lee esos archivos locales. Los resultados están versionados en el repositorio,
 * por lo que no es necesario ejecutar este script para usar la aplicación.
 *
 * Uso: npm run geo:prepare
 */
import fs from "node:fs";
import path from "node:path";
import area from "@turf/area";
import centroid from "@turf/centroid";
import simplify from "@turf/simplify";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

const OUT = path.resolve("public/geo");
const API = "https://www.geoboundaries.org/api/current/gbOpen/DOM";
type Poly = Feature<Polygon | MultiPolygon, Record<string, unknown>>;

interface Meta {
  boundaryType: string;
  boundarySource: string;
  boundaryLicense: string;
  boundaryYearRepresented: string;
  sourceDataUpdateDate: string;
  simplifiedGeometryGeoJSON: string;
  gjDownloadURL: string;
}

async function fetchLevel(level: string) {
  const meta = (await (await fetch(`${API}/${level}/`)).json()) as Meta;
  const res = await fetch(meta.gjDownloadURL);
  if (!res.ok) throw new Error(`Descarga fallida ${level}: HTTP ${res.status}`);
  const fc = (await res.json()) as FeatureCollection<Polygon | MultiPolygon>;
  return { meta, fc };
}

/** Natural Earth usa nombres abreviados o antiguos; se usan los nombres oficiales. */
const PROVINCE_NAME_FIX: Record<string, string> = {
  Hermanas: "Hermanas Mirabal",
  "La Estrelleta": "Elías Piña",
  "Monte Cristi": "Montecristi",
};
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Provincia que contiene la mayor cantidad de vértices de un municipio (respaldo costero). */
function provinceByVertexVote(f: Poly, provs: Poly[]) {
  const g = f.geometry;
  const pts = (g.type === "Polygon" ? g.coordinates : g.coordinates.flat()).flat();
  const votes = new Map<number, number>();
  for (let i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / 400))) {
    const hit = provs.find((pf) => booleanPointInPolygon(pts[i], pf));
    if (hit) votes.set(hit.properties.id as number, (votes.get(hit.properties.id as number) ?? 0) + 1);
  }
  return [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Redondea coordenadas a 5 decimales (~1 m) para reducir el tamaño. */
function round(f: Poly): Poly {
  const r = (c: number[]) => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5];
  const g = f.geometry;
  const coords =
    g.type === "Polygon" ? g.coordinates.map((ring) => ring.map(r)) : g.coordinates.map((p) => p.map((ring) => ring.map(r)));
  return { ...f, geometry: { ...g, coordinates: coords } as Polygon | MultiPolygon };
}

function prep(f: Poly, tolerance: number): Poly {
  return round(simplify(f, { tolerance, highQuality: true }) as Poly);
}

function write(name: string, fc: FeatureCollection) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(fc));
  console.log(`  ${name}: ${fc.features.length} entidades, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("Descargando límites de geoBoundaries…");
  const [adm0, adm1, adm2] = await Promise.all(["ADM0", "ADM1", "ADM2"].map(fetchLevel));

  const country = adm0.fc.features.map((f) => prep(f as Poly, 0.0005));
  country.forEach((f) => (f.properties = { name: "República Dominicana", code: "DOM" }));

  const provFeatures = [...adm1.fc.features]
    .sort((a, b) => clean(a.properties?.shapeName).localeCompare(clean(b.properties?.shapeName), "es"))
    .map((f, i) => {
      const p = prep(f as Poly, 0.0008);
      const raw = clean(f.properties?.shapeName);
      const name = PROVINCE_NAME_FIX[raw] ?? raw;
      p.properties = {
        id: i + 1,
        code: String(f.properties?.shapeISO || `DO-${slug(name)}`),
        name,
        area_km2: Math.round(area(f) / 1e6),
      };
      return p;
    });

  const muniFeatures = [...adm2.fc.features]
    .sort((a, b) => clean(a.properties?.shapeName).localeCompare(clean(b.properties?.shapeName), "es"))
    .map((f, i) => {
      const p = prep(f as Poly, 0.0005);
      const name = clean(f.properties?.shapeName);
      // Las fuentes ADM1 y ADM2 difieren: se asigna la provincia por centroide.
      const c = centroid(f);
      const prov = provFeatures.find((pf) => booleanPointInPolygon(c, pf));
      p.properties = {
        id: i + 1,
        code: String(f.properties?.shapeID || `MUN-${i + 1}`),
        name,
        province_id: (prov?.properties.id as number | undefined) ?? provinceByVertexVote(f as Poly, provFeatures),
        area_km2: Math.round((area(f) / 1e6) * 10) / 10,
      };
      return p;
    });

  write("country.geojson", { type: "FeatureCollection", features: country });
  write("provinces.geojson", { type: "FeatureCollection", features: provFeatures });
  write("municipalities.geojson", { type: "FeatureCollection", features: muniFeatures });

  const sources = [adm0, adm1, adm2].map(({ meta }) => ({
    level: meta.boundaryType,
    source: meta.boundarySource,
    license: meta.boundaryLicense,
    year: meta.boundaryYearRepresented,
    updated: meta.sourceDataUpdateDate,
    url: meta.gjDownloadURL,
  }));
  fs.writeFileSync(
    path.join(OUT, "sources.json"),
    JSON.stringify({ provider: "geoBoundaries (William & Mary geoLab)", retrieved: new Date().toISOString(), sources }, null, 2),
  );
  const orphan = muniFeatures.filter((m) => m.properties.province_id == null).map((m) => m.properties.name);
  if (orphan.length) console.warn(`  Aviso: ${orphan.length} municipios sin provincia: ${orphan.join(", ")}`);
  console.log("Listo. Ejecute `npm run db:init` para sembrar provincias y municipios.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
