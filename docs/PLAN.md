# Plan de desarrollo — Fuego RD

Fuente de requisitos: `docs/PROJECT_SPEC.md`.

## Contradicciones y ambigüedades detectadas

| # | Problema | Decisión |
|---|----------|----------|
| 1 | El pedido menciona `CLAUDE.md` y `docs/PROJECT_SPEC.md`, pero el repositorio solo tenía `proyect_spects.md`. | Se movió a `docs/PROJECT_SPEC.md` y se creó `CLAUDE.md`. |
| 2 | La especificación dice "mantener el diseño original" e "instrucciones anteriores", que no existen en el repositorio. | Se implementan las secciones listadas (dashboard, mapa, filtros, gráficos, histórico, educación, responsive, español) desde cero. |
| 3 | "Mapa base local con PMTiles" vs. "si no hay PMTiles, usar GeoJSON". | La app detecta `public/maps/rd.pmtiles`; si no existe, usa el estilo GeoJSON local. `npm run maps:prepare` genera el PMTiles (herramienta de desarrollo, no de ejecución). |
| 4 | Sin `FIRMS_MAP_KEY` no hay acceso a la API de área. | Fuente de respaldo: los CSV públicos de FIRMS (`/data/active_fire/...Central_America_7d.csv`, mismo dominio NASA, sin clave, últimos 7 días). La API de área con clave es la vía principal y la única para historial. |
| 5 | Los productos NRT no tienen historial completo. | El importador histórico usa productos `*_SP` (procesamiento estándar) y consulta `data_availability` para limitar el rango; registra en `ingestion_coverage` solo los intervalos realmente cubiertos. |
| 6 | Límites: ADM1 de geoBoundaries proviene de Natural Earth y ADM2 de Caribbean GeoPortal (155 municipios; RD tiene 158). Las geometrías no coinciden exactamente. | Provincia de cada detección = polígono ADM1 que la contiene; municipio = polígono ADM2. La provincia de un municipio se asigna por su centroide. Se documenta la limitación. |
| 7 | "Sin telemetría": Next.js envía telemetría anónima por defecto. | `scripts/next.mjs` fija `NEXT_TELEMETRY_DISABLED=1` al ejecutar Next.js para `dev`, `build` y `start`. |
| 8 | "Sin Google Fonts": `next/font/google` descarga fuentes. | Pila de fuentes del sistema. |
| 9 | Etiquetas de texto en MapLibre requieren glyphs. | El estilo GeoJSON no usa capas de texto; el estilo PMTiles usa glyphs locales en `public/maps/fonts`. |
| 10 | La isla es compartida con Haití; el bbox incluye territorio haitiano. | Bbox `-72.01,17.47,-68.32,19.93` para consultar y Turf.js con el polígono nacional para filtrar. |

## Fases

1. **Base del proyecto** — Next.js + TS, Vitest, scripts npm, `.env.example`, `.gitignore`.
2. **Base de datos** — Esquema Drizzle (5 tablas + `sync_lock`), migraciones, `db:init`, WAL, índices, IDs determinísticos. *Pruebas:* migración en BD temporal, unicidad.
3. **Geografía** — `geo:prepare` descarga geoBoundaries, simplifica y guarda en `public/geo/`; `db:init` siembra provincias/municipios. *Pruebas:* punto en Santo Domingo ∈ RD, punto en Puerto Príncipe ∉ RD.
4. **Ingesta FIRMS** — cliente (área + feed público), validación CSV, normalización, filtro territorial, upsert, `ingestion_runs`, `ingestion_coverage`, bloqueo entre procesos. *Pruebas:* CSV de ejemplo, re-sincronización sin duplicados, error de NASA no borra datos, sin conexión ≠ cero detecciones.
5. **CLI** — `sync:firms`, `sync:watch`, `import:history`.
6. **API (runtime Node.js)** — detecciones, estadísticas, estado, geografía.
7. **Interfaz** — dashboard, mapa MapLibre, filtros, gráficos, histórico, educación, indicador de estado.
8. **Mapa PMTiles** — `maps:prepare` (extract de Protomaps + glyphs/sprites locales).
9. **E2E** — Playwright: sin solicitudes externas, NASA inaccesible, persistencia tras reinicio.

## Fase 2 — Armonización MODIS + VIIRS (NASA Space Apps 2026)

- Diseño aprobado: `docs/superpowers/specs/2026-11-14-fuego-rd-armonizacion-design.md`.
- Plan de la Parte 1 (datos, armonización y API): `docs/superpowers/plans/2026-11-15-parte1-datos-armonizacion-api.md`.
- La regla de la fila 4 se amplía: FIRMS sigue siendo la fuente de focos, y en ejecución se permiten además GIBS (imágenes) y
  POWER (clima) de la NASA, con caché local; la API de Anthropic solo para el chat IA.
- Telemetría (fila 7): `NEXT_TELEMETRY_DISABLED=1` lo fija ahora `scripts/next.mjs`, portable a Windows.
