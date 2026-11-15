# Parte 1 — Datos, armonización y API: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar el historial MODIS+VIIRS por país, armonizarlo en una serie mensual comparable 2000–hoy y servirlo por API (calendario, CSV, contexto de un foco, chat) para la interfaz que construye Codex.

**Architecture:** Funciones puras de armonización (`src/server/harmonize/`) probadas con datos sintéticos; un importador de archivos anuales por país que escribe en `fire_detections`; tablas derivadas (`harmonized_monthly`, `calibration`) reconstruidas tras cada carga; rutas Next `runtime = "nodejs"` delgadas sobre esas funciones. Integraciones NASA externas (GIBS, POWER) con caché en SQLite.

**Tech Stack:** Next.js 16, TypeScript, better-sqlite3 12.11.1, Drizzle (migraciones en `drizzle/`), Turf, Papa Parse, Vitest, `@anthropic-ai/sdk` (nuevo).

**Spec:** `docs/superpowers/specs/2026-11-14-fuego-rd-armonizacion-design.md` · Datos crudos: `data/raw/README.md`

## Global Constraints

- Solo fuentes NASA en ejecución (FIRMS, GIBS, POWER); única excepción la API de Anthropic para el chat.
- Toda ruta que toque SQLite: `export const runtime = "nodejs"`. Nunca Edge.
- `src/lib/*` sin dependencias de Node (lo importa el cliente).
- La sincronización/importación nunca borra datos. NRT vs SP: se reutiliza la regla `DEDUPE` de `src/server/queries.ts`.
- Claves (`FIRMS_MAP_KEY`, `ANTHROPIC_API_KEY`) nunca en respuestas, registros ni Git (`redact`).
- Fechas en UTC; los meses del calendario son meses UTC de `acq_date`.
- Archivos propiedad de la Parte 1 (spec §8). No tocar `src/components/**`, páginas ni `layout.tsx`.
- Antes de escribir código de Next, leer la guía relevante en `node_modules/next/dist/docs/`.
- Constantes de la spec: celda `0.01°`; MODIS confianza ≥ 30; VIIRS `nominal`/`high`; `fire_type = 0`; solape 2012–2025; línea base de anomalías 2003–(año actual − 1); Terra sola antes de `2002-07-04`; umbral de país grande 500 MB.

## Review Focus

- Área o región sin focos → calendario de ceros, `anomaly`/`ratio` en `null` (nunca `Infinity`/`NaN`), sin error 500.
- Mes con mediana 0 → `anomaly = null` y `ratio = null`.
- Región con pocos datos en el solape (municipio pequeño) → usa el `k` del país y lo marca `calibration.source = "country"`.
- Pedir la carga del mismo país dos veces a la vez → un único trabajo; la segunda llamada devuelve el mismo `jobId`.
- GIBS o POWER caídos / sin Internet → `/context` responde 200 con `imagery`/`weather` en `null`, nunca 500.

---

### Task 0: Repositorio git y base

**Files:** `.gitignore` (verificar), repositorio nuevo.

- [ ] **Step 1:** `git init`, confirmar que `.env`, `data/`, `node_modules/`, `.next/`, `*.log`, `node_modules.node22-failed/`, `.tools/` están ignorados (añadir los dos últimos y `*.log` a `.gitignore` si faltan).
- [ ] **Step 2:** `git status --short` no lista `.env` ni nada bajo `data/`.
- [ ] **Step 3:** Commit inicial `chore: estado base de Fuego RD`.

### Task 1: Contrato de API y datos de ejemplo (desbloquea a Codex)

**Files:**
- Modify: `src/lib/types.ts`
- Create: `tests/fixtures/api/{countries,calendar-dom,calendar-dom-raw,context,load-progress}.json`
- Test: `tests/unit/contract.test.ts`

**Interfaces — Produces** (en `src/lib/types.ts`, exportados):

