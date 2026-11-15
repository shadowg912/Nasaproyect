# Fuego RD — Monitoreo de incendios en República Dominicana

Aplicación **local-first** que descarga detecciones satelitales de incendios de **NASA FIRMS**, las filtra al territorio
dominicano y las sirve con su propio mapa, estadísticas e interfaz en español. NASA FIRMS es la **única** fuente externa;
almacenamiento (SQLite), cartografía, gráficos y análisis funcionan sin Internet.

## Inicio rápido

```bash
npm install
cp .env.example .env        # opcional: agregar FIRMS_MAP_KEY
npm run db:init             # crea data/fuego-rd.sqlite (WAL), migra y siembra provincias/municipios
npm run sync:firms          # descarga datos reales de NASA FIRMS
npm run dev                 # http://localhost:3000
```

Requisitos: Node.js 22.12 o posterior de la rama 22 (probado con Node 22). `better-sqlite3` es nativo y está fijado a
la versión 12.11.1, que publica binarios precompilados para Windows x64 con Node 22. `package.json` declara sus scripts
de instalación mediante `allowScripts`: npm solo respeta esa lista desde npm 11; con npm 10 los scripts de instalación se
ejecutan igualmente.

### Sin MAP_KEY

La aplicación funciona sin clave:

- `npm run db:init` y `npm run dev` no necesitan red.
- `npm run sync:firms` usa los **CSV públicos de FIRMS** (últimos 7 días, región Centroamérica/Caribe, mismo dominio NASA)
  y filtra a RD. Son datos reales.
- Lo que **requiere** clave: la API de área (consultas por bbox de 1–5 días) y la importación de historial.

### Obtener una MAP_KEY

1. Solicítela gratis en <https://firms.modaps.eosdis.nasa.gov/api/map_key/> (llega por correo).
2. Agréguela a `.env`: `FIRMS_MAP_KEY=su_clave`. Nunca la versione (`.env` está en `.gitignore`).
3. `npm run sync:firms` pasará a usar la API de área automáticamente. La clave solo la usa el backend y se oculta en
   registros y mensajes de error.

Límite de NASA: 5000 transacciones cada 10 minutos por clave.

## Variables de entorno

