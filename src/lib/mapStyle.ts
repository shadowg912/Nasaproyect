import type { StyleSpecification, LayerSpecification } from "maplibre-gl";
import { layers as protomapsLayers, namedFlavor } from "@protomaps/basemaps";
import { CONFIDENCE_COLOR } from "./format";

/** Recursos locales servidos desde public/. Ninguna URL remota. */
export const PMTILES_PATH = "/maps/rd.pmtiles";

const ATTRIB_GEO = "Límites: geoBoundaries (CC BY 4.0), Natural Earth";
const ATTRIB_FIRMS = "Incendios: NASA FIRMS";

const overlay = (): LayerSpecification[] => [
  {
    id: "province-fill",
    type: "fill",
    source: "provinces",
    paint: {
      "fill-color": [
        "interpolate", ["linear"], ["coalesce", ["feature-state", "count"], 0],
        0, "rgba(0,0,0,0)", 1, "rgba(253,186,116,0.35)", 10, "rgba(249,115,22,0.45)", 50, "rgba(194,65,12,0.55)",
      ],
      "fill-opacity": ["case", ["boolean", ["feature-state", "choropleth"], false], 1, 0],
    },
  },
  {
    id: "province-selected",
    type: "line",
    source: "provinces",
    paint: { "line-color": "#c2410c", "line-width": 3 },
    filter: ["==", ["get", "id"], -1],
  },
  { id: "municipality-line", type: "line", source: "municipalities", minzoom: 8, paint: { "line-color": "#a8a29e", "line-width": 0.6, "line-dasharray": [2, 2] } },
  { id: "province-line", type: "line", source: "provinces", paint: { "line-color": "#78716c", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 10, 1.4] } },
  { id: "country-line", type: "line", source: "country", paint: { "line-color": "#44403c", "line-width": 1.6 } },
  {
    id: "fires-heat",
    type: "heatmap",
    source: "fires",
    maxzoom: 10,
    layout: { visibility: "none" },
    paint: {
      "heatmap-weight": ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 1], 0, 0.3, 50, 1],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 6, 8, 10, 25],
      "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, "#fde68a", 0.5, "#f97316", 0.8, "#dc2626", 1, "#7f1d1d"],
    },
  },
  {
    id: "fires",
    type: "circle",
    source: "fires",
    paint: {
      "circle-color": ["match", ["get", "confidence"], "high", CONFIDENCE_COLOR.high, "low", CONFIDENCE_COLOR.low, CONFIDENCE_COLOR.nominal],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 0], 0, 3, 50, 7], 12, ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 0], 0, 6, 50, 14]],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1,
      "circle-opacity": 0.9,
    },
  },
];

function overlaySources(origin: string): StyleSpecification["sources"] {
  const empty = { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection;
  return {
    country: { type: "geojson", data: `${origin}/geo/country.geojson` },
    provinces: { type: "geojson", data: `${origin}/geo/provinces.geojson`, promoteId: "id", attribution: ATTRIB_GEO },
    municipalities: { type: "geojson", data: `${origin}/geo/municipalities.geojson`, promoteId: "id" },
    fires: { type: "geojson", data: empty, attribution: ATTRIB_FIRMS },
  };
}

/** Estilo de respaldo: solo GeoJSON local y un fondo sencillo. */
export function geojsonStyle(origin: string): StyleSpecification {
  return {
    version: 8,
    sources: overlaySources(origin),
    layers: [
      { id: "sea", type: "background", paint: { "background-color": "#e5eef2" } },
      { id: "land", type: "fill", source: "country", paint: { "fill-color": "#f4f5ef" } },
      ...overlay(),
    ],
  };
}

/** Estilo con mapa base PMTiles local (Protomaps), glyphs y sprites locales. */
export function pmtilesStyle(origin: string): StyleSpecification {
  return {
    version: 8,
    glyphs: `${origin}/maps/fonts/{fontstack}/{range}.pbf`,
    sprite: `${origin}/maps/sprites/v4/light`,
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${origin}${PMTILES_PATH}`,
        attribution: "© OpenStreetMap contributors, Protomaps",
      },
      ...overlaySources(origin),
    },
    layers: [...(protomapsLayers("protomaps", namedFlavor("light"), { lang: "es" }) as LayerSpecification[]), ...overlay()],
  };
}
