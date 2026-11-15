# Fuego RD — Rediseño visual: mapa a pantalla completa estilo FIRMS (diseño)

Fecha: 2026-11-15 · Complementa `2026-11-14-fuego-rd-armonizacion-design.md` (datos y API, ya construidos).

## 1. Intención

La interfaz actual funciona pero no es atractiva ni intuitiva. Se rehace inspirándose en NASA FIRMS (Fire Map) y
mejorándola: **el mapa es el protagonista a pantalla completa** y todo lo demás (capas, herramientas, línea de tiempo,
calendario, detalle de un foco, chat) flota encima en paneles desplegables y en una barra de herramientas. El inicio
pasa a ser una portada atractiva con un globo 3D (three.js) e imágenes de la NASA.

Público: el mismo de la spec anterior (investigadores en **Global**, ciudadanía dominicana en **Local**). El momento de
la demo (calendario crudo ↔ armonizado, detalle de un foco) se conserva y gana protagonismo.

## 2. Metas, no-metas, anti-metas

**Metas**
- Tokens de color con jerarquía a partir de `#014683`, `#08569a`, `#1a90d0`, `#ffffff`.
- Mapa a pantalla completa en **Global** (`/global`) y **Local** (`/local`, antes «República Dominicana»).
- Catálogo de capas como FIRMS: fondos estáticos, imágenes dinámicas, overlays, humo y aerosoles, focos por satélite.
- Herramientas: Measure, Location, Layers, Timeline, Capture, Share, Help, View mode.
- Skeletons donde haya espera; ley de Hick; WCAG 2.2 AA.
- «Estado» dentro de un menú «Avanzado». Portada con three.js e imágenes de la NASA.
- Documentar al final las fuentes que no son de la NASA.

**No-metas**: animación de la línea de tiempo (reproducir días), capa Landsat OLI (no la ingerimos), cuentas de usuario,
geocodificación por nombre con servicios externos.

**Anti-metas**: más de 8 acciones visibles a la vez en la barra principal; paneles que tapen el mapa por defecto; colores
que no cumplan contraste AA; romper la API de la Parte 1 (contrato en `src/lib/types.ts`).

## 3. Decisiones tomadas (aprobadas por el usuario)

| Tema | Decisión |
|---|---|
| Motor de mapa | MapLibre 6.18 (ya instalado). Su proyección **globe** da la vista 3D del mapa. |
| Teselas NASA | GIBS por un **proxy propio con caché** (`/api/tiles/gibs/...`), regla «NASA vía servidor». |
| Teselas no NASA | **Esri** (Firefly, Streets, Light/Dark Gray, Topographic) y **UNEP-WCMC** (áreas protegidas) directo desde el navegador con atribución visible; no se cachean (sus términos no lo permiten). Necesitan Internet. |
| three.js | Solo en la portada (globo con textura Blue Marble). El mapa no usa three.js. |
| React | Toda la UI en componentes React (Next.js), sin librerías de UI externas: Tailwind 4 + tokens propios. |
| Páginas | Dos mapas: **Global** y **Local**. La ruta `/rd` redirige a `/local`. |

## 4. Tokens de diseño

Definidos en `src/app/globals.css` (`@theme` de Tailwind 4) y en `src/lib/tokens.ts` (los mismos valores para MapLibre
y three.js). Nombres semánticos; los componentes no usan colores sueltos.

| Token | Valor | Uso |
|---|---|---|
| `--color-brand-900` | `#014683` | Paneles sobre el mapa (con 92 % de opacidad), barra superior, encabezados |
| `--color-brand-700` | `#08569a` | Botones primarios, hover de paneles, elemento activo |
| `--color-brand-500` | `#1a90d0` | Acento: foco visible, enlaces sobre oscuro, selección, iconos activos |
| `--color-brand-50` | `#e8f3fb` | Fondos claros de páginas de contenido |
| `--color-ink` | `#ffffff` | Texto sobre paneles de marca |
| `--color-ink-muted` | `#c9dcef` | Texto secundario sobre marca |
| `--color-surface` | `#ffffff` | Páginas de contenido |
| `--color-text` | `#0b2440` | Texto sobre fondo claro |
| `--color-fire-1h` … `--color-fire-old` | `#8b0000`, `#e01b1b`, `#f2711c`, `#f5b700`, `#fde68a`, `#d9d2b5` | Rampa por antigüedad del foco (como FIRMS: <1 h → >24 h) |
| `--color-warn` | `#f5b700` | Avisos (datos solo hasta una fecha) |