```ts
export type SensorFamily = "MODIS" | "VIIRS";
export type CalendarMode = "harmonized" | "raw";
export interface RegionQuery { iso3: string; provinceId?: number; municipalityId?: number; aoi?: string; from?: string; to?: string }
export interface CountryInfo { iso3: string; name: string; loaded: boolean; mode: "full" | "aggregate" | null;
  progress: number; years: { modis: [number, number] | null; viirs: [number, number] | null }; dataUntil: string | null }
export interface LoadJob { jobId: string; iso3: string; state: "queued" | "running" | "done" | "error"; done: number; total: number; error: string | null }
export interface CalendarCell { year: number; month: number; modis: number; viirs: number; harmonized: number | null;
  value: number; anomaly: number | null; singleSatellite: boolean }
export interface MonthStat { month: number; median: number; p25: number; p75: number }
export interface Calibration { k: number; ci: [number, number]; r2: number; overlapYears: [number, number];
  kTerra: number; source: "region" | "country" }
export interface CalendarResponse { mode: CalendarMode; region: RegionQuery; cells: CalendarCell[]; monthStats: MonthStat[];
  calibration: Calibration | null; current: { year: number; month: number; value: number; median: number | null; ratio: number | null } | null;
  /** Meses del solape para el gráfico de validación de /metodologia: MODIS×k frente a VIIRS (celdas-día). */
  validation: { year: number; month: number; modisScaled: number; viirs: number }[] }
export interface DetectionContext {
  imagery: { url: string; date: string; layer: string } | null;
  weather: { windSpeed: number; windDir: number; t2m: number; rh: number; precip: number } | null;
  cause: { label: string; likelihood: "alta" | "media" | "baja"; reasons: string[] };
  spread: { bearing: number; note: string } | null }
export interface ChatRequest { messages: { role: "user" | "assistant"; content: string }[]; context?: RegionQuery }
```

`value` = `harmonized` en modo armonizado; en modo crudo = `modis` si `year < 2012`, si no `viirs`. `SyncStatus` gana `hasAiKey: boolean`.

- [ ] **Step 1: Test que falla** — `tests/unit/contract.test.ts`: importa cada fixture, comprueba con una función `isCalendarResponse(x)` (definida en el propio test) los campos obligatorios; `calendar-dom.json` tiene 312 celdas (2000–2025) y `mode: "harmonized"`; `calendar-dom-raw.json` tiene `value === viirs` en 2012 y `value === modis` en 2011; `countries.json` contiene `DOM` con `loaded: true`.
- [ ] **Step 2:** `npx vitest run tests/unit/contract.test.ts` → FAIL (fixtures no existen).
- [ ] **Step 3:** Añadir los tipos y generar los fixtures. Los conteos crudos de los fixtures salen de `data/raw/firms-country` (conteo por año/mes); `harmonized` puede ser provisional (MODIS × 4 antes de 2012), marcado con `"_note": "provisional"` en la raíz.
- [ ] **Step 4:** Test → PASS; `npm run lint` → sin errores.
- [ ] **Step 5:** Commit `feat(contract): tipos de API y fixtures para la interfaz`. **Avisar al usuario: Codex ya puede empezar.**

### Task 2: Esquema y migración

**Files:** Modify `src/db/schema.ts`; Create `drizzle/0001_*.sql` (generado); Test `tests/unit/schema.test.ts`.

**Interfaces — Produces:** tablas Drizzle `countries`, `countryLoads`, `harmonizedMonthly`, `calibrations`, `contextCache`; columnas nuevas en `fireDetections`: `countryIso3: text("country_iso3").notNull().default("DOM")`, `fireType: integer("fire_type")` (nullable), `sensorFamily: text("sensor_family", { enum: ["MODIS","VIIRS"] })`, índice `(country_iso3, acq_date)`.

