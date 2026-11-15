# Parte A — Mapa a pantalla completa, capas y herramientas: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir los paneles actuales por un mapa a pantalla completa estilo FIRMS (Global y Local) con catálogo de capas, 8 herramientas, línea de tiempo y paneles flotantes, sobre tokens de color nuevos.

**Architecture:** Lógica pura y probada en `src/lib/` (tokens, registro de capas, estado del mapa en URL, construcción del estilo MapLibre, utilidades de herramientas); proxy GIBS en el servidor con caché en disco; componentes React en `src/components/ui/**` (primitivos) y `src/components/map/**` (mapa, paneles, barra). Las páginas `/global` y `/local` montan el mismo `MapApp` con un `mode`.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, MapLibre 6.18 (proyección globe), Turf, three (lo usa la Parte B), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-rediseno-ui-mapa-design.md` (+ §14 aclaraciones).

## Global Constraints

- Paleta base: `#014683`, `#08569a`, `#1a90d0`, `#ffffff`; tokens y contraste según spec §4 (AA).
- Datos solo NASA; fondos/overlays de terceros con atribución visible (Esri, UNEP-WCMC, Smithsonian). Esri sin caché.
- Teselas GIBS solo vía `/api/tiles/gibs/...` con lista blanca del registro; caché en `data/cache/gibs/`.
- Fondo por defecto: Dark Gray (Esri); si falla, fondo local GeoJSON + aviso.
- «Local» = República Dominicana; `/rd` redirige a `/local`.
- Máx. 8 botones en la barra; una herramienta abierta a la vez; grupos de capas plegados.
- WCAG 2.2 AA; `prefers-reduced-motion`; objetivos ≥ 24 px; `Esc` cierra paneles; atajos L, T, M, /.
- Interfaz en español. No tocar archivos de la Parte B (spec §11, §14.4). Leer `node_modules/next/dist/docs/` antes de código Next.
- Antigüedad de focos relativa al final del periodo de la línea de tiempo.

## Review Focus

- Sin Internet (Esri/GIBS caídos) → el mapa no queda en blanco: fondo local + aviso; el resto de la UI sigue usable.
- Fecha fuera del rango de una capa (Suomi NPP después de 2026-11-02) → la capa se marca «sin datos para esta fecha», no teselas vacías sin explicación.
- Enlace compartido con parámetros inválidos o capas inexistentes → se ignoran y se usa el estado por defecto, sin error.
- Búsqueda de ubicación con texto que no es coordenada ni lugar conocido → «no encontrado», sin mover el mapa.
- Proxy con id de capa, fecha o z/x/y fuera de rango → 400 sin llamar a GIBS.

---

### Task 0: Contrato visual y recursos (desbloquea a Codex)

**Files:** Modify `src/app/globals.css`, `package.json`, `CLAUDE.md`, `docs/PLAN.md`; Create `src/lib/tokens.ts`, `src/components/ui/{Skeleton,Button,IconButton,Panel,Icon}.tsx`, `scripts/globe-prepare.ts`, `src/server/globe.ts`, `public/data/globe-fires.json`, `public/textures/blue-marble.jpg`; Test `tests/unit/tokens.test.ts`, `tests/unit/globe.test.ts`.

**Interfaces — Produces:**
- `tokens.ts`: `COLORS = { brand900:"#014683", brand700:"#08569a", brand500:"#1a90d0", brand50:"#e8f3fb", ink:"#ffffff", inkMuted:"#c9dcef", surface:"#ffffff", text:"#0b2440", warn:"#f5b700" }`; `FIRE_AGE_RAMP: { maxHours: number; color: string }[]` (1→`#8b0000`, 3→`#e01b1b`, 6→`#f2711c`, 12→`#f5b700`, 24→`#fde68a`, Infinity→`#d9d2b5`); `contrastRatio(a: string, b: string): number`.
- CSS: `--color-brand-900|700|500|50`, `--color-ink`, `--color-ink-muted`, `--color-surface`, `--color-text`, `--color-warn`, `--color-fire-*`, `--radius-sm|md|lg` (8/12/16 px), `--shadow-float`, `--topbar-h: 56px`, `--glass`; utilidades Tailwind vía `@theme`.
- UI: `Skeleton({ className, label })` (role="status", texto oculto «Cargando…»), `Button({ variant: "primary"|"ghost"|"glass", size: "sm"|"md" })`, `IconButton({ label, icon, pressed? })`, `Panel({ id, title, onClose?, children })` (aria-labelledby, Esc cierra), `Icon({ name })` SVG inline: `ruler`, `pin`, `layers`, `timeline`, `camera`, `share`, `help`, `globe`, `close`, `chevron`, `fire`, `search`, `menu`, `history`, `info`, `warning`.
- `globe.ts`: `aggregateGlobeFires(csvTexts: string[], cellDeg = 1): { lat: number; lon: number; count: number }[]`; `npm run globe:prepare` escribe `public/data/globe-fires.json` = `{ generatedAt, dateFrom, dateTo, cells }`.

