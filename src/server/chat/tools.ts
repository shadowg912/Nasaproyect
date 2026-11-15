import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { DB } from "@/db/client";
import { getCalendar } from "@/server/calendar";
import { getContext } from "@/server/context";
import { getStats } from "@/server/queries";

/** Únicos dominios que el chat puede buscar o leer en la web. */
export const NASA_DOMAINS = ["nasa.gov", "earthdata.nasa.gov", "firms.modaps.eosdis.nasa.gov"];
const MAX_WEB_USES = 3;

const region = {
  iso3: z.string().regex(/^[A-Z]{3}$/).describe("País ISO 3166-1 alfa-3, p. ej. DOM para República Dominicana"),
  provinceId: z.number().int().positive().optional().describe("Id de provincia (solo RD)"),
  municipalityId: z.number().int().positive().optional().describe("Id de municipio (solo RD)"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha inicial AAAA-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha final AAAA-MM-DD"),
};

const round2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

const METHODOLOGY = [
  "Fuente: NASA FIRMS (MODIS en Terra y Aqua desde 2000; VIIRS Suomi NPP desde 2012).",
  "1) Se descartan fuentes fijas (type ≠ 0) y detecciones de confianza baja.",
  "2) Cada detección se asigna a una celda de 0,01° (~1 km) y se cuenta una vez por celda y día (celdas-día).",
  "3) En los años con ambos sensores se calcula k = celdas-día VIIRS / celdas-día MODIS (IC 95 % por bootstrap, R²).",
  "4) Serie armonizada en unidades VIIRS: antes de 2012 MODIS × k (Terra sola hasta junio de 2002 usa su propio factor); desde 2012 VIIRS.",
  "5) Anomalía = valor del mes / mediana de ese mes en 2003–año anterior.",
  "Limitaciones: nubes, umbral de detección, cambios de órbita; la causa de un incendio no se observa desde el satélite.",
].join("\n");

/** Herramientas del chat: consultan la base local (nunca inventan cifras) y la web de la NASA. */
export function chatTools(db: DB) {
  return [
    betaZodTool({
      name: "consultar_calendario",
      description:
        "Calendario mensual de focos de calor de una región: celdas [año, mes, valor, anomalía], mediana por mes, calibración MODIS/VIIRS y el último mes completo frente a su mediana. mode=harmonized (comparable entre años) o raw (crudo).",
      inputSchema: z.object({ ...region, mode: z.enum(["harmonized", "raw"]).default("harmonized") }),
      run: async ({ mode, ...q }) => {
        const cal = getCalendar(db, q, mode);
        return JSON.stringify({
          mode: cal.mode,
          region: cal.region,
          cells: cal.cells.map((c) => [c.year, c.month, c.value, round2(c.anomaly)]),
          monthStats: cal.monthStats,
          calibration: cal.calibration,
          current: cal.current,
        });
      },
    }),
    betaZodTool({
      name: "resumen_focos",
      description: "Resumen de focos individuales en una región y periodo: total, FRP, confianza alta, por satélite y por provincia.",
      inputSchema: z.object(region),
      run: async (q) => {
        const s = getStats(db, { iso3: q.iso3, provinceId: q.provinceId, municipalityId: q.municipalityId, from: q.from, to: q.to });
        return JSON.stringify({ total: s.total, totalFrp: s.totalFrp, highConfidence: s.highConfidence, bySatellite: s.bySatellite, byProvince: s.byProvince.slice(0, 8) });
      },
    }),
    betaZodTool({
      name: "contexto_foco",
      description: "Contexto de un foco por su id: clima del día (NASA POWER), causa probable con razones y dirección de propagación estimada.",
      inputSchema: z.object({ id: z.string().min(1) }),
      run: async ({ id }) => JSON.stringify((await getContext(db, id)) ?? { error: "Foco no encontrado" }),
    }),
    betaZodTool({
      name: "metodologia",
      description: "Cómo se armonizan MODIS y VIIRS en esta aplicación y la calibración real de un país.",
      inputSchema: z.object({ iso3: region.iso3.default("DOM") }),
      run: async ({ iso3 }) => JSON.stringify({ metodo: METHODOLOGY, calibracion: getCalendar(db, { iso3 }, "harmonized").calibration }),
    }),
    { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: MAX_WEB_USES, allowed_domains: NASA_DOMAINS },
    { type: "web_fetch_20260209" as const, name: "web_fetch" as const, max_uses: MAX_WEB_USES, allowed_domains: NASA_DOMAINS },
  ];
}
