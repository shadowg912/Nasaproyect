/** Tipos compartidos entre servidor y cliente (sin dependencias de Node.js). */
export interface SyncStatus {
  state: "fresh" | "stored" | "offline" | "never";
  running: boolean;
  hasMapKey: boolean;
  /** Hay clave de Anthropic configurada para el chat IA. */
  hasAiKey: boolean;
  freshHours: number;
  lastSuccessAt: string | null;
  lastSuccessKind: string | null;
  lastSuccessInserted: number | null;
  lastAttemptAt: string | null;
  lastAttemptStatus: string | null;
  lastErrorType: string | null;
  lastErrorMessage: string | null;
  totalDetections: number;
  latestDetectionAt: string | null;
  firstDetectionDate: string | null;
}

export type Confidence = "low" | "nominal" | "high";

export interface DetectionFilters {
  from?: string;
  to?: string;
  sources?: string[];
  satellites?: string[];
  confidence?: Confidence[];
  provinceId?: number;
  municipalityId?: number;
  daynight?: "D" | "N";
  /** País ISO3 (los datos previos a la armonización son todos de RD). */
  iso3?: string;
  /** Área de interés `[oeste, sur, este, norte]`. */
  bbox?: [number, number, number, number];
  sensorFamily?: SensorFamily;
}

export interface Stats {
  filters: DetectionFilters;
  total: number;
  totalFrp: number;
  provincesAffected: number;
  highConfidence: number;
  byDay: { date: string; count: number; frp: number }[];
  byProvince: { id: number | null; name: string; count: number; frp: number }[];
  byConfidence: { confidence: Confidence; count: number }[];
  bySatellite: { satellite: string; count: number }[];
  byDaynight: { daynight: string; count: number }[];
}

export interface HistoryStats {
  byMonth: { month: string; count: number; frp: number }[];
  byYear: { year: string; count: number }[];
  monthOfYear: { month: number; count: number; years: number }[];
  topMunicipalities: { id: number; name: string; province: string | null; count: number }[];
  coverage: { source: string; dateFrom: string; dateTo: string; rowCount: number }[];
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = { low: "Baja", nominal: "Nominal", high: "Alta" };
export const SATELLITE_LABEL: Record<string, string> = {
  N: "Suomi NPP",
  N20: "NOAA-20",
  N21: "NOAA-21",
  Terra: "Terra (MODIS)",
  Aqua: "Aqua (MODIS)",
  T: "Terra (MODIS)",
  A: "Aqua (MODIS)",
};

/* ───────────── Contrato de API para la armonización MODIS + VIIRS (spec §6) ───────────── */

export type SensorFamily = "MODIS" | "VIIRS";
export type CalendarMode = "harmonized" | "raw";

/** Región consultada: país, provincia/municipio (solo RD) o área de interés (`aoi`: `w,s,e,n` o GeoJSON codificado). */
export interface RegionQuery {
  iso3: string;
  provinceId?: number;
  municipalityId?: number;
  aoi?: string;
  from?: string;
  to?: string;
}

export interface CountryInfo {
  iso3: string;
  name: string;
  loaded: boolean;
  /** `aggregate`: país grande, solo agregados mensuales + focos de los últimos 12 meses. */
  mode: "full" | "aggregate" | null;
  /** 0–1 durante una carga. */
  progress: number;
  years: { modis: [number, number] | null; viirs: [number, number] | null };
  /** Última fecha con datos (AAAA-MM-DD). */
  dataUntil: string | null;
}

export interface LoadJob {
  jobId: string;
  iso3: string;
  state: "queued" | "running" | "done" | "error";
  done: number;
  total: number;
  error: string | null;
}

export interface CalendarCell {
  year: number;
  month: number;
  /** Detecciones crudas de cada sensor (sin filtrar ni agrupar). */
  modis: number;
  viirs: number;
  /** Serie armonizada en «unidades VIIRS» (celdas-día); null si no hay calibración. */
  harmonized: number | null;
  /** Valor a pintar: `harmonized` en modo armonizado; en modo crudo MODIS antes de 2012 y VIIRS después. */
  value: number;
  /** value / mediana del mes; null si la mediana es 0 o no hay base. */
  anomaly: number | null;
  /** Meses con un solo satélite MODIS (Terra, antes de julio de 2002). */
  singleSatellite: boolean;
}

export interface MonthStat {
  month: number;
  median: number;
  p25: number;
  p75: number;
}

export interface Calibration {
  k: number;
  ci: [number, number];
  r2: number;
  overlapYears: [number, number];
  kTerra: number;
  /** `country`: la región tenía pocos datos y se usó el factor del país. */
  source: "region" | "country";
}

export interface CalendarResponse {
  mode: CalendarMode;
  region: RegionQuery;
  cells: CalendarCell[];
  monthStats: MonthStat[];
  calibration: Calibration | null;
  current: { year: number; month: number; value: number; median: number | null; ratio: number | null } | null;
  /** Meses del solape para el gráfico de validación de /metodologia: MODIS×k frente a VIIRS (celdas-día). */
  validation: { year: number; month: number; modisScaled: number; viirs: number }[];
}

export interface DetectionContext {
  imagery: { url: string; date: string; layer: string } | null;
  /** Clima del día; `source`: «NASA POWER» o «Open-Meteo» (respaldo). */
  weather: { windSpeed: number; windDir: number; t2m: number; rh: number; precip: number; source?: string } | null;
  cause: { label: string; likelihood: "alta" | "media" | "baja"; reasons: string[] };
  spread: { bearing: number; note: string } | null;
}

export interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  context?: RegionQuery;
}
