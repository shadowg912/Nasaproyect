import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const provinces = sqliteTable("provinces", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  areaKm2: real("area_km2"),
});

export const municipalities = sqliteTable(
  "municipalities",
  {
    id: integer("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    provinceId: integer("province_id").references(() => provinces.id),
    areaKm2: real("area_km2"),
  },
  (t) => [index("municipalities_province_idx").on(t.provinceId)],
);

export const ingestionRuns = sqliteTable(
  "ingestion_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: ["sync", "history", "public_feed"] }).notNull(),
    trigger: text("trigger").notNull().default("manual"),
    status: text("status", { enum: ["running", "success", "partial", "failed"] }).notNull(),
    sources: text("sources").notNull(),
    dateFrom: text("date_from"),
    dateTo: text("date_to"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    requests: integer("requests").notNull().default(0),
    rowsFetched: integer("rows_fetched").notNull().default(0),
    rowsInCountry: integer("rows_in_country").notNull().default(0),
    rowsInserted: integer("rows_inserted").notNull().default(0),
    rowsUpdated: integer("rows_updated").notNull().default(0),
    rowsRejected: integer("rows_rejected").notNull().default(0),
    errorType: text("error_type", {
      enum: ["network", "auth", "rate_limit", "invalid_response", "server", "config", "other"],
    }),
    errorMessage: text("error_message"),
  },
  (t) => [index("ingestion_runs_started_idx").on(t.startedAt), index("ingestion_runs_status_idx").on(t.status)],
);

export const fireDetections = sqliteTable(
  "fire_detections",
  {
    /** Hash determinístico de fuente + coordenadas + fecha/hora + satélite. */
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    satellite: text("satellite").notNull(),
    instrument: text("instrument").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    acqDate: text("acq_date").notNull(),
    acqTime: text("acq_time").notNull(),
    acquiredAt: text("acquired_at").notNull(),
    brightness: real("brightness"),
    brightnessT31: real("bright_t31"),
    scan: real("scan"),
    track: real("track"),
    frp: real("frp"),
    confidence: text("confidence", { enum: ["low", "nominal", "high"] }).notNull(),
    confidenceRaw: text("confidence_raw").notNull(),
    version: text("version"),
    daynight: text("daynight", { enum: ["D", "N"] }),
    provinceId: integer("province_id").references(() => provinces.id),
    municipalityId: integer("municipality_id").references(() => municipalities.id),
    ingestionRunId: integer("ingestion_run_id").references(() => ingestionRuns.id),
    firstSeenAt: text("first_seen_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    /** País ISO 3166-1 alfa-3 (los datos anteriores a la armonización son todos de RD). */
    countryIso3: text("country_iso3").notNull().default("DOM"),
    /** Columna `type` de FIRMS: 0 vegetación, 1 volcán, 2 fuente fija, 3 costa afuera; null en NRT. */
    fireType: integer("fire_type"),
    sensorFamily: text("sensor_family", { enum: ["MODIS", "VIIRS"] }),
  },
  (t) => [
    index("fire_country_date_idx").on(t.countryIso3, t.acqDate),
    index("fire_acq_date_idx").on(t.acqDate),
    index("fire_source_date_idx").on(t.source, t.acqDate),
    index("fire_satellite_date_idx").on(t.satellite, t.acqDate),
    index("fire_province_date_idx").on(t.provinceId, t.acqDate),
    index("fire_municipality_idx").on(t.municipalityId),
  ],
);

export const ingestionCoverage = sqliteTable(
  "ingestion_coverage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").notNull(),
    /** Intervalo cerrado [date_from, date_to] consultado con éxito. */
    dateFrom: text("date_from").notNull(),
    dateTo: text("date_to").notNull(),
    rowCount: integer("row_count").notNull().default(0),
    runId: integer("run_id").references(() => ingestionRuns.id),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [
    uniqueIndex("coverage_source_interval_uq").on(t.source, t.dateFrom, t.dateTo),
    index("coverage_dates_idx").on(t.dateFrom, t.dateTo),
  ],
);

/** Bloqueo entre procesos para impedir sincronizaciones simultáneas. */
export const syncLock = sqliteTable("sync_lock", {
  name: text("name").primaryKey(),
  owner: text("owner").notNull(),
  acquiredAt: text("acquired_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});


/* ───────────── Historial por país y armonización MODIS + VIIRS ───────────── */

export const countries = sqliteTable("countries", {
  iso3: text("iso3").primaryKey(),
  nameEs: text("name_es").notNull(),
  /** Nombre usado en las URL de archivos por país de FIRMS (p. ej. `Dominican_Republic`). */
  firmsName: text("firms_name").notNull(),
  bboxJson: text("bbox_json").notNull(),
  mode: text("mode", { enum: ["full", "aggregate"] }),
});

/** Estado de descarga por país, producto y año (permite reanudar). */
export const countryLoads = sqliteTable(
  "country_loads",
  {
    iso3: text("iso3").notNull(),
    product: text("product").notNull(),
    year: integer("year").notNull(),
    state: text("state", { enum: ["pending", "running", "done", "missing", "error"] }).notNull(),
    rows: integer("rows").notNull().default(0),
    error: text("error"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.iso3, t.product, t.year] })],
);

/** Serie mensual derivada. `region_key`: `ISO3`, `ISO3:p:<id>` o `ISO3:m:<id>`; `*_cd` = celdas-día. */
export const harmonizedMonthly = sqliteTable(
  "harmonized_monthly",
  {
    regionKey: text("region_key").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    modisRaw: integer("modis_raw").notNull().default(0),
    viirsRaw: integer("viirs_raw").notNull().default(0),
    modisCd: integer("modis_cd").notNull().default(0),
    viirsCd: integer("viirs_cd").notNull().default(0),
    harmonized: real("harmonized"),
    singleSatellite: integer("single_satellite", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.regionKey, t.year, t.month] })],
);

export const calibrations = sqliteTable("calibration", {
  regionKey: text("region_key").primaryKey(),
  k: real("k").notNull(),
  ciLo: real("ci_lo").notNull(),
  ciHi: real("ci_hi").notNull(),
  r2: real("r2").notNull(),
  kTerra: real("k_terra").notNull(),
  overlapFrom: integer("overlap_from").notNull(),
  overlapTo: integer("overlap_to").notNull(),
  source: text("source", { enum: ["region", "country"] }).notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Caché de respuestas externas de la NASA (GIBS, POWER). */
export const contextCache = sqliteTable("context_cache", {
  key: text("key").primaryKey(),
  body: text("body").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});
