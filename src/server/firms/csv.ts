import crypto from "node:crypto";
import Papa from "papaparse";

export interface NormalizedDetection {
  id: string;
  source: string;
  satellite: string;
  instrument: string;
  latitude: number;
  longitude: number;
  acqDate: string;
  acqTime: string;
  acquiredAt: string;
  brightness: number | null;
  brightnessT31: number | null;
  scan: number | null;
  track: number | null;
  frp: number | null;
  confidence: "low" | "nominal" | "high";
  confidenceRaw: string;
  version: string | null;
  daynight: "D" | "N" | null;
  /** Columna `type` de FIRMS (0 vegetación, 1 volcán, 2 fuente fija, 3 costa afuera); null si no viene (NRT). */
  fireType: number | null;
  sensorFamily: "MODIS" | "VIIRS";
}

const FIRE_TYPES = new Set([0, 1, 2, 3]);
const fireTypeOf = (v: string | undefined): number | null => {
  const n = num(v);
  return n !== null && FIRE_TYPES.has(n) ? n : null;
};

export class FirmsResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirmsResponseError";
  }
}

const REQUIRED = ["latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence"];

const num = (v: unknown) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function normalizeConfidence(raw: string): NormalizedDetection["confidence"] | null {
  const v = raw.trim().toLowerCase();
  if (v === "l" || v === "low") return "low";
  if (v === "n" || v === "nominal") return "nominal";
  if (v === "h" || v === "high") return "high";
  // MODIS: porcentaje 0-100
  const n = Number(v);
  if (v !== "" && Number.isFinite(n) && n >= 0 && n <= 100) return n < 30 ? "low" : n < 80 ? "nominal" : "high";
  return null;
}

/** Identificador determinístico: la misma observación siempre produce el mismo id. */
export function detectionId(source: string, lat: number, lon: number, date: string, time: string, satellite: string) {
  return crypto
    .createHash("sha1")
    .update(`${source}|${lat.toFixed(5)}|${lon.toFixed(5)}|${date}|${time}|${satellite}`)
    .digest("hex")
    .slice(0, 32);
}

export interface ParseResult {
  records: NormalizedDetection[];
  rejected: number;
  totalRows: number;
}

/**
 * Valida y normaliza un CSV de FIRMS. Lanza FirmsResponseError si la respuesta
 * no es un CSV de FIRMS (por ejemplo, un mensaje de error en texto plano o HTML).
 * Un CSV con solo encabezado es válido y significa "sin detecciones".
 */
export function parseFirmsCsv(text: string, source: string): ParseResult {
  const trimmed = text.replace(/^﻿/, "").trim();
  if (!trimmed) throw new FirmsResponseError("Respuesta vacía de FIRMS");
  const firstLine = trimmed.split(/\r?\n/, 1)[0];
  const header = firstLine.split(",").map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) {
    throw new FirmsResponseError(`Respuesta no válida de FIRMS: ${firstLine.slice(0, 160)}`);
  }
  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const instrumentDefault = source.startsWith("MODIS") ? "MODIS" : "VIIRS";
  const records: NormalizedDetection[] = [];
  let rejected = 0;
  for (const r of parsed.data) {
    const lat = num(r.latitude);
    const lon = num(r.longitude);
    const date = (r.acq_date ?? "").trim();
    const time = (r.acq_time ?? "").trim().padStart(4, "0");
    const satellite = (r.satellite ?? "").trim();
    const confidence = normalizeConfidence(r.confidence ?? "");
    if (
      lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}$/.test(time) || !satellite || !confidence
    ) {
      rejected++;
      continue;
    }
    const acquiredAt = `${date}T${time.slice(0, 2)}:${time.slice(2)}:00Z`;
    if (Number.isNaN(Date.parse(acquiredAt))) {
      rejected++;
      continue;
    }
    const dn = (r.daynight ?? "").trim().toUpperCase();
    records.push({
      id: detectionId(source, lat, lon, date, time, satellite),
      source,
      satellite,
      instrument: (r.instrument ?? "").trim() || instrumentDefault,
      latitude: lat,
      longitude: lon,
      acqDate: date,
      acqTime: time,
      acquiredAt,
      brightness: num(r.bright_ti4 ?? r.brightness),
      brightnessT31: num(r.bright_ti5 ?? r.bright_t31),
      scan: num(r.scan),
      track: num(r.track),
      frp: num(r.frp),
      confidence,
      confidenceRaw: (r.confidence ?? "").trim(),
      version: (r.version ?? "").trim() || null,
      daynight: dn === "D" || dn === "N" ? dn : null,
      fireType: fireTypeOf(r.type),
      sensorFamily: ((r.instrument ?? "").trim() || instrumentDefault).toUpperCase().includes("MODIS") ? "MODIS" : "VIIRS",
    });
  }
  return { records, rejected, totalRows: parsed.data.length };
}