Contraste: blanco sobre `#014683` ≈ 10,4:1 y sobre `#08569a` ≈ 7,3:1 (AA texto normal). `#1a90d0` sobre blanco ≈ 3,4:1
→ solo texto grande, iconos y bordes; sobre `#014683` se usa para foco y acentos. Radios 8/12/16 px; una sombra para
paneles flotantes. Tipografía: pila del sistema (regla sin Google Fonts).

## 5. Estructura de la experiencia

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [Logo Fuego RD]  Global | Local      [Buscar lugar/coordenadas]  [⋮ Avanzado] │  barra superior flotante
│ ┌─Capas──────┐                                             ┌─Foco───────┐  │
│ │ 4 grupos   │            MAPA A PANTALLA COMPLETA         │ imagen día │  │
│ │ plegados   │            (fondo, imágenes, focos)         │ clima·causa│  │
│ └────────────┘                                             └────────────┘  │
│   [Medir][Ubicación][Capas][Línea de tiempo][Capturar][Compartir][Ayuda][Vista] │
│ ◄ oct 2026 ─ 1 2 3 … 14 [15] ─ nov 2026 ►   Rango: [Semana ▾]   [Historia ▲]   │
└───────────────────────────────────────────────────────────────────────────┘
                                                      [Asistente IA] (flotante)