- `countries(iso3 PK, name_es, firms_name, bbox_json, mode)`
- `country_loads(iso3, product, year, state, rows, error, updated_at; PK(iso3, product, year))`
- `harmonized_monthly(region_key, year, month, modis_raw, viirs_raw, modis_cd, viirs_cd, harmonized, single_satellite; PK(region_key, year, month))` — `region_key` = `iso3` | `iso3:p:<id>` | `iso3:m:<id>`; `*_cd` = celdas-día.
- `calibration(region_key PK, k, ci_lo, ci_hi, r2, k_terra, overlap_from, overlap_to, source, updated_at)`
- `context_cache(key PK, body, fetched_at)`

- [ ] **Step 1:** Test: base temporal (`tempDb()`), migraciones aplicadas; `PRAGMA table_info(fire_detections)` incluye `country_iso3`, `fire_type`, `sensor_family`; existen las 5 tablas nuevas; una fila previa sin `country_iso3` queda con `DOM`.
- [ ] **Step 2:** FAIL. **Step 3:** editar esquema, `npm run db:generate`. **Step 4:** PASS + `npm test` completo verde. **Step 5:** Commit `feat(db): esquema para historial por país y armonización`.

### Task 3: Lectura de `type` e instrumento en el CSV

**Files:** Modify `src/server/firms/csv.ts`; Test `tests/unit/csv.test.ts`.

**Interfaces — Produces:** `NormalizedDetection` gana `fireType: number | null` y `sensorFamily: SensorFamily` (de `instrument`: contiene `MODIS` → `MODIS`, si no `VIIRS`).

- [ ] **Step 1:** Tests: fila MODIS de `data/raw` (copiar 3 filas a `tests/fixtures/country-modis-2005.csv`) → `fireType` 2 y 0, `sensorFamily "MODIS"`; fila NRT sin columna `type` → `fireType null`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** Commit `feat(csv): tipo de fuego y familia de sensor`.

### Task 4: Motor de armonización (funciones puras)

**Files:** Create `src/server/harmonize/{cells.ts,calibrate.ts,series.ts,stats.ts}`; Test `tests/unit/harmonize.test.ts`.

**Interfaces — Produces:**

```ts
// cells.ts — celdas-día de 0.01°, solo detecciones válidas
export interface CellDetection { lat: number; lon: number; acqDate: string; family: SensorFamily; satellite: string;
  confidence: Confidence; fireType: number | null; staticCell?: boolean }
export const isValid: (d: CellDetection) => boolean          // fireType===0 (o null && !staticCell), confidence !== "low"
export function monthlyCounts(ds: CellDetection[]): Map<string /*YYYY-MM*/, { modisRaw: number; viirsRaw: number; modisCd: number; viirsCd: number; terraCd: number }>
// calibrate.ts
export function calibrate(m: ReturnType<typeof monthlyCounts>, overlap: [number, number], rng?: () => number): Calibration | null
// series.ts
export function harmonizedSeries(m: ReturnType<typeof monthlyCounts>, cal: Calibration, untilYear: number): CalendarCell[]
// stats.ts
export function monthStats(cells: CalendarCell[], baseline: [number, number]): MonthStat[]
export function withAnomaly(cells: CalendarCell[], stats: MonthStat[]): CalendarCell[]
```

Reglas: celda = `floor(lat/0.01), floor(lon/0.01)`, una por día y familia. `k = Σ viirsCd / Σ modisCd` en meses del solape con ambos > 0; IC 95 % por *bootstrap* de 1000 remuestreos de meses (con `rng` inyectable para pruebas); `r2` entre `modisCd × k` y `viirsCd` mensuales. `kTerra` = `Σ viirsCd / Σ terraCd` en el solape. Serie: mes < 2012 → `modisCd × (fecha < 2002-07 ? kTerra : k)` con `singleSatellite = fecha < 2002-07`; mes ≥ 2012 → `viirsCd`. `calibrate` devuelve `null` si hay < 12 meses de solape con datos.

