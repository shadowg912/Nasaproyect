import type { StyleSpecification, LayerSpecification, SourceSpecification } from "maplibre-gl";
import { availableOn, layerById, type LayerDef, tileUrls } from "@/lib/layers";
import { COLORS, FIRE_AGE_RAMP, FIRE_CONFIDENCE, FIRE_SIMPLE } from "@/lib/tokens";
import type { FireStyle, MapState } from "./types";

const HOUR_MS = 3600_000;

/** Color de un foco según su antigüedad respecto al fin del periodo elegido. */
export function fireAgeColor(acquiredAt: string, periodEnd: string): string {
  const hours = (Date.parse(periodEnd) - Date.parse(acquiredAt)) / HOUR_MS;
  return (FIRE_AGE_RAMP.find((r) => hours < r.maxHours) ?? FIRE_AGE_RAMP[FIRE_AGE_RAMP.length - 1]).color;
}

/** Expresión MapLibre de color de focos. Los puntos llevan la propiedad `t` (ms de adquisición) y `confidence`. */
export function fireColorExpression(style: FireStyle, periodEnd: string): unknown {
  if (style === "simple") return FIRE_SIMPLE;
  if (style === "confidence") return ["match", ["get", "confidence"], "high", FIRE_CONFIDENCE.high, "nominal", FIRE_CONFIDENCE.nominal, FIRE_CONFIDENCE.low];
  const age = ["/", ["-", Date.parse(periodEnd), ["get", "t"]], HOUR_MS];
  const steps: unknown[] = [FIRE_AGE_RAMP[0].color];
  for (let i = 1; i < FIRE_AGE_RAMP.length; i++) steps.push(FIRE_AGE_RAMP[i - 1].maxHours, FIRE_AGE_RAMP[i].color);
  return ["step", age, ...steps];
}

function rasterLayers(layer: LayerDef, date: string, offline: boolean, opacity = 1): { sources: Record<string, SourceSpecification>; layers: LayerSpecification[] } {
  const sources: Record<string, SourceSpecification> = {};
  const layers: LayerSpecification[] = [];
  if (layer.kind !== "raster" || !availableOn(layer, date)) return { sources, layers };
  if (offline && layer.source !== "gibs") return { sources, layers };
  tileUrls(layer, date).forEach((url, i) => {
    const id = `${layer.id}-${i}`;
    sources[id] = { type: "raster", tiles: [url], tileSize: 256, maxzoom: layer.maxZoom, attribution: layer.attribution };
    layers.push({ id, type: "raster", source: id, paint: { "raster-opacity": opacity } });
  });
  return { sources, layers };
}

/**
 * Estilo base del mapa: fondo → imágenes → aerosoles → capas de referencia → (Global) focos raster de GIBS.
 * `offline`: sin fondos de terceros; el fondo es el GeoJSON local del mundo. Los focos propios, volcanes y límites
 * locales los añade MapView encima.
 */
export function buildStyle(s: MapState, opts: { offline: boolean }): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    projection: { type: s.projection === "globe" ? "globe" : "mercator" },
    sources: {},
    layers: [{ id: "bg-color", type: "background", paint: { "background-color": COLORS.brand900 } }],
  };
  const add = (r: ReturnType<typeof rasterLayers>) => {
    Object.assign(style.sources, r.sources);
    style.layers.push(...r.layers);
  };
  const bg = layerById(s.background);
  const bgIsRemote = bg && bg.source !== "gibs";
  if (bg && !(opts.offline && bgIsRemote)) add(rasterLayers(bg, s.date, opts.offline));
  else {
    style.sources.world = { type: "geojson", data: "/geo/world.geojson" };
    style.layers.push(
      { id: "world-fill", type: "fill", source: "world", paint: { "fill-color": "#1d3b57" } },
      { id: "world-line", type: "line", source: "world", paint: { "line-color": COLORS.inkMuted, "line-width": 0.6 } },
    );
  }
  for (const id of s.imagery) {
    const l = layerById(id);
    if (l) add(rasterLayers(l, s.date, opts.offline));
  }
  if (s.aerosol) {
    const l = layerById(s.aerosol);
    if (l) add(rasterLayers(l, s.date, opts.offline, 0.85));
  }
  for (const id of s.overlays) {
    const l = layerById(id);
    if (l) add(rasterLayers(l, s.date, opts.offline));
  }
  if (s.mode === "global")
    for (const id of s.fireSats) {
      const l = layerById(id);
      if (l) add(rasterLayers(l, s.date, opts.offline));
    }
  return style;
}
