/**
 * Contrato del mapa compartido entre la Parte A (MapApp, MapView, LayerPanel) y las herramientas de la Parte B
 * (Toolbar, Timeline, herramientas, paneles). Sin dependencias de Node.
 */
export type MapMode = "global" | "local";
export type TimeRange = "24h" | "48h" | "week";
export type FireStyle = "simple" | "age" | "confidence";
export type ToolId = "measure" | "location" | "layers" | "timeline" | "capture" | "share" | "help" | "view";

export interface MapState {
  mode: MapMode;
  /** [lon, lat] */
  center: [number, number];
  zoom: number;
  /** Día elegido en la línea de tiempo, AAAA-MM-DD (UTC). */
  date: string;
  range: TimeRange;
  background: string;
  overlays: string[];
  imagery: string[];
  aerosol: string | null;
  fireSats: string[];
  fireStyle: FireStyle;
  projection: "mercator" | "globe";
  /** País en estudio (Local siempre "DOM"). */
  iso3: string;
}

export interface PeriodBounds {
  from: string;
  to: string;
  /** Fin del periodo (ISO UTC); la antigüedad de los focos se mide desde aquí. */
  end: string;
}

/** Área de interés dibujada con Medir o elegida con Ubicación: `w,s,e,n` o GeoJSON, como espera `/api/calendar?aoi=`. */
export type Aoi = string | null;

export interface MapAppValue {
  state: MapState;
  setState: (patch: Partial<MapState>) => void;
  /** Instancia de MapLibre (null hasta que carga). */
  map: import("maplibre-gl").Map | null;
  openTool: ToolId | null;
  setOpenTool: (t: ToolId | null) => void;
  /** Sin acceso a fondos de terceros: se usa el fondo local. */
  offline: boolean;
  period: PeriodBounds;
  /** Foco seleccionado (id de detección) para el panel de detalle. */
  selectedFocus: string | null;
  setSelectedFocus: (id: string | null) => void;
  aoi: Aoi;
  setAoi: (aoi: Aoi) => void;
  /** Panel inferior de Historia (calendario). */
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
  /** Local: provincia o municipio elegidos para Historia. */
  region: { provinceId?: number; municipalityId?: number };
  setRegion: (r: { provinceId?: number; municipalityId?: number }) => void;
}