- [ ] **Step 1: Tests que fallan**
  - `monthlyCounts`: dos detecciones VIIRS en la misma celda y día → `viirsCd 1`, `viirsRaw 2`; `fireType 2` excluida; confianza `low` excluida.
  - `calibrate`: datos sintéticos con VIIRS = 3 × MODIS exacto → `k` = 3 (±1e-9), `r2` = 1, `ci[0] ≤ 3 ≤ ci[1]`; < 12 meses → `null`.
  - `harmonizedSeries`: 2011-06 con `modisCd 10`, `k 3` → `harmonized 30`; 2001-03 usa `kTerra` y `singleSatellite true`.
  - `withAnomaly`: mediana 0 → `anomaly null`; valor 20 con mediana 10 → `2`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** Commit `feat(harmonize): celdas-día, calibración k y serie armonizada`.

### Task 5: Importador de archivos por país y reconstrucción derivada

**Files:** Create `src/server/history/{countries.ts,importCountry.ts,rebuild.ts}`, `scripts/history-country.ts`, `public/geo/world.geojson` (Natural Earth 1:50m admin-0, simplificado, con `ISO_A3` y nombre en español), `src/server/history/firmsNames.ts` (mapa ISO3 → nombre FIRMS para la URL); Modify `package.json` (`"history:country": "tsx scripts/history-country.ts"`); Test `tests/unit/history.test.ts`.

**Interfaces — Produces:**

```ts
export function seedCountries(db: DB, geoDir: string): number
export async function importCountry(db: DB, cfg: AppConfig, iso3: string, opts: { localDir?: string; fetchImpl?: FetchLike; onProgress?: (done: number, total: number) => void }): Promise<{ rows: number; mode: "full" | "aggregate" }>
export function importAreaFile(db: DB, file: string, source: string, iso3: "DOM"): number   // filtra con classifyPoint
export function rebuildHarmonized(db: DB, iso3: string): void   // país + provincias + municipios (solo DOM)
export function startLoad(db: DB, cfg: AppConfig, iso3: string): LoadJob   // idempotente por iso3
export function getLoad(iso3: string): LoadJob | null
```

- Fuente de cada fila del archivo anual: `MODIS_SP` / `VIIRS_SNPP_SP`; registrar `ingestion_coverage` por año para que `DEDUPE` excluya las NRT de esos días. `country_loads` por (producto, año) permite reanudar.
- `localDir` (p. ej. `data/raw/firms-country`) se lee antes de descargar; los años 404 se marcan `state = "missing"` sin error.
- Celdas fijas: celdas con `fire_type = 2` en cualquier año → `staticCell` para filas sin `type`.
- Modo agregado si el tamaño estimado (cabecera `Content-Length` de los archivos) > 500 MB: no inserta detecciones crudas salvo los últimos 12 meses; escribe directamente `harmonized_monthly`.
- `scripts/history-country.ts DOM --local data/raw/firms-country --area data/raw/firms-area/2026` importa todo RD.

- [ ] **Step 1: Tests** con `fetchImpl` simulado y dos archivos fixture: importar dos veces no duplica filas; año 404 → `missing`; `startLoad` dos veces seguidas → mismo `jobId`; `importAreaFile` descarta un punto en Haití; tras `rebuildHarmonized`, existen filas `DOM` y `DOM:p:<id>`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Ejecutar `npm run history:country -- DOM --local data/raw/firms-country --area data/raw/firms-area/2026`. Esperado: ~149 000 filas de archivo + filas 2026 dentro de RD; `calibration` de `DOM` con `k` entre 1 y 10 y `r2` > 0,5. Anotar k, IC y R² reales en el informe al usuario.
- [ ] **Step 6:** Commit `feat(history): importación por país y reconstrucción armonizada`.

### Task 6: Rutas de países, calendario y CSV

