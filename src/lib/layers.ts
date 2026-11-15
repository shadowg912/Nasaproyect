/**
 * Registro único de capas del mapa (spec de rediseño §6). Ids de GIBS verificados en el GetCapabilities EPSG:3857 del
 * 2026-11-15. Las capas de la NASA se piden por el proxy local `/api/tiles/gibs/...`; las de terceros van directas con
 * atribución. Sin dependencias de Node: lo usan el cliente y el servidor.
 */
export type LayerGroup = "background" | "overlay" | "imagery" | "aerosol" | "fires";
export type LayerSource = "gibs" | "esri" | "wdpa" | "local";

export interface LayerDef {
  id: string;
  group: LayerGroup;
  name: string;
  source: LayerSource;
  kind: "raster" | "geojson";
  /** Capas GIBS que componen esta entrada (se superponen en orden). */
  gibsIds?: string[];
  /** Plantilla XYZ o WMS directa para terceros (`{z}/{y}/{x}` o `{bbox-epsg-3857}`). */
  template?: string;
  /** GeoJSON local (`/geo/...`). */
  url?: string;
  dated: boolean;
  /** Rango con datos (AAAA-MM-DD); sin `to` = hasta hoy. */
  available?: { from: string; to?: string };
  maxZoom: number;
  attribution: string;
  /** Satélite de focos (filtro de `/api/detections`): coincide con PLATFORMS de la API. */
  satellite?: string;
  legend?: { min: string; max: string; colors: string[] };
  description?: string;
}

/** Metadatos de cada capa GIBS permitida en el proxy. `wms`: se pide por WMS (capas de focos, solo vectoriales en WMTS). */
export const GIBS_META: Record<string, { format: "jpeg" | "png"; maxZoom: number; wms?: boolean; subdaily?: boolean }> = {
  BlueMarble_ShadedRelief_Bathymetry: { format: "jpeg", maxZoom: 8 },
  Graticule_15m: { format: "png", maxZoom: 13 },
  Coastlines_15m: { format: "png", maxZoom: 13 },
  Reference_Features_15m: { format: "png", maxZoom: 13 },
  Reference_Labels_15m: { format: "png", maxZoom: 13 },
  VIIRS_NOAA20_NDSI_Snow_Cover: { format: "png", maxZoom: 8 },
  "Landsat_Human_Built-up_And_Settlement_Extent": { format: "png", maxZoom: 12 },
  "GOES-West_ABI_GeoColor": { format: "png", maxZoom: 7, subdaily: true },
  "GOES-East_ABI_GeoColor": { format: "png", maxZoom: 7, subdaily: true },
  VIIRS_NOAA20_CorrectedReflectance_TrueColor: { format: "jpeg", maxZoom: 9 },
  VIIRS_NOAA21_CorrectedReflectance_TrueColor: { format: "jpeg", maxZoom: 9 },
  VIIRS_SNPP_CorrectedReflectance_TrueColor: { format: "jpeg", maxZoom: 9 },
  MODIS_Aqua_CorrectedReflectance_TrueColor: { format: "jpeg", maxZoom: 9 },
  MODIS_Terra_CorrectedReflectance_TrueColor: { format: "jpeg", maxZoom: 9 },
  OMPS_NOAA20_NadirMapper_AerosolIndex_380: { format: "png", maxZoom: 6 },
  OMPS_NOAA20_NadirMapper_AerosolIndex_PyroCumuloNimbus_380: { format: "png", maxZoom: 6 },
  OMPS_NOAA21_NadirMapper_AerosolIndex_380: { format: "png", maxZoom: 6 },
  OMPS_NOAA21_NadirMapper_AerosolIndex_PyroCumuloNimbus_380: { format: "png", maxZoom: 6 },
  OMPS_Aerosol_Index: { format: "png", maxZoom: 6 },
  OMPS_Aerosol_Index_PyroCumuloNimbus: { format: "png", maxZoom: 6 },
  VIIRS_NOAA20_Thermal_Anomalies_375m_All: { format: "png", maxZoom: 12, wms: true },
  VIIRS_NOAA21_Thermal_Anomalies_375m_All: { format: "png", maxZoom: 12, wms: true },
  VIIRS_SNPP_Thermal_Anomalies_375m_All: { format: "png", maxZoom: 12, wms: true },
  MODIS_Aqua_Thermal_Anomalies_All: { format: "png", maxZoom: 12, wms: true },
  MODIS_Terra_Thermal_Anomalies_All: { format: "png", maxZoom: 12, wms: true },
};

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const ESRI_ATTR = "Esri y colaboradores (Garmin, HERE, USGS, NGA, OpenStreetMap y otros)";
const NASA = "NASA GIBS / EOSDIS";
const SNPP_END = "2026-11-02";
const AEROSOL_LEGEND = { min: "0", max: "≥ 5", colors: ["#fff7bc", "#fec44f", "#fe9929", "#d95f0e", "#993404"] };

