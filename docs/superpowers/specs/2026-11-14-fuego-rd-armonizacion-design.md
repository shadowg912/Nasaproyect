# Fuego RD — Calendario armonizado MODIS + VIIRS (diseño para NASA Space Apps 2026)

Fecha: 2026-11-14 · Reto: **Harmonization of MODIS and VIIRS Hot Spots** · Duración: hackathon de 36 h.

## 1. Intención y por qué

Los focos de calor satelitales existen desde 2000 (MODIS) y desde 2012 con mayor detalle (VIIRS), pero los dos
registros no se pueden comparar directamente: VIIRS (375 m) detecta muchos más focos que MODIS (1 km) para el mismo
fuego. Quien gestiona emergencias no puede responder con datos crudos «¿este año es peor que los anteriores?».

Fuego RD armoniza ambos registros en una única serie desde 2000 hasta hoy, donde **el sensor de origen deja de
importar**, y la presenta como un **calendario de quemas** (año × mes) con anomalías frente a la mediana histórica.
Se inspira en las herramientas de NASA FIRMS, pero es más intuitiva: cualquier persona debe entenderla sin un tutorial.

Dos públicos y dos modos:

- **Global (investigación):** mapa mundial; se elige un país (y opcionalmente un área dibujada o por coordenadas) y se
  obtiene su calendario armonizado, sus anomalías y la descarga en CSV. Para científicos, meteorólogos y gestores.
- **RD (ciudadanía):** el panel actual de República Dominicana ampliado con el calendario, provincias y municipios.
  Para agricultores, población urbana y rural, bomberos y defensa civil.

Criterios de evaluación (1–5 cada uno): Impacto, Creatividad, Validez, Relevancia, Presentación. Los datos de la NASA
deben aportar valor real, no ser un complemento.

### Momento central de la demo (acordado)

1. **El problema:** serie de focos crudos de RD 2000–hoy → salto artificial cuando entra VIIRS (~2012).
2. **La solución:** interruptor «Armonizado» → el salto desaparece; calendario año × mes con colores accesibles muestra
   la temporada crítica y los años anómalos; «este mes: N veces la mediana histórica».
3. **Lo que FIRMS no tiene:** al tocar un foco → imagen satelital real de ese día (GIBS), causa probable y viento del
   día (POWER), dirección probable de propagación.
4. Cierre: visión de la alerta ciudadana (solo presentación, sin prototipo).

Antes de prometer el salto de 2012 en la presentación, se verifica con los datos reales cargados.

## 2. Metas, no-metas y anti-metas

**Metas**

- Serie armonizada MODIS+VIIRS 2000–hoy por país, provincia/municipio (RD) y área de interés.
- Calendario año × mes, comparación del mes actual con la mediana multianual, vista de anomalías.
- Interruptor crudo ↔ armonizado y página de metodología con la validación (gráfico de ajuste en el período de solape).
- Descarga CSV de los focos de la búsqueda y de la tabla mensual armonizada.
- Panel de detalle de un foco: imagen GIBS del día, clima POWER, causa probable, propagación estimada.
- Chat IA lateral que responde con los datos de la app y fuentes de la NASA.
- Interfaz en español, accesible (WCAG 2.2 AA: contraste, teclado, lector de pantalla, rampas aptas para daltonismo).

**No-metas**

- Alerta ciudadana / notificaciones push / reportes de usuarios (solo en la presentación).
- Descargar el historial crudo de todo el planeta.
- Predicción de riesgo con modelos de aprendizaje automático.
- Autenticación, cuentas de usuario, despliegue en la nube.

**Anti-metas (fallaría aunque funcione)**

- Afirmar la causa de un incendio como hecho. Siempre «probable», con sus razones.
- Que el chat invente cifras: toda cifra sale de una herramienta que consulta la base.
- Usar logo, nombre o apariencia oficial de la NASA (parecería un sitio oficial).
- Fuentes de datos ajenas a la NASA (salvo la API de IA del chat).

## 3. Restricciones

- Next.js 16 (App Router) + TypeScript, SQLite (better-sqlite3 12.11.1) + Drizzle, MapLibre con recursos locales.
  Leer `node_modules/next/dist/docs/` antes de escribir código de Next (AGENTS.md).
- **Solo fuentes de la NASA en ejecución:** FIRMS (archivos por país/año, API de área, feeds públicos), GIBS (imágenes),
  POWER (clima). Única excepción: la API de Anthropic para el chat. Las respuestas externas se guardan en caché local
  para que lo ya consultado funcione sin Internet. Se actualizan `CLAUDE.md` y `docs/PLAN.md` con esta regla.