**Files:** Create `src/app/api/countries/route.ts`, `src/app/api/countries/[iso3]/load/route.ts`, `src/app/api/calendar/route.ts`, `src/app/api/export.csv/route.ts`, `src/server/calendar.ts`, `src/server/region.ts`; Modify `src/server/queries.ts` (`parseFilters` + `buildWhere` aceptan `iso3`, `aoi`, `sensorFamily`), `src/app/api/detections/route.ts`; Test `tests/unit/calendar.test.ts`.

**Interfaces — Produces:** `parseRegion(sp: URLSearchParams): RegionQuery`; `getCalendar(db: DB, q: RegionQuery, mode: CalendarMode, now?: Date): CalendarResponse`; `exportCsv(db: DB, q: RegionQuery, kind: "detections" | "monthly"): string`.

- Región con fila en `harmonized_monthly` → se lee; `aoi` → se calcula al vuelo con las funciones de la Task 4 sobre las detecciones del bbox/polígono, usando el `k` del país (`source = "country"`).
- `aoi`: `w,s,e,n` o GeoJSON de polígono URL-encoded; inválido → 400 con mensaje en español.
- CSV de detecciones: columnas `fecha,hora_utc,latitud,longitud,sensor,satelite,confianza,frp,tipo,provincia,municipio`; mensual: `anio,mes,modis_crudo,viirs_crudo,armonizado,anomalia`. `Content-Disposition: attachment; filename="fuego-<region>-<desde>-<hasta>.csv"`.

- [ ] **Step 1: Tests:** `getCalendar` en una base con datos sintéticos devuelve celdas ordenadas año/mes; modo `raw` → `value` = `modis` antes de 2012 y `viirs` después; AOI sin focos → todas las celdas 0, `current.ratio null`; mes con mediana 0 → `anomaly null`; región municipal sin solape → `calibration.source "country"`; `exportCsv` escapa comas en nombres.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Con el servidor en marcha, `curl "http://localhost:3000/api/calendar?iso3=DOM&mode=raw"` muestra el salto 2011→2012 y `mode=harmonized` lo atenúa. **Step 6:** Commit `feat(api): países, calendario armonizado y exportación CSV`. **Avisar a Codex: rutas reales listas.**

### Task 7: Contexto de un foco (GIBS, POWER, causa, propagación)

**Files:** Create `src/server/nasa/{gibs.ts,power.ts,cache.ts}`, `src/server/context.ts`, `src/app/api/detections/[id]/context/route.ts`, `src/app/api/imagery/route.ts`; Test `tests/unit/context.test.ts`.

**Interfaces — Produces:** `cached(db, key, ttlMs, fetcher): Promise<string | null>`; `gibsUrl(layer, date, bbox): string`; `fetchPower(db, lat, lon, date, fetchImpl?): Promise<DetectionContext["weather"]>`; `probableCause(db, detection): DetectionContext["cause"]`; `getContext(db, id, fetchImpl?): Promise<DetectionContext | null>`.

- GIBS WMS `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=<layer>&CRS=EPSG:4326&BBOX=<s,w,n,e>&WIDTH=512&HEIGHT=512&FORMAT=image/jpeg&TIME=<fecha>`; capa `MODIS_Terra_CorrectedReflectance_TrueColor`; bbox ±0,25° alrededor del foco. `imagery.url` apunta al proxy local `/api/imagery?...`, que guarda la imagen en `context_cache` (base64) y responde `image/jpeg`.
- POWER `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=WS10M,WD10M,T2M,RH2M,PRECTOTCORR&community=AG&longitude=<lon>&latitude=<lat>&start=<AAAAMMDD>&end=<AAAAMMDD>&format=JSON`; valores −999 → `weather null`.
- Propagación: `bearing = (WD10M + 180) % 360`, `note = "Estimación según el viento del día (NASA POWER); no es una predicción."`; sin clima → `null`.
- Causa (orden): `fireType` 1 → «Actividad volcánica»; 2 → «Fuente industrial o fija»; 3 → «Fuente costa afuera»; celda ardió en ≥ 3 años distintos en el mismo trimestre → «Probable quema agrícola o de limpieza recurrente» (`alta` si ≥ 5 años); mes del foco con mediana armonizada en el cuartil superior del año → «Temporada de quemas» (`media`); si no → «Incendio de vegetación (causa no determinada)» (`baja`). `reasons` explica cada señal en lenguaje sencillo.