const gibs = (id: string, group: LayerGroup, name: string, gibsIds: string[], dated: boolean, extra: Partial<LayerDef> = {}): LayerDef => ({
  id, group, name, source: "gibs", kind: "raster", gibsIds, dated,
  maxZoom: Math.min(...gibsIds.map((g) => GIBS_META[g].maxZoom)), attribution: NASA, ...extra,
});
const esri = (id: string, name: string, path: string, extra: Partial<LayerDef> = {}): LayerDef => ({
  id, group: "background", name, source: "esri", kind: "raster", template: `${ESRI}/${path}/MapServer/tile/{z}/{y}/{x}`,
  dated: false, maxZoom: 19, attribution: ESRI_ATTR, ...extra,
});

export const LAYERS: LayerDef[] = [
  // Fondos estáticos (uno a la vez)
  gibs("blue-marble", "background", "Blue Marble", ["BlueMarble_ShadedRelief_Bathymetry"], false, { description: "Relieve y batimetría de la NASA." }),
  {
    id: "esri-firefly", group: "background", name: "Firefly", source: "esri", kind: "raster", dated: false, maxZoom: 19,
    template: "https://fly.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Firefly/MapServer/tile/{z}/{y}/{x}",
    attribution: `${ESRI_ATTR}; imágenes: Maxar, Earthstar Geographics`,
  },
  esri("esri-streets", "Calles", "World_Street_Map"),
  esri("esri-light-gray", "Gris claro", "Canvas/World_Light_Gray_Base"),
  esri("esri-dark-gray", "Gris oscuro", "Canvas/World_Dark_Gray_Base"),
  esri("esri-topo", "Topográfico", "World_Topo_Map"),

  // Overlays (varios)
  gibs("graticule", "overlay", "Latitud y longitud", ["Graticule_15m"], false),
  {
    id: "volcanoes", group: "overlay", name: "Volcanes", source: "local", kind: "geojson", url: "/geo/volcanoes.geojson",
    dated: false, maxZoom: 22, attribution: "Smithsonian Institution, Global Volcanism Program",
  },
  gibs("reference-basic", "overlay", "Costas, límites y carreteras (básico)", ["Coastlines_15m", "Reference_Features_15m"], false),
  gibs("reference-detailed", "overlay", "Límites, carreteras y nombres (detallado)", ["Reference_Features_15m", "Reference_Labels_15m"], false),
  gibs("snow-noaa20", "overlay", "Nieve (NDSI) VIIRS NOAA-20", ["VIIRS_NOAA20_NDSI_Snow_Cover"], true, {
    available: { from: "2018-01-05" }, legend: { min: "1", max: "100", colors: ["#e8e98a", "#e7c27d", "#e59f7c", "#e27b78", "#e05269"] },
  }),
  gibs("built-up", "overlay", "Zonas construidas (Landsat)", ["Landsat_Human_Built-up_And_Settlement_Extent"], false),
  {
    id: "protected-areas", group: "overlay", name: "Áreas protegidas", source: "wdpa", kind: "raster", dated: false, maxZoom: 19,
    template:
      "https://data-gis.unep-wcmc.org/server/rest/services/ProtectedSites/The_World_Database_of_Protected_Areas/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image",
    attribution: "UNEP-WCMC e IUCN, Protected Planet (WDPA)",
  },

  // Imágenes dinámicas (con fecha)
  gibs("goes-west", "imagery", "GOES-West GeoColor", ["GOES-West_ABI_GeoColor"], true, { available: { from: "2026-08-11" } }),
  gibs("goes-east", "imagery", "GOES-East GeoColor", ["GOES-East_ABI_GeoColor"], true, { available: { from: "2026-08-11" } }),
  gibs("viirs-noaa20", "imagery", "VIIRS NOAA-20 (color real)", ["VIIRS_NOAA20_CorrectedReflectance_TrueColor"], true, { available: { from: "2018-01-05" } }),
  gibs("viirs-noaa21", "imagery", "VIIRS NOAA-21 (color real)", ["VIIRS_NOAA21_CorrectedReflectance_TrueColor"], true, { available: { from: "2023-02-10" } }),
  gibs("viirs-snpp", "imagery", "VIIRS Suomi NPP (color real)", ["VIIRS_SNPP_CorrectedReflectance_TrueColor"], true, { available: { from: "2015-11-24", to: SNPP_END } }),
  gibs("modis-aqua", "imagery", "MODIS Aqua (color real)", ["MODIS_Aqua_CorrectedReflectance_TrueColor"], true, { available: { from: "2002-07-03" } }),
  gibs("modis-terra", "imagery", "MODIS Terra (color real)", ["MODIS_Terra_CorrectedReflectance_TrueColor"], true, { available: { from: "2000-02-24" } }),

  // Humo y aerosoles (uno)
  gibs("omps-noaa20", "aerosol", "Índice de aerosoles OMPS NOAA-20", ["OMPS_NOAA20_NadirMapper_AerosolIndex_380"], true, { available: { from: "2025-04-28" }, legend: AEROSOL_LEGEND }),
  gibs("omps-noaa20-pyrocb", "aerosol", "OMPS NOAA-20 pirocumulonimbos", ["OMPS_NOAA20_NadirMapper_AerosolIndex_PyroCumuloNimbus_380"], true, { available: { from: "2025-04-28" }, legend: AEROSOL_LEGEND }),
  gibs("omps-noaa21", "aerosol", "Índice de aerosoles OMPS NOAA-21", ["OMPS_NOAA21_NadirMapper_AerosolIndex_380"], true, { available: { from: "2025-04-28" }, legend: AEROSOL_LEGEND }),
  gibs("omps-noaa21-pyrocb", "aerosol", "OMPS NOAA-21 pirocumulonimbos", ["OMPS_NOAA21_NadirMapper_AerosolIndex_PyroCumuloNimbus_380"], true, { available: { from: "2025-04-28" }, legend: AEROSOL_LEGEND }),
  gibs("omps-snpp", "aerosol", "Índice de aerosoles OMPS Suomi NPP", ["OMPS_Aerosol_Index"], true, { available: { from: "2012-01-26", to: SNPP_END }, legend: AEROSOL_LEGEND }),
  gibs("omps-snpp-pyrocb", "aerosol", "OMPS Suomi NPP pirocumulonimbos", ["OMPS_Aerosol_Index_PyroCumuloNimbus"], true, { available: { from: "2012-01-26", to: SNPP_END }, legend: AEROSOL_LEGEND }),

  // Focos de calor por satélite (varios)
  gibs("fires-viirs-noaa20", "fires", "VIIRS NOAA-20 [375 m]", ["VIIRS_NOAA20_Thermal_Anomalies_375m_All"], true, { available: { from: "2020-01-01" }, satellite: "NOAA20" }),
  gibs("fires-viirs-noaa21", "fires", "VIIRS NOAA-21 [375 m]", ["VIIRS_NOAA21_Thermal_Anomalies_375m_All"], true, { available: { from: "2024-01-17" }, satellite: "NOAA21" }),
  gibs("fires-viirs-snpp", "fires", "VIIRS Suomi NPP [375 m]", ["VIIRS_SNPP_Thermal_Anomalies_375m_All"], true, { available: { from: "2012-01-20", to: SNPP_END }, satellite: "SNPP" }),
  gibs("fires-modis-aqua", "fires", "MODIS Aqua [1 km]", ["MODIS_Aqua_Thermal_Anomalies_All"], true, { available: { from: "2002-07-04" }, satellite: "MODIS" }),
  gibs("fires-modis-terra", "fires", "MODIS Terra [1 km]", ["MODIS_Terra_Thermal_Anomalies_All"], true, { available: { from: "2000-11-01" }, satellite: "MODIS" }),
];

export const DEFAULT_BACKGROUND = "esri-dark-gray";
export const GROUP_LABELS: Record<LayerGroup, string> = {
  background: "Fondos",
  overlay: "Capas de referencia",
  imagery: "Imágenes del día",
  aerosol: "Humo y aerosoles",
  fires: "Focos de calor",
};

const BY_ID = new Map(LAYERS.map((l) => [l.id, l]));
export const layerById = (id: string) => BY_ID.get(id);
export const GIBS_ALLOWED: ReadonlySet<string> = new Set(Object.keys(GIBS_META));

/** ¿Tiene la capa datos para ese día? Capas sin fecha: siempre. */
export function availableOn(layer: LayerDef, date: string): boolean {
  if (!layer.available) return true;
  return date >= layer.available.from && (!layer.available.to || date <= layer.available.to);
}

/** URLs de teselas para MapLibre: GIBS por el proxy local (una por capa GIBS), terceros directas. */
export function tileUrls(layer: LayerDef, date: string): string[] {
  if (layer.source === "gibs") return (layer.gibsIds ?? []).map((g) => `/api/tiles/gibs/${g}/${layer.dated ? date : "default"}/{z}/{y}/{x}`);
  return layer.template ? [layer.template] : [];
}