- La clave de FIRMS está en `.env`; nunca se muestra ni se versiona. `ANTHROPIC_API_KEY` queda **vacía** por ahora:
  sin clave, el chat muestra un estado «disponible cuando se configure la clave» y nada más se rompe.
- Windows: los scripts npm deben ser portables (ya resuelto con `scripts/next.mjs`).
- Dos agentes (Claude Code y Codex) trabajan en paralelo en la misma carpeta → propiedad de archivos estricta (§8) y
  contrato de API fijado antes de empezar (§6).

## 4. Datos

### Fuente principal: archivos anuales por país de FIRMS (verificado)

`https://firms.modaps.eosdis.nasa.gov/data/country/{producto}/{año}/{producto}_{año}_{País}.csv`
— sin clave, un archivo por país, año y producto. Comprobado: `modis/2005/…Dominican_Republic.csv` (240 KB) y
`viirs-snpp/2020/…Dominican_Republic.csv` (600 KB). Columnas incluyen `type` (0 = presunto fuego de vegetación,
1 = volcán, 2 = otra fuente terrestre fija, 3 = costa afuera).

- Productos: `modis` (Terra+Aqua, desde nov. 2000) y `viirs-snpp` (desde 2012). NOAA-20/21 no entran en la serie
  armonizada (evita contar el mismo fuego tres veces); siguen disponibles en el panel en tiempo casi real.
- El año en curso se completa con la API de área / feeds NRT existentes.

### ¿Descargar todo de una vez?

No el planeta completo: el historial global crudo de ambos sensores son cientos de millones de filas y decenas de GB;
no cabe en 36 h ni en un portátil con margen. Sí:

- **Precarga completa** de RD y Haití (comparten la isla) más 1–2 países con una historia fuerte para la demo
  (p. ej. uno con temporada de quemas agrícolas muy marcada; lo elige el equipo).
- **Carga bajo demanda** de cualquier otro país desde el mapa global, con barra de progreso. Queda guardado.
- *(Decisión del constructor)* **Países grandes:** si el tamaño estimado de un país supera un umbral (p. ej. 500 MB de
  CSV en total), se carga en **modo agregado**: el descargador procesa cada archivo en *streaming*, guarda solo las
  celdas-día mensuales y conserva los focos crudos únicamente de los últimos 12 meses. Calendario y anomalías
  funcionan igual; el CSV de focos y el panel de detalle quedan limitados a ese período, y la interfaz lo indica.
- *(Decisión del constructor)* **Año en curso:** solo para RD y los países precargados, con la API de área / feeds NRT.
  Cuando llega el archivo anual, se aplica la regla ya existente: para un día cubierto por el archivo, las estadísticas
  excluyen las filas NRT de ese día (nunca se borran datos). Los demás países muestran «datos hasta <fecha>».

### Modelo de datos (extensión del esquema actual)

- `fire_detections`: añadir `country_iso3`, `fire_type` (columna `type` de FIRMS), `sensor_family`
  (`MODIS` | `VIIRS`). El `id` determinístico existente evita duplicados entre archivos anuales, API y feeds.
- `countries`: `iso3`, `name_es`, `firms_name` (nombre en la URL de FIRMS), bbox, geometría simplificada en
  `public/geo/world.geojson` (Natural Earth, dominio público).
- `country_loads`: estado por país/producto/año (pendiente, descargando, listo, error) → progreso y reanudación.
- `harmonized_monthly`: tabla derivada por (región, año, mes): conteo MODIS, conteo VIIRS, valor armonizado,
  `source_used`. Región = país, provincia, municipio. Las áreas dibujadas se calculan al vuelo.
- `calibration`: por región: factor `k`, intervalo de confianza, R², años de solape usados.
- `context_cache`: respuestas de GIBS y POWER por (capa/variable, fecha, punto redondeado).

## 5. Armonización (núcleo científico)

1. **Filtrado común:** `fire_type = 0`; confianza MODIS ≥ 30 (nominal o alta); VIIRS nominal o alta. Día y noche.
2. **Unidad común — celda-día activa:** cada detección se asigna a una celda de 0,01° (~1 km, la resolución de MODIS)
   y se cuenta una vez por celda y día. Así VIIRS no suma varios píxeles de 375 m por un mismo fuego de ~1 km.