- [ ] **Step 1: Tests:** `fetchImpl` que lanza error → `getContext` devuelve `imagery` con URL y `weather null`, `spread null`, sin excepción; POWER con −999 → `null`; viento desde 90° → `bearing 270`; foco con `fireType 2` → causa industrial; celda con focos en 5 años del mismo trimestre → `alta`; segunda llamada no vuelve a llamar a `fetchImpl` (caché).
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** Commit `feat(context): imagen GIBS, clima POWER, causa probable y propagación`.

### Task 8: Backend del chat IA

**Files:** `npm install @anthropic-ai/sdk`; Create `src/server/chat/{tools.ts,run.ts}`, `src/app/api/chat/route.ts`; Modify `src/lib/config.ts` (`anthropicKey: process.env.ANTHROPIC_API_KEY ?? ""`), `.env.example` (`ANTHROPIC_API_KEY=` vacía), `src/server/status.ts` (`hasAiKey`); Test `tests/unit/chat.test.ts`.

**Interfaces — Produces:** `chatTools(db: DB)` → definiciones + ejecutores de `consultar_calendario(RegionQuery & { mode })`, `resumen_focos(RegionQuery)`, `contexto_foco({ id })`, `metodologia()`; `runChat(db, cfg, req: ChatRequest): ReadableStream<Uint8Array>`.

- Modelo `claude-opus-5-5`, `output_config: { effort: "medium" }`, *streaming*, herramientas propias con `strict: true` más `web_search_20260209` y `web_fetch_20260209` con `allowed_domains: ["nasa.gov", "earthdata.nasa.gov", "firms.modaps.eosdis.nasa.gov"]`. Activar fallbacks del servidor (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`) y comprobar `stop_reason === "refusal"`. Leer `typescript/claude-api/tool-use.md` y `streaming.md` del skill `claude-api` antes de escribir el código.
- Sistema (español): responde solo con datos de las herramientas o de páginas de la NASA; si no hay fuente, lo dice; nunca afirma una causa como hecho; respuestas cortas y sin jerga.
- Sin clave → `503 { error: "no_api_key" }` sin llamar a la API. La clave nunca aparece en errores.

- [ ] **Step 1: Tests:** `POST /api/chat` con `anthropicKey ""` → 503 `no_api_key`; ejecutor `consultar_calendario` devuelve el mismo objeto que `getCalendar`; `getSyncStatus().hasAiKey` refleja la configuración.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** Commit `feat(chat): backend con herramientas sobre datos propios y fuentes NASA`.

### Task 9: Documentación, regla de fuentes y verificación final

**Files:** Modify `CLAUDE.md` (regla «solo fuentes de la NASA + API de Anthropic para el chat»), `docs/PLAN.md` (enlace a la spec y a este plan), `README.md` (comando `history:country`, `ANTHROPIC_API_KEY`).

- [ ] **Step 1:** `npm run lint` y `npm test` → todo verde.
- [ ] **Step 2:** `npm run build` → sin errores (con el servidor de desarrollo detenido o en otra carpeta `.next` si Codex lo está usando; coordinar con el usuario).
- [ ] **Step 3:** Informe al usuario con k, IC, R², el salto crudo 2011→2012 y el resultado armonizado, para la presentación.
- [ ] **Step 4:** Commit `docs: regla de fuentes NASA y guía de historial`.