| Variable | Predeterminado | Descripción |
|---|---|---|
| `FIRMS_MAP_KEY` | *(vacía)* | Clave privada de FIRMS. |
| `DATABASE_PATH` | `./data/fuego-rd.sqlite` | Archivo SQLite local (nunca dentro de `public/`). |
| `FIRMS_SOURCES` | `VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT,VIIRS_SNPP_NRT` | Productos a sincronizar. |
| `FIRMS_DAY_RANGE` | `2` | Días por sincronización (1–5). |
| `SYNC_INTERVAL_MINUTES` | `30` | Intervalo de `sync:watch`. |
| `SYNC_FRESH_HOURS` | `6` | Antigüedad máxima para considerar los datos «actualizados». |
| `FIRMS_TIMEOUT_MS` | `30000` | Tiempo de espera por solicitud a NASA. |
| `ANTHROPIC_API_KEY` | *(vacía)* | Clave del chat IA (opcional). Vacía: el chat muestra «disponible cuando se configure la clave» y nada más cambia. Es de pago por uso (platform.claude.com), distinta de una suscripción Pro. |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run db:init` | Crea directorio y base, aplica migraciones, siembra territorio. Idempotente. |
| `npm run db:migrate` | Solo migraciones. |
| `npm run db:generate` | Genera una nueva migración tras cambiar `src/db/schema.ts`. |
| `npm run sync:firms` | Sincronización manual (API de área si hay clave; si no, feed público). Opciones: `-- --public`, `-- --days 5`, `-- --sources A,B`. |
| `npm run sync:watch` | Proceso local de sincronización periódica. |
| `npm run import:history -- --from AAAA-MM-DD --to AAAA-MM-DD` | Importa historial en lotes de 5 días (requiere clave). Opciones: `--sources`, `--force`, `--delay ms`, `--dry-run`. |
| `npm run history:country -- DOM [--local data/raw/firms-country] [--area data/raw/firms-area/2026]` | Importa el historial MODIS (2000→) y VIIRS Suomi NPP (2012→) de un país desde los archivos anuales de FIRMS (sin clave) y reconstruye su serie armonizada. Reanudable. `--rebuild-only` solo recalcula. |
| `npm run geo:prepare` | Vuelve a descargar los límites administrativos (herramienta de desarrollo; los resultados ya están versionados). |
| `npm run maps:prepare` | Genera el mapa base PMTiles local (opcional, ver abajo). |
| `npm test` | Pruebas unitarias e integración (Vitest). |
| `npm run build && npm run test:e2e` | Pruebas E2E (Playwright) con NASA inaccesible. Primera vez: `npx playwright install chromium`. |

## Sincronización

Flujo de `runSync` (`src/server/firms/ingest.ts`): consultar NASA → descargar → validar CSV → normalizar → filtrar con
Turf.js por el polígono nacional, provincia y municipio → deduplicar → guardar en SQLite → registrar en `ingestion_runs`
e `ingestion_coverage`.

- **Sin duplicados**: el `id` de cada detección es un hash de fuente + coordenadas + fecha/hora + satélite. Repetir una
  sincronización inserta 0 filas; si NASA corrige valores, la fila se actualiza.
- **Sin escrituras simultáneas**: un bloqueo en la tabla `sync_lock` (transacción `IMMEDIATE`) impide que dos procesos
  (CLI, `sync:watch`, botón de la interfaz) sincronicen a la vez.
- **Los errores no borran datos**: la sincronización nunca elimina filas. Los errores se clasifican (`network`, `auth`,
  `rate_limit`, `server`, `invalid_response`).
- **Cero detecciones ≠ sin conexión**: un CSV válido sin filas es una sincronización correcta.

### Sincronización periódica

Opción 1 — proceso local: `npm run sync:watch` (déjelo corriendo, p. ej. con `pm2` o un servicio).

Opción 2 — planificador del sistema operativo:

```cron
# crontab -e  (cada 30 minutos)
*/30 * * * * cd /ruta/a/fuego-rd && /usr/bin/npm run sync:firms -- --trigger cron >> data/sync.log 2>&1
```

systemd (`~/.config/systemd/user/fuego-sync.service` + `.timer`):

```ini
[Service]
Type=oneshot
WorkingDirectory=/ruta/a/fuego-rd
ExecStart=/usr/bin/npm run sync:firms -- --trigger systemd

[Timer]
OnCalendar=*:0/30
Persistent=true
[Install]
WantedBy=timers.target
```

En Windows, use el **Programador de tareas** y configure el programa como `C:\Program Files\nodejs\npm.cmd`, los
argumentos como `run sync:firms -- --trigger task-scheduler` y el campo **Iniciar en** con la carpeta del proyecto. En
PowerShell, ejecute:

```powershell
cd 'C:\ruta\a\fuego-rd'
npm run sync:firms
```

### Historial

Los productos NRT solo cubren los meses recientes. Para años anteriores use los productos de procesamiento estándar
(`VIIRS_*_SP`, predeterminados en `import:history`). El script consulta `data_availability`, recorta el rango a lo que
NASA ofrece, descarga solo los días no cubiertos y registra en `ingestion_coverage` únicamente los lotes exitosos; si se
interrumpe, vuelva a ejecutarlo y continuará donde quedó. Cuando un día está cubierto por SP, las estadísticas excluyen
las filas NRT de ese día para no contar dos veces. La aplicación nunca descarga historial automáticamente al iniciar.

## Mapas

- **Por defecto**: mapa GeoJSON local (`public/geo/`) con fondo sencillo. Sin teselas remotas ni glyphs.
- **Opcional**: `npm run maps:prepare` descarga la CLI `pmtiles`, extrae Dominicana de la compilación diaria de Protomaps
  (OpenStreetMap) a `public/maps/rd.pmtiles` y copia fuentes y sprites a `public/maps/`. Al reiniciar, la aplicación lo
  detecta y usa el estilo PMTiles mediante el protocolo `pmtiles://` (todo servido localmente). `rd.pmtiles` no se versiona.
