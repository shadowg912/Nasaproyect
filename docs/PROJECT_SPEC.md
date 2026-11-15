# CAMBIO DE ARQUITECTURA — PROYECTO DE MONITOREO DE INCENDIOS RD

Necesito que modifiques las instrucciones anteriores del proyecto.

La decisión arquitectónica es definitiva: construiremos una aplicación LOCAL-FIRST que dependa lo mínimo posible de servicios externos.

## 1. Restricción principal

La única API externa permitida durante la ejecución normal es NASA FIRMS.

No utilizar:

- Supabase
- Firebase
- PlanetScale
- Neon
- MongoDB Atlas
- Servicios externos de autenticación
- Mapbox Cloud
- MapTiler Cloud
- Google Maps API
- APIs de analítica externas
- CDNs externos en tiempo de ejecución
- Servicios de almacenamiento en la nube
- Bases de datos administradas

Se permiten dependencias de npm descargadas durante la instalación y herramientas locales de desarrollo.

La aplicación debe ser capaz de funcionar sin conexión a Internet usando los datos previamente descargados.

## 2. Base de datos local

Reemplaza completamente PostgreSQL, Supabase y PostGIS por:

- SQLite
- better-sqlite3
- Drizzle ORM

La base de datos debe almacenarse en:

data/fuego-rd.sqlite

Crear automáticamente el directorio de datos y proporcionar scripts para inicializar la base de datos y ejecutar las migraciones.

No almacenar el archivo SQLite dentro de public/.

Agregar el directorio data/ y archivos de base de datos a .gitignore.

Usar modo WAL cuando sea apropiado.

Crear tablas:

- fire_detections
- provinces
- municipalities
- ingestion_runs
- ingestion_coverage

Agregar índices sobre fechas, sensores y provincias.

Utilizar identificadores determinísticos o restricciones únicas para evitar duplicados al sincronizar.

## 3. Mapas totalmente locales

Utilizar MapLibre GL JS.

El mapa debe funcionar sin Google Maps, Mapbox, OpenStreetMap Tile Servers ni otros proveedores de teselas durante la ejecución.

Implementar cartografía local mediante archivos PMTiles.

Guardar los recursos geográficos en:

public/maps/
public/geo/

Incluir:

- Mapa base local de República Dominicana.
- Límites nacionales en GeoJSON.
- Límites de provincias en GeoJSON.
- Límites municipales cuando exista una fuente confiable.
- Estilos locales del mapa.
- Fuentes y sprites locales si el estilo los requiere.

Utilizar PMTiles con MapLibre mediante un protocolo configurado correctamente.

No utilizar URLs remotas en el estilo del mapa.

Si todavía no hay un archivo PMTiles disponible, implementar inicialmente un mapa funcional con GeoJSON local y un fondo sencillo, sin depender de servicios externos.

Crear un script documentado para preparar los recursos cartográficos locales.

Verificar la licencia, atribución y procedencia de los datos geográficos.

## 4. Integración con NASA FIRMS

Mantener la integración con NASA FIRMS utilizando una MAP_KEY privada.

URL de documentación:

https://firms.modaps.eosdis.nasa.gov/api/area/

El backend realizará las solicitudes.

Usar preferentemente:

- VIIRS_NOAA20_NRT
- VIIRS_NOAA21_NRT
- VIIRS_SNPP_NRT

Consultar únicamente el bounding box necesario para República Dominicana y filtrar después mediante límites geográficos locales.

El filtrado final debe excluir coordenadas fuera del territorio dominicano.

Utilizar Turf.js para determinar si una detección pertenece al país, provincia o municipio correspondiente.

Guardar las observaciones procesadas en SQLite.

Si no hay conexión, continuar utilizando los datos almacenados.

Mostrar claramente la fecha de la última sincronización.

No confundir ausencia de nuevas detecciones con un fallo de conectividad.

## 5. Sincronización

Implementar un servicio local que pueda:

1. Consultar NASA.
2. Descargar las respuestas.
3. Validar el CSV.
4. Normalizar los registros.
5. Filtrar territorialmente.
6. Evitar duplicados.
7. Guardar en SQLite.
8. Registrar el resultado.

Crear el comando:

npm run sync:firms

Este comando debe permitir actualizar los datos manualmente.

Implementar también sincronización periódica opcional desde un proceso local separado o el planificador del sistema operativo.

No depender de cron jobs administrados por plataformas externas.

No iniciar múltiples procesos de sincronización que escriban los mismos registros simultáneamente.

## 6. Historial

Todos los datos históricos deben guardarse localmente.

Crear scripts para importar rangos de fechas desde NASA cuando los productos oficiales estén disponibles.

Procesar los rangos grandes en lotes y registrar los intervalos efectivamente cubiertos.

No asumir que los productos NRT ofrecen un historial completo.

No descargar automáticamente años enteros durante el inicio de la aplicación.

## 7. Interfaz

Mantener todas las características del diseño original:

- Dashboard.
- Mapa interactivo.
- Filtros.
- Gráficos.
- Análisis histórico.
- Explicaciones educativas.
- Diseño responsive.
- Interfaz en español.

Añadir un indicador de conectividad y sincronización:

- Datos actualizados.
- Datos almacenados localmente.
- Sin conexión con NASA.
- Nunca sincronizado.

Los gráficos deben consultar exclusivamente la base de datos local.

## 8. Ejecución

El proyecto debe poder ejecutarse con:

npm install
npm run db:init
npm run dev

Y permitir sincronizar con:

npm run sync:firms

Configurar:

FIRMS_MAP_KEY=
DATABASE_PATH=./data/fuego-rd.sqlite

La variable DATABASE_PATH debe apuntar al almacenamiento local.

Documentar cómo iniciar el proyecto sin tener todavía una MAP_KEY.

## 9. Requisitos importantes

- No incluir solicitudes remotas ocultas.
- No utilizar fuentes de Google Fonts en ejecución.
- No depender de servicios de telemetría.
- No incluir credenciales públicas innecesarias.
- No usar SQLite desde componentes del navegador.
- Usar Node.js como runtime en todas las rutas que acceden a SQLite.
- No implementar rutas de API que se ejecuten en Edge Runtime.
- No asumir que el almacenamiento es persistente en plataformas serverless.
- Garantizar que todas las funcionalidades de lectura operen sin conexión externa una vez configurada la aplicación.

## 10. Pruebas adicionales

Verificar específicamente:

1. La aplicación inicia con NASA inaccesible.
2. El mapa funciona sin conexión.
3. Los filtros funcionan sin conexión.
4. Los gráficos utilizan SQLite.
5. La sincronización puede repetirse sin duplicar registros.
6. Los datos persisten después de reiniciar el servidor.
7. No existen solicitudes a proveedores externos al cargar la interfaz.
8. Los errores de NASA no eliminan datos existentes.

Si es necesario, utiliza Playwright para inspeccionar las solicitudes de red y confirmar la ausencia de dependencias externas.

## 11. Resultado esperado

Quiero una aplicación autónoma que pueda ejecutarse en una computadora o un servidor propio.

NASA FIRMS será nuestra fuente externa de datos científicos.

Todo lo demás —almacenamiento, mapas, estadísticas, interfaz y análisis— será procesado y servido por nuestra propia aplicación.

Prioriza simplicidad, independencia, rendimiento y facilidad de mantenimiento.

Implementa esta arquitectura y elimina las dependencias de servicios externos presentes en las instrucciones anteriores.