3. **Calibración en el solape (2012 → último año con ambos):** por región,
   `k = Σ celdas-día VIIRS / Σ celdas-día MODIS` (si la región tiene pocos datos, se usa el `k` del país).
   Intervalo de confianza por *bootstrap* de meses. Se reporta R² entre MODIS×k y VIIRS mensuales.
4. **Serie armonizada (en «unidades VIIRS»):** antes de 2012 → MODIS × k; desde 2012 → VIIRS.
5. **Validación visible:** en `/metodologia`, gráfico MODIS×k vs VIIRS en el solape, valor de k, IC y R², y un
   párrafo en lenguaje sencillo. Las limitaciones (cambios de órbita de Terra/Aqua, nubosidad, umbral de detección)
   se nombran explícitamente.
6. **Anomalías:** mediana y percentiles 25/75 por mes del año (2003–año anterior); anomalía = valor / mediana.
   El mes actual se compara con la mediana de ese mes.
7. *(Decisión del constructor)* **Terra sola (nov. 2000 – jun. 2002, antes de Aqua):** se calibra un `k_terra`
   aparte usando solo las detecciones de Terra en el solape; esos meses se marcan como «un solo satélite» en el
   calendario y la línea base de anomalías empieza en 2003 para no contaminarla.
8. *(Decisión del constructor)* **Qué muestra el modo «crudo»:** el conteo de detecciones sin procesar, como se vería
   empalmando FIRMS a mano: MODIS hasta 2011 y VIIRS desde 2012. Es lo que produce el salto que la demo muestra.
   El modo «armonizado» es celdas-día × k. En `/api/calendar`, `modis` y `viirs` son conteos crudos de detecciones
   de cada sensor, y `harmonized` el valor armonizado.

## 6. Contrato de API (se fija antes de dividir el trabajo)

Los tipos viven en `src/lib/types.ts` (sin dependencias de Node) y hay respuestas de ejemplo en
`tests/fixtures/api/*.json` para que la interfaz avance contra datos simulados.

Parámetros comunes de región: `iso3` (por defecto `DOM`), `provinceId`, `municipalityId`, o `aoi` (bbox
`w,s,e,n` o GeoJSON de polígono codificado); `from`, `to` (`AAAA-MM-DD`).

| Ruta | Respuesta |
|---|---|
| `GET /api/countries` | `[{ iso3, name, loaded, progress, years: { modis: [desde, hasta] \| null, viirs: [...] \| null } }]` |
| `POST /api/countries/{iso3}/load` | `{ jobId }` — inicia la descarga del historial del país |
| `GET /api/countries/{iso3}/load` | `{ state, progress, done, total, error }` |
| `GET /api/calendar?…&mode=harmonized\|raw` | `{ cells: [{ year, month, modis, viirs, harmonized, anomaly }], monthStats: [{ month, median, p25, p75 }], calibration: { k, ci: [lo, hi], r2, overlapYears }, current: { year, month, value, median, ratio } }` |
| `GET /api/detections?…` | GeoJSON (existente, ampliado con `iso3`, `aoi`, `sensorFamily`) |
| `GET /api/export.csv?…&kind=detections\|monthly` | CSV descargable |
| `GET /api/detections/{id}/context` | `{ imagery: { url, date, layer }, weather: { windSpeed, windDir, t2m, rh, precip } \| null, cause: { label, likelihood, reasons: [] }, spread: { bearing, note } \| null }` |
| `GET /api/imagery?layer&date&bbox` | Imagen GIBS en caché (proxy local) |
| `POST /api/chat` | Texto en *streaming*; sin clave → `503 { error: "no_api_key" }` |
| `GET /api/status` (existente) | ampliado con `hasAiKey` |

## 7. Experiencia y estructura de páginas

```
/             Inicio: dos tarjetas grandes «Explorar el mundo» y «Incendios en RD», explicación en 3 frases
/global       Mapa mundial → elegir país (o dibujar área / escribir coordenadas) → calendario + anomalías + CSV
/rd           Panel actual de RD + calendario + provincias/municipios
/metodologia  Cómo armonizamos, validación (k, IC, R²), limitaciones; en lenguaje sencillo
/aprende      (existente) qué es un foco de calor; se simplifica
/estado       (existente) sincronización y datos cargados
Lateral       Chat IA plegable, presente en todas las páginas
Panel detalle Al tocar un foco: imagen GIBS del día, clima POWER, causa probable, propagación
```

- **Calendario:** cuadrícula años (filas) × meses (columnas). Rampa secuencial apta para daltonismo en modo
  conteo; rampa divergente centrada en 1 en modo anomalía. Cada celda con su número visible al pasar o enfocar,
  navegable con teclado, y una tabla equivalente para lectores de pantalla.
