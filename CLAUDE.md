# CLAUDE.md

Fuego RD: monitoreo local-first de incendios en República Dominicana. Requisitos completos: `docs/PROJECT_SPEC.md`;
decisiones y contradicciones resueltas: `docs/PLAN.md`; uso: `README.md`.

## Reglas de arquitectura (no negociables)

- Next.js (App Router) + TypeScript. SQLite vía better-sqlite3 + Drizzle ORM. MapLibre con recursos locales.
- **NASA FIRMS es la única API externa en ejecución.** Nada de Supabase, Firebase, bases administradas, Mapbox/MapTiler/
  Google Maps, teselas OSM remotas, CDNs, Google Fonts, analítica ni telemetría.
- SQLite solo en el servidor. Toda ruta o página que lo toque declara `export const runtime = "nodejs"`. Nunca Edge.
- Los estilos de mapa no contienen URLs remotas. GeoJSON en `public/geo/`, PMTiles/fuentes/sprites en `public/maps/`.
- La sincronización nunca borra datos; los errores se registran en `ingestion_runs`. Ausencia de detecciones ≠ fallo.
- IDs determinísticos (`detectionId`) + upsert; bloqueo `sync_lock` para evitar sincronizaciones simultáneas.
- La MAP_KEY nunca llega al cliente ni a los registros (`redact`).
- Interfaz en español; horas mostradas en `America/Santo_Domingo`, fechas de FIRMS almacenadas en UTC.

## Comandos

- `npm test` (Vitest, `tests/unit`) · `npm run lint` (tsc) · `npm run build && npm run test:e2e` (Playwright, NASA simulada inaccesible)
- `npm run db:init` · `npm run sync:firms` · `npm run import:history -- --from … --to …`
- Cambios de esquema: editar `src/db/schema.ts` → `npm run db:generate` → versionar `drizzle/`.

## Notas

- `src/lib/*` debe seguir sin dependencias de Node (lo importa el cliente); el código de servidor vive en `src/server/` y `src/db/`.
- MapLibre v6 carga su worker desde `/vendor/maplibre-gl-worker.mjs` (copiado en `predev`/`prebuild`).
- MapLibre aplica `position: relative` al contenedor: dale tamaño explícito (`h-full w-full`), no `absolute inset-0`.
- Playwright arranca `webServer` antes de `globalSetup`; por eso la semilla E2E se ejecuta dentro del comando del servidor.
