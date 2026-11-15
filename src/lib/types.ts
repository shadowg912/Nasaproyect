/** Tipos compartidos entre servidor y cliente (sin dependencias de Node.js). */
export interface SyncStatus {
  state: "fresh" | "stored" | "offline" | "never";
  running: boolean;
  hasMapKey: boolean;
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