- [ ] **Step 1: Tests** — `contrastRatio("#ffffff","#014683") > 10`; `contrastRatio("#ffffff","#08569a") >= 7`; `contrastRatio(COLORS.text, COLORS.surface) >= 4.5`; rampa de 6 entradas con última `maxHours === Infinity`. `aggregateGlobeFires`: tres filas en la misma celda → una celda `count 3`; solo encabezado → `[]`.
- [ ] **Step 2:** `npx vitest run tests/unit/tokens.test.ts tests/unit/globe.test.ts` → FAIL.
- [ ] **Step 3:** Implementar tokens, CSS, primitivos, `globe.ts` y script; `npm install three @types/three`; textura Blue Marble de NASA Visible Earth (≤ 2 MB) en `public/textures/blue-marble.jpg`; `npm run globe:prepare`; actualizar `CLAUDE.md` (spec §14.1) y `docs/PLAN.md`.
- [ ] **Step 4:** PASS + `npm run lint`.
- [ ] **Step 5:** Commit `feat(ui): tokens de diseño, primitivos y recursos de la portada`. **Avisar: Codex puede empezar.**

### Task 1: Registro de capas y proxy GIBS

**Files:** Create `src/lib/layers.ts`, `src/server/tiles/gibs.ts`, `src/app/api/tiles/gibs/[layer]/[date]/[z]/[y]/[x]/route.ts`; Test `tests/unit/layers.test.ts`, `tests/unit/gibsProxy.test.ts`.

**Interfaces — Produces:**
```ts
export type LayerGroup = "background" | "overlay" | "imagery" | "aerosol" | "fires";
export interface LayerDef { id: string; group: LayerGroup; name: string; source: "gibs" | "esri" | "wdpa" | "local";
  kind: "raster" | "geojson"; gibsIds?: string[]; template?: string; dated: boolean;
  available?: { from: string; to?: string }; maxZoom: number; attribution: string; legend?: { min: string; max: string; colors: string[] } }
export const LAYERS: LayerDef[]; export const layerById: (id: string) => LayerDef | undefined
export const GIBS_ALLOWED: ReadonlySet<string>
export function tileUrls(layer: LayerDef, date: string): string[]
export function availableOn(layer: LayerDef, date: string): boolean
export function gibsUpstreamUrl(id: string, date: string, z: number, y: number, x: number): string
export async function fetchGibsTile(id: string, date: string, z: number, y: number, x: number, opts?: { fetchImpl?: FetchLike; cacheDir?: string; now?: Date }): Promise<{ body: Buffer; type: string } | null>
```
`LAYERS` = tabla de la spec §6. Esri: `https://server.arcgisonline.com/ArcGIS/rest/services/{World_Street_Map|World_Topo_Map|Canvas/World_Light_Gray_Base|Canvas/World_Dark_Gray_Base}/MapServer/tile/{z}/{y}/{x}`, Firefly `https://fly.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Firefly/MapServer/tile/{z}/{y}/{x}`; WDPA: servicio de UNEP-WCMC (verificar URL al implementar). GIBS upstream: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{id}/default/{date}/GoogleMapsCompatible_Level{maxZoom}/{z}/{y}/{x}.{png|jpg}`; sin fecha → `default`. Caché `data/cache/gibs/{id}/{date}/{z}/{y}/{x}`: fecha pasada sin caducidad, hoy 1 h.

- [ ] **Step 1: Tests** — 6 fondos, 7 overlays, 7 imágenes, 6 aerosoles, 5 satélites de focos; fondo por defecto `esri-dark-gray`; capas no NASA con `attribution`; `availableOn(snpp,"2026-11-10") === false`; `tileUrls(blueMarble,"2026-11-15")[0] === "/api/tiles/gibs/BlueMarble_ShadedRelief_Bathymetry/default/{z}/{y}/{x}"`. Proxy: id fuera de lista → `null` sin fetch; z > maxZoom → `null`; segunda petición de fecha pasada sin fetch (caché temporal); 404 upstream → `null` y no se guarda.
- [ ] **Step 2–4:** FAIL → implementar (ruta 400/404/200 con `Cache-Control`) → PASS + lint.
- [ ] **Step 5:** `curl` a `/api/tiles/gibs/BlueMarble_ShadedRelief_Bathymetry/default/2/1/1` → `200 image/jpeg`; id inventado → `400`. Commit `feat(map): registro de capas y proxy GIBS con caché`.

### Task 2: Estado del mapa en la URL y estilo MapLibre

**Files:** Create `src/lib/map/state.ts`, `src/lib/map/style.ts`; Test `tests/unit/mapState.test.ts`, `tests/unit/mapStyle.test.ts`.

**Interfaces — Produces:**
```ts
export interface MapState { mode: "global" | "local"; center: [number, number]; zoom: number; date: string;
  range: "24h" | "48h" | "week"; background: string; overlays: string[]; imagery: string[]; aerosol: string | null;
  fireSats: string[]; fireStyle: "simple" | "age" | "confidence"; projection: "mercator" | "globe"; iso3: string }