```

- **Ley de Hick**: barra de 8 herramientas con icono + texto; solo una herramienta abierta a la vez. Panel de capas con
  grupos **plegados** y valores por defecto ya elegidos (fondo Dark Gray, focos VIIRS+MODIS «por antigüedad», límites).
  «Avanzado» agrupa lo poco usado (Estado de los datos).
- **Historia** (botón en la línea de tiempo) abre el calendario armonizado como panel inferior deslizante sobre el mapa
  (crudo ↔ armonizado, conteo ↔ anomalía, CSV). En Local incluye selector de provincia/municipio.
- **Detalle de un foco**: panel derecho al tocar un foco (componente existente, rediseñado).
- **Móvil**: la barra se reduce a 4 iconos + «Más»; los paneles se convierten en hojas inferiores.

## 6. Catálogo de capas (registro único `src/lib/layers.ts`)

Cada capa: `id`, `group`, `name`, `source` (`gibs` | `esri` | `wdpa` | `local`), `kind` (`raster` | `geojson`),
`template` o id GIBS, `dated` (usa la fecha de la línea de tiempo), `available` (rango de fechas), `attribution`,
`legend` opcional. El proxy solo acepta ids GIBS presentes en este registro.

| Grupo (selección) | Capas |
|---|---|
| **Fondos estáticos** (1 de 6) | Blue Marble (GIBS `BlueMarble_ShadedRelief_Bathymetry`) · Firefly (Esri World Imagery Firefly) · Streets (Esri World Street Map) · Light Gray (Esri) · Dark Gray (Esri, **por defecto**) · Topographic (Esri World Topo Map) |
| **Overlays** (varias) | Latitud-longitud (GIBS `Graticule_15m`) · Volcanes (Smithsonian GVP, GeoJSON local) · Costas/límites/carreteras básico (GIBS `Coastlines_15m` + `Reference_Features_15m`) · Límites/carreteras detallado (+ `Reference_Labels_15m`) · Nieve NDSI VIIRS NOAA-20 (GIBS `VIIRS_NOAA20_NDSI_Snow_Cover`, con fecha) · Zonas construidas (GIBS `Landsat_Human_Built-up_And_Settlement_Extent`) · Áreas protegidas (UNEP-WCMC WDPA) · En Local: provincias y municipios (GeoJSON local) |
| **Imágenes dinámicas** (1, opción «varias») | GOES-West GeoColor · GOES-East GeoColor · VIIRS NOAA-20 · VIIRS NOAA-21 · VIIRS Suomi NPP (aviso «solo hasta 2026-11-02») · MODIS Aqua · MODIS Terra (GIBS `*_CorrectedReflectance_TrueColor`, `GOES-*_ABI_GeoColor`) |
| **Humo y aerosoles** (1) | OMPS NOAA-20 Aerosol Index · NOAA-20 PyroCumuloNimbus · NOAA-21 Aerosol Index · NOAA-21 PyroCumuloNimbus · SNPP OMPS Aerosol Index · SNPP PyroCumuloNimbus (aviso de fecha), con barra de leyenda |
| **Focos de calor** (varias) | VIIRS NOAA-20 · NOAA-21 · Suomi NPP · MODIS Aqua · MODIS Terra. Modos: **Simple**, **Por antigüedad** (rampa FIRMS, por defecto), **Por confianza**. En Global a zoom bajo: teselas GIBS `*_Thermal_Anomalies_*_All` del día; en Local y en países cargados: puntos propios clicables de `/api/detections` |

Verificado en el GetCapabilities de GIBS (EPSG:3857) del 2026-11-15: todos los ids existen. Aerosoles NOAA-20/21:
`OMPS_NOAA2x_NadirMapper_AerosolIndex_380` y `..._PyroCumuloNimbus_380`; SNPP: `OMPS_Aerosol_Index` y
`OMPS_Aerosol_Index_PyroCumuloNimbus`.

## 7. Herramientas

| Herramienta | Comportamiento |
|---|---|
| **Medir** | Distancia (línea) o área (polígono) con clics; km/mi; Esc o «Borrar» limpia. Turf. |
| **Ubicación** | Buscador local: coordenadas «lat, lon», países (world.geojson) y, en Local, provincias/municipios. «Mi ubicación» con geolocalización del navegador. Sin servicios externos. |
| **Capas** | Abre/cierra el panel de capas. |
| **Línea de tiempo** | Franja inferior con días y flechas; rango 24 h / 48 h / semana. Cambia la fecha de las capas con fecha y el periodo de los focos. |
| **Capturar** | Descarga PNG del mapa con fecha, capas y atribuciones. |
| **Compartir** | Copia un enlace con el estado (vista, zoom, capas, fecha) en la URL. |
| **Ayuda** | Recorrido de 3 pasos + glosario + atajos. |
| **Vista** | 2D ↔ globo 3D (proyección globe de MapLibre) y «modo presentación» (oculta paneles). |

Atajos: `L` capas, `T` línea de tiempo, `M` medir, `/` buscar, `Esc` cerrar panel.

## 8. Accesibilidad y estados

- Paneles como diálogos no modales con `aria-labelledby`, foco gestionado y `Esc`; la barra es un `toolbar` navegable
  con flechas; contraste AA; objetivos ≥ 24 px; `prefers-reduced-motion` detiene el giro del globo y las transiciones.
- Alternativa textual del mapa: «Ver focos como lista».
- **Skeletons** (`src/components/ui/Skeleton.tsx`): mapa, panel de capas, calendario, detalle del foco, lista.
- Errores de capa (tesela caída, sin Internet para Esri) se avisan en el panel de capas sin romper el mapa.

## 9. Portada (`/`)

Héroe a pantalla completa con globo three.js (textura Blue Marble de NASA Visible Earth; focos de los últimos 7 días como
puntos luminosos desde un JSON agregado), título y dos accesos: **Explorar el mundo** (Global) y **Mi territorio**
(Local). Debajo, tres secciones breves con imágenes de la NASA y créditos. Respeta `prefers-reduced-motion` y tiene
imagen estática de respaldo si no hay WebGL.

## 10. Backend necesario (pequeño)

- `GET /api/tiles/gibs/[layer]/[date]/[z]/[y]/[x]` — proxy WMTS de GIBS (EPSG:3857, `best`), lista blanca del registro,
  caché en disco `data/cache/gibs/` (fechas pasadas no caducan; el día actual, 1 h).
- `public/geo/volcanoes.geojson` — volcanes holocenos del Smithsonian GVP (descarga única en desarrollo).
- `public/data/globe-fires.json` — focos de los últimos 7 días agregados a celdas de 1° (desde `data/raw/firms-global-7d`).
- `public/textures/blue-marble.jpg` — textura de NASA Visible Earth.

## 11. División del trabajo

En paralelo en la misma carpeta, con propiedad estricta de archivos. La Tarea 0 (Claude) va primero y desbloquea a Codex.

### Parte A — Claude Code: mapa y capas
Propietario de: `src/app/globals.css`, `src/lib/tokens.ts`, `src/lib/layers.ts`, `src/components/ui/**`,
`src/components/map/**`, `src/app/global/**`, `src/app/local/**`, `src/app/rd/**`, `src/app/api/tiles/**`,
`public/geo/volcanoes.geojson`, `public/data/**`, `public/textures/**`, `package.json`.

0. **Contrato visual**: tokens, `Skeleton`, `Button`, `Panel`, `Icon`; instalar `three` + `@types/three`; generar
   `globe-fires.json` y la textura. Avisar a Codex.
1. Proxy GIBS + registro de capas.
2. Mapa a pantalla completa con fondos, overlays, imágenes, aerosoles y focos.
3. Panel de capas con avisos de disponibilidad y leyendas.
4. Barra de herramientas, las 8 herramientas, línea de tiempo, estado en URL.
5. Panel Historia (calendario) y detalle de foco rediseñados; Local con provincias/municipios.
6. Fuentes no NASA en README.

### Parte B — Codex: portada, navegación y páginas de contenido
Propietario de: `src/app/page.tsx`, `src/components/home/**`, `src/app/layout.tsx`, `src/components/nav/**`,
`src/app/metodologia/**`, `src/app/aprende/**`, `src/app/historico/**`, `src/app/avanzado/**`, `src/app/estado/**`
(redirige a Avanzado), `src/app/creditos/**`, `src/components/AiChat.tsx`, `tests/e2e/**`.

1. Barra superior flotante (logo, Global | Local, menú Avanzado con Estado); variable CSS `--topbar-h`.
2. Portada con globo three.js, imágenes de la NASA y accesos.
3. Rediseño de Metodología, Aprende e Histórico con los tokens; Estado dentro de Avanzado.
4. Página `/creditos` con todas las fuentes (§12).
5. Chat flotante rediseñado.
6. Pase de accesibilidad y E2E de portada, navegación y páginas de contenido.

Codex no edita archivos de la Parte A; usa `src/components/ui/**` y los tokens.

## 12. Fuentes externas (README y `/creditos`)

| Fuente | Uso | Proveedor | Condiciones |
|---|---|---|---|
| NASA GIBS | Blue Marble, imágenes, overlays, aerosoles, nieve, focos raster | NASA EOSDIS | Uso libre, citar a NASA |
| NASA FIRMS | Focos (datos) | NASA LANCE/FIRMS | Uso libre, citar |
| NASA Visible Earth | Textura del globo | NASA | Dominio público |
| Esri World Imagery (Firefly), World Street Map, Light/Dark Gray Canvas, World Topo Map | Fondos | Esri y colaboradores | Términos de Esri, atribución obligatoria, sin caché |
| WDPA (Protected Planet) | Áreas protegidas | UNEP-WCMC e IUCN | Uso no comercial con atribución |
| Smithsonian GVP | Volcanes | Smithsonian Institution | Uso con cita |
| Natural Earth / geoBoundaries | Límites | NE / William & Mary | Dominio público / CC BY 4.0 |

## 13. A criterio del constructor

Iconografía (SVG propios), animaciones, tamaños de panel, textos de ayuda, orden fino dentro de cada grupo, umbral de
zoom para pasar de teselas GIBS a puntos propios.

## 14. Aclaraciones tras la revisión del constructor

1. **Regla de fuentes** *(decisión del usuario)*: se permiten fuentes no NASA (Esri, UNEP-WCMC, Smithsonian) para la
   visualización, documentadas. La Parte A actualiza `CLAUDE.md` y `docs/PLAN.md`: los datos siguen siendo solo NASA;
   los fondos y overlays de referencia pueden ser de terceros con atribución. *(Decisión del constructor)* **Sin
   Internet**: si las teselas de Esri fallan, el mapa cambia solo al fondo local (GeoJSON de `public/geo/`, estilo actual)
   y avisa en el panel de capas; las pruebas E2E con la red bloqueada verifican ese respaldo y el aviso.
2. **Local = República Dominicana** *(decisión del usuario: «Cambia el nombre de República Dominicana a "Local"»)*.
   Solo RD tiene provincias y municipios; no hay selector de país en Local.
3. *(Decisión del constructor)* **Carga de países en Global**: al elegir un país (clic en el mapa o buscador) aparece
   una tarjeta flotante con su estado (`CountryInfo`), el botón «Cargar historial» y el progreso (`LoadJob`). Cuando el
   país está cargado, el botón «Historia» abre su calendario armonizado. Los países cargados muestran sus focos propios
   clicables; el resto, las teselas GIBS.
4. *(Decisión del constructor)* **Componentes existentes**: la Parte A se queda con `FireMap`, `Calendar`,
   `DetectionDetail`, `FilterBar`, `Dashboard`, `WorldMap`, `GlobalExplorer` y `Charts` (los mueve o sustituye dentro de
   `src/components/map/**`); la Parte B se queda con `HistoryView`, `StatusView`, `StatusIndicator`, `NavLinks` y
   `AiChat`. Nadie borra un componente que use la otra parte sin avisar; `/rd` redirige a `/local`.
5. *(Decisión del constructor)* **`globe-fires.json`**: lo genera `npm run globe:prepare` (Parte A) desde el archivo
   global de 7 días más reciente en `data/raw/firms-global-7d/`; la portada muestra la fecha de esos datos. Se versiona
   el último generado para que la portada funcione sin conexión.
6. *(Decisión del constructor)* **«Por antigüedad»** se mide respecto al final del periodo elegido en la línea de
   tiempo (no respecto a «ahora»), para que la rampa sirva también al mirar días pasados.
