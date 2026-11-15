import path from "node:path";

/** Configuración del servidor. Solo debe importarse desde código de Node.js. */
export const NRT_SOURCES = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "VIIRS_SNPP_NRT"] as const;
export const SP_SOURCES = ["VIIRS_NOAA20_SP", "VIIRS_NOAA21_SP", "VIIRS_SNPP_SP"] as const;
export const ALL_SOURCES = [...NRT_SOURCES, ...SP_SOURCES, "MODIS_NRT", "MODIS_SP"] as const;
export type FirmsSource = (typeof ALL_SOURCES)[number];

/** Bounding box de República Dominicana: oeste, sur, este, norte. */
export const RD_BBOX = [-72.01, 17.47, -68.32, 19.93] as const;

function int(v: string | undefined, def: number, min: number, max: number) {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

export function getConfig() {
  const env = process.env;
  const sources = (env.FIRMS_SOURCES ?? NRT_SOURCES.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is FirmsSource => (ALL_SOURCES as readonly string[]).includes(s));
  return {
    mapKey: (env.FIRMS_MAP_KEY ?? "").trim(),
    databasePath: path.resolve(/*turbopackIgnore: true*/ env.DATABASE_PATH || "./data/fuego-rd.sqlite"),
    sources: sources.length ? sources : [...NRT_SOURCES],
    dayRange: int(env.FIRMS_DAY_RANGE, 2, 1, 5),
    syncIntervalMinutes: int(env.SYNC_INTERVAL_MINUTES, 30, 5, 24 * 60),
    freshHours: int(env.SYNC_FRESH_HOURS, 6, 1, 24 * 7),
    timeoutMs: int(env.FIRMS_TIMEOUT_MS, 30000, 1000, 300000),
    firmsBaseUrl: (env.FIRMS_BASE_URL || "https://firms.modaps.eosdis.nasa.gov").replace(/\/$/, ""),
    geoDir: path.resolve(/*turbopackIgnore: true*/ env.GEO_DIR || "./public/geo"),
  };
}
export type AppConfig = ReturnType<typeof getConfig>;