export function defaultState(mode: MapState["mode"], today: string): MapState  // local [-70.2,18.9] z 7.3 iso3 DOM; global [0,15] z 1.6; fondo esri-dark-gray; overlays ["reference-basic"]; todos los satélites; "age"
export function encodeState(s: MapState): string
export function decodeState(qs: string, mode: MapState["mode"], today: string): MapState
export function periodBounds(date: string, range: MapState["range"]): { from: string; to: string; end: string }
export function buildStyle(s: MapState, opts: { offline: boolean }): import("maplibre-gl").StyleSpecification
export function fireAgeColor(acquiredAt: string, periodEnd: string): string
export function fireColorExpression(style: MapState["fireStyle"], periodEnd: string): unknown
```
Orden: fondo → imágenes → aerosoles → overlays raster; `offline` sustituye el fondo por el GeoJSON local. Focos, volcanes y límites locales los añade `MapView`.

- [ ] **Step 1: Tests** — ida y vuelta `decodeState(encodeState(s))`; `decodeState("bg=nope&ov=x,reference-basic&z=abc")` → fondo por defecto, overlays `["reference-basic"]`, zoom por defecto; `periodBounds("2026-11-15","week")` → `{ from:"2026-11-09", to:"2026-11-15", end:"2026-11-15T23:59:59Z" }`; `buildStyle` con imagen `viirs-noaa20` y fecha `2026-11-10` incluye `/2026-11-10/`; con `offline` ninguna URL `http`; `fireAgeColor` a 30 min → `#8b0000`, a 30 h → `#d9d2b5`.
- [ ] **Step 2–4:** FAIL → implementar → PASS + lint. **Step 5:** Commit `feat(map): estado en URL y estilo por capas`.

### Task 3: Mapa a pantalla completa y panel de capas

**Files:** Create `src/components/map/{MapApp,MapView,LayerPanel,Legend,OfflineNotice}.tsx`, `src/app/global/page.tsx` (reemplaza), `src/app/local/page.tsx`, `src/app/rd/page.tsx` (redirect a `/local`).

**Interfaces — Produces:** `MapApp({ mode })` y `useMapApp(): { state, setState, map, openTool, setOpenTool, offline }` (estado sincronizado con la URL vía `history.replaceState`).

- [ ] **Step 1:** `MapView`: MapLibre a pantalla completa bajo `--topbar-h`; proyección del estado; focos de `/api/detections?from&to` (Local; Global con país cargado) coloreados con `fireColorExpression`; en Global teselas GIBS `*_Thermal_Anomalies_*_All`; volcanes; provincias/municipios en Local. Tres errores de tesela Esri → `offline` + `OfflineNotice`.
- [ ] **Step 2:** `LayerPanel`: 5 secciones plegables (fondos radio; overlays checkbox; imágenes radio + «varias»; aerosoles radio; focos checkbox + modo), aviso «Datos solo disponibles del … al …» y fila deshabilitada si `!availableOn`, leyendas, botón info con atribución, Skeleton.
- [ ] **Step 3:** `npm run lint`, `npm run build`; navegador: `/local` y `/global` a pantalla completa, cambio de fondo, VIIRS NOAA-20 del día, Suomi NPP deshabilitado el 2026-11-15, Esri bloqueado → fondo local + aviso.
- [ ] **Step 4:** Commit `feat(map): mapa a pantalla completa y panel de capas`.