- El worker de MapLibre se copia a `public/vendor/` en `predev`/`prebuild`, así que no se usa ningún CDN.

### Procedencia y licencias de datos geográficos

| Recurso | Fuente | Licencia |
|---|---|---|
| Límite nacional (ADM0) | geoBoundaries ← Caribbean GeoPortal (2020) | CC BY 4.0 |
| Provincias (ADM1, 32) | geoBoundaries ← Natural Earth (2022) | Dominio público |
| Municipios (ADM2, 155) | geoBoundaries ← Caribbean GeoPortal (2020) | CC BY 4.0 |
| Mapa base PMTiles (opcional) | Protomaps / OpenStreetMap | ODbL |
| Fuentes del mapa (opcional) | Noto Sans | SIL OFL 1.1 |

Detalle en `public/geo/sources.json`. Limitaciones: ADM1 y ADM2 provienen de fuentes distintas y sus bordes no coinciden
exactamente; RD tiene oficialmente 158 municipios y la fuente abierta 155. Natural Earth usa algunos nombres antiguos,
que se corrigen (`Hermanas` → Hermanas Mirabal, `La Estrelleta` → Elías Piña).

### Fuentes y licencias

| Fuente | Uso | Condiciones y referencia |
|---|---|---|
| [NASA GIBS](https://gibs.earthdata.nasa.gov) | Imágenes, fondos y overlays | Uso libre con cita a NASA. |
| NASA FIRMS | Focos de calor | Uso libre con cita a NASA FIRMS. |
| NASA Visible Earth | Textura Blue Marble | Dominio público. |
| NASA POWER | Contexto meteorológico | Uso libre con cita a NASA. |
| Esri | Fondos opcionales: [Streets y Topographic](https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer), [Light/Dark Gray](https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer) y [Firefly](https://fly.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Firefly/MapServer) | Términos de Esri, atribución visible y sin caché. |
| UNEP-WCMC WDPA | Áreas protegidas | Uso no comercial con atribución, según los términos de Protected Planet. |
| Smithsonian GVP | Volcanes holocenos | Uso con cita. |
| Natural Earth | Límites mundiales | Dominio público. |
| geoBoundaries | Límites administrativos | CC BY 4.0. |

## Arquitectura

```
src/
  app/            Páginas (Panel, Histórico, Aprende, Estado) y rutas /api/* (runtime nodejs)
  components/     Mapa MapLibre, gráficos Recharts, filtros, indicador de estado
  db/             Esquema Drizzle y conexión better-sqlite3 (WAL)
  server/         Ingesta FIRMS, clasificación territorial (Turf), consultas, bloqueo, estado
  lib/            Configuración, fechas, tipos y formato compartidos
scripts/          CLI: db-init, sync-firms, sync-watch, import-history, geo-prepare, maps-prepare
drizzle/          Migraciones SQL
public/geo/       GeoJSON locales (versionados)
tests/unit        Vitest   ·   tests/e2e  Playwright
```

Garantías de privacidad y autonomía: sin telemetría (`scripts/next.mjs` fija `NEXT_TELEMETRY_DISABLED=1` al ejecutar
Next.js), sin Google Fonts (fuentes del sistema), sin CDNs ni analítica, SQLite solo en el servidor, todas las rutas con
`runtime = "nodejs"`.
Requiere un disco persistente: no está pensada para plataformas serverless con sistema de archivos efímero.
