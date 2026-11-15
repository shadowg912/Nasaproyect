import type { DB } from "@/db/client";
import type { DetectionContext } from "@/lib/types";
import type { FetchLike } from "./firms/client";
import { CELL_DEG } from "./harmonize/cells";
import { GIBS_LAYER, localImageryUrl } from "./nasa/gibs";
import { fetchWeather } from "./nasa/power";

const RECURRENT_YEARS = 3;
const RECURRENT_HIGH_YEARS = 5;
const SPREAD_NOTE = "Estimación según el viento del día (NASA POWER); no es una predicción.";
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

interface Detection {
  id: string;
  latitude: number;
  longitude: number;
  acq_date: string;
  fire_type: number | null;
  country_iso3: string;
}

type Cause = DetectionContext["cause"];

const FIXED: Record<number, Cause> = {
  1: { label: "Actividad volcánica", likelihood: "alta", reasons: ["FIRMS clasifica este punto como volcán."] },
  2: {
    label: "Fuente industrial o fija",
    likelihood: "alta",
    reasons: ["FIRMS marca este punto como fuente de calor fija (por ejemplo, una industria o quema permanente), no como incendio de vegetación."],
  },
  3: { label: "Fuente costa afuera", likelihood: "alta", reasons: ["FIRMS clasifica este punto como fuente en el mar (por ejemplo, una plataforma)."] },
};

/** Años distintos con focos en la misma celda de ~1 km y el mismo trimestre que el foco. */
function recurrentYears(db: DB, d: Detection): number {
  const lat0 = Math.floor(d.latitude / CELL_DEG + 1e-9) * CELL_DEG;
  const lon0 = Math.floor(d.longitude / CELL_DEG + 1e-9) * CELL_DEG;
  const quarter = Math.floor((Number(d.acq_date.slice(5, 7)) - 1) / 3);
  const r = db.$client
    .prepare(
      `SELECT COUNT(DISTINCT substr(acq_date, 1, 4)) AS n FROM fire_detections
       WHERE latitude >= ? AND latitude < ? AND longitude >= ? AND longitude < ?
         AND (CAST(substr(acq_date, 6, 2) AS INTEGER) - 1) / 3 = ? AND COALESCE(fire_type, 0) = 0`,
    )
    .get(lat0, lat0 + CELL_DEG, lon0, lon0 + CELL_DEG, quarter) as { n: number };
  return r.n;
}

/** ¿Es el mes del foco uno de los tres de mayor actividad armonizada típica del país? */
function inBurningSeason(db: DB, d: Detection): boolean {
  const rows = db.$client
    .prepare("SELECT month, AVG(harmonized) AS avg FROM harmonized_monthly WHERE region_key = ? AND harmonized IS NOT NULL GROUP BY month")
    .all(d.country_iso3) as { month: number; avg: number }[];
  if (rows.length < 12) return false;
  const top = [...rows].sort((a, b) => b.avg - a.avg).slice(0, 3).map((r) => r.month);
  return top.includes(Number(d.acq_date.slice(5, 7)));
}

/** Causa probable a partir de señales de los datos (nunca como hecho). */
export function probableCause(db: DB, d: Detection): Cause {
  if (d.fire_type !== null && FIXED[d.fire_type]) return FIXED[d.fire_type];
  const years = recurrentYears(db, d);
  const month = MONTHS[Number(d.acq_date.slice(5, 7)) - 1];
  const season = inBurningSeason(db, d);
  const seasonReason = `${month[0].toUpperCase()}${month.slice(1)} es uno de los meses con más focos en la serie histórica del país.`;
  if (years >= RECURRENT_YEARS)
    return {
      label: "Probable quema agrícola o de limpieza recurrente",
      likelihood: years >= RECURRENT_HIGH_YEARS ? "alta" : "media",
      reasons: [
        `Esta zona de ~1 km tuvo focos en ${years} años distintos en la misma época del año: un patrón típico de quemas agrícolas o de limpieza de terrenos.`,
        ...(season ? [seasonReason] : []),
      ],
    };
  if (season) return { label: "Temporada de quemas", likelihood: "media", reasons: [seasonReason, "La causa exacta no se puede saber desde el satélite."] };
  return {
    label: "Incendio de vegetación (causa no determinada)",
    likelihood: "baja",
    reasons: ["No hay señales de repetición ni de temporada; el satélite detecta el calor, no la causa."],
  };
}

/** Contexto de un foco: imagen GIBS del día, clima POWER, causa probable y dirección de propagación estimada. */
export async function getContext(db: DB, id: string, fetchImpl: FetchLike = fetch): Promise<DetectionContext | null> {
  const d = db.$client
    .prepare("SELECT id, latitude, longitude, acq_date, fire_type, country_iso3 FROM fire_detections WHERE id = ?")
    .get(id) as Detection | undefined;
  if (!d) return null;
  const weather = await fetchWeather(db, d.latitude, d.longitude, d.acq_date, fetchImpl).catch(() => null);
  return {
    imagery: { url: localImageryUrl(d.latitude, d.longitude, d.acq_date), date: d.acq_date, layer: GIBS_LAYER },
    weather,
    cause: probableCause(db, d),
    spread: weather ? { bearing: (weather.windDir + 180) % 360, note: SPREAD_NOTE } : null,
  };
}