- **Accesibilidad:** textos cortos sin jerga (glosario en línea: «foco de calor», «FRP», «anomalía»), ayuda contextual
  en lugar de tutorial largo, contraste AA, foco visible, objetivos táctiles ≥ 24 px.
- **Causa probable (heurística, MVP):** `fire_type` de FIRMS (industrial/volcán/costa afuera) + temporada (mes con
  anomalía recurrente) + recurrencia (la misma celda ardió en años anteriores → probable quema agrícola o de
  limpieza). Cobertura del suelo de la NASA (MCD12Q1) es meta adicional si sobra tiempo.
- **Propagación estimada:** dirección hacia donde sopla el viento POWER del día; etiquetada como estimación.
- **Chat IA:** modelo `claude-opus-5-5` con `@anthropic-ai/sdk` en el servidor. Herramientas propias que consultan la
  base (calendario, anomalías, resumen de focos, contexto de un foco, metodología) y lectura/búsqueda web limitada a
  dominios de la NASA (`nasa.gov`, `earthdata.nasa.gov`, `firms.modaps.eosdis.nasa.gov`). Si no hay fuente, lo dice.

## 8. División del trabajo

Las dos partes se ejecutan **en paralelo**: la Parte 1 en esta sesión de Claude Code y la Parte 2 en Codex (decisión
del usuario). Por eso el contrato y los datos de ejemplo van primero.

Antes de empezar: **inicializar git** en la carpeta (hoy no es un repositorio) para que dos agentes puedan trabajar
sin pisarse y revertir errores. Cada parte toca solo sus archivos.

### Parte 1 — Datos, ciencia y API (Claude Code, esta sesión)

Propietario de: `src/db/**`, `drizzle/**`, `src/server/**`, `src/app/api/**`, `scripts/**`, `tests/unit/**`,
`src/lib/types.ts` (contrato), `tests/fixtures/api/**`, `public/geo/world.geojson`, `CLAUDE.md`, `docs/PLAN.md`.

1. Contrato: tipos en `src/lib/types.ts` + respuestas de ejemplo en `tests/fixtures/api/` (**primero**, desbloquea a Codex).
2. Esquema y migración: columnas nuevas, `countries`, `country_loads`, `harmonized_monthly`, `calibration`, `context_cache`.
3. Descargador de archivos anuales por país (reanudable, con progreso) + `npm run history:country -- DOM`.
4. Motor de armonización (celda-día, k, IC, R², serie, mediana/percentiles) con pruebas.
5. Rutas: `countries`, `calendar`, `export.csv`, `detections` ampliada, `context`, `imagery`, `chat`, `status`.
6. Integraciones GIBS y POWER con caché; heurística de causa y propagación.
7. Chat: backend con herramientas, estado sin clave.
8. Precarga de RD + Haití + países de demo; verificación del salto de 2012 con datos reales.

### Parte 2 — Interfaz y experiencia (Codex)

Propietario de: `src/app/**/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/**`,
`src/lib/useApi.ts`, `src/lib/format.ts`, `src/lib/mapStyle.ts`, `tests/e2e/**`.

1. Navegación y página de inicio con los dos modos.
2. `/global`: mapa mundial con países, selector, herramienta de dibujo de área y entrada de coordenadas, progreso de carga.
3. Componente calendario (conteo / anomalía, crudo / armonizado), tarjeta «mes actual vs mediana», botones CSV.
4. `/rd`: integrar calendario y selección de provincia/municipio en el panel existente.
5. Panel de detalle de un foco (imagen, clima, causa, propagación).
6. Chat lateral (estado sin clave incluido).
7. `/metodologia` con el gráfico de validación; simplificar `/aprende`.
8. Pase de accesibilidad y pruebas E2E de los flujos principales.

Codex trabaja contra `tests/fixtures/api/*.json` hasta que cada ruta real exista; al terminar cada ruta, Parte 1 lo
avisa. Ninguna parte edita archivos de la otra; si hace falta un cambio en el contrato, lo hace Parte 1.

### Equipo humano (en paralelo)

Narrativa y diapositivas, guion de la demo de 5 minutos, elección de los países de demostración, pruebas de uso con
alguien ajeno al tema.

## 9. Lo que queda a criterio del constructor

Nombres internos, librería de dibujo en el mapa, tamaño exacto de las celdas del bootstrap, umbral de «pocos datos»
para usar el `k` del país, estilos visuales concretos dentro de las reglas de accesibilidad.