### Task 4: Barra de herramientas, herramientas y línea de tiempo

**Files:** Create `src/components/map/{Toolbar,Timeline}.tsx`, `src/components/map/tools/{MeasureTool,LocationTool,CaptureTool,ShareTool,HelpDialog,ViewModeTool}.tsx`, `src/lib/map/tools.ts`; Test `tests/unit/mapTools.test.ts`.

**Interfaces — Produces:** `formatDistance(km: number): string` (0,85 → «850 m», 12,4 → «12,4 km»); `formatArea(km2: number): string` (3,2 → «3,2 km²», 0,5 → «50 ha»); `parseCoordinates(text: string): [number, number] | null` (`[lon, lat]`; acepta «18.5, -70.2», «18.5 -70.2», «18,5; -70,2»; rechaza fuera de rango); `searchPlaces(q, places)` (sin acentos, prefijo primero, máx. 8).

- [ ] **Step 1: Tests** de esos ejemplos; `parseCoordinates("hola") === null`; `parseCoordinates("95, 10") === null`; `searchPlaces("santo", …)` encuentra «Santo Domingo» antes que «Monte Santo».
- [ ] **Step 2–4:** FAIL → implementar: barra `role="toolbar"` (flechas, atajos L/T/M//), una herramienta a la vez, `Esc`; Medir (línea/área, Turf); Ubicación (coordenadas, países, provincias/municipios en Local, «Mi ubicación», «No encontrado»); Capturar (PNG con fecha y atribuciones); Compartir (URL con `encodeState`, «Enlace copiado»); Ayuda (3 pasos, glosario, atajos); Vista (2D/globo, modo presentación); Línea de tiempo (días, flechas de mes, rango, futuro deshabilitado, teclado, alimenta `periodBounds`). Móvil: 4 botones + «Más». PASS + lint + verificación en navegador.
- [ ] **Step 5:** Commit `feat(map): barra de herramientas, herramientas y línea de tiempo`.

### Task 5: Historia, detalle de foco y tarjeta de país

**Files:** Create `src/components/map/{HistoryDrawer,FocusPanel,CountryCard,FocusList}.tsx`; Modify `src/components/Calendar.tsx`, `src/components/DetectionDetail.tsx` (tokens); borrar `Dashboard.tsx`, `FireMap.tsx`, `GlobalExplorer.tsx`, `WorldMap.tsx`, `FilterBar.tsx`, `Charts.tsx` solo si ninguna página los importa (grep).

- [ ] **Step 1:** `HistoryDrawer`: panel inferior con el calendario (crudo ↔ armonizado, conteo ↔ anomalía, tarjeta del mes, CSV); Local con provincia/municipio; Global con el país elegido o el área de Medir como `aoi`; Skeleton.
- [ ] **Step 2:** `FocusPanel` (detalle al tocar un foco) y `FocusList` («Ver focos como lista», tabla accesible).
- [ ] **Step 3:** `CountryCard` (Global): `CountryInfo`, «Cargar historial» con progreso (`LoadJob`, sondeo 2 s), botón «Historia».
- [ ] **Step 4:** Navegador: Local → Historia → crudo/armonizado → foco de marzo 2023 → detalle completo; Global → Haití → cargar → Historia. `npm run lint`, `npm test`, `npm run build`.
- [ ] **Step 5:** Commit `feat(map): historia, detalle de foco y carga de países`.

### Task 6: Fuentes y verificación final

**Files:** Modify `README.md` («Fuentes y licencias»: tabla spec §12 con URLs exactas), `public/geo/sources.json`; Create `public/geo/volcanoes.geojson` (Smithsonian GVP WFS `GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes`, campos nombre/tipo/última erupción; si no se puede descargar, la capa se oculta y se anota).

- [ ] **Step 1:** Volcanes + fuente registrada.
- [ ] **Step 2:** README con todas las fuentes y condiciones.
- [ ] **Step 3:** `npm run lint`, `npm test`, `npm run build`; recorrido completo en el navegador (Global, Local, 8 herramientas, sin red).
- [ ] **Step 4:** Commit `docs: fuentes externas y verificación del mapa`.
