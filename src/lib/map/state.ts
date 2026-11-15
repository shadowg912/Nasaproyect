import { addDays, isIsoDate } from "@/lib/dates";
import { DEFAULT_BACKGROUND, LAYERS, type LayerGroup } from "@/lib/layers";
import type { FireStyle, MapMode, MapState, PeriodBounds, TimeRange } from "./types";

const RANGES: TimeRange[] = ["24h", "48h", "week"];
const STYLES: FireStyle[] = ["simple", "age", "confidence"];
const idsOf = (g: LayerGroup) => new Set(LAYERS.filter((l) => l.group === g).map((l) => l.id));
const GROUP_IDS = { background: idsOf("background"), overlay: idsOf("overlay"), imagery: idsOf("imagery"), aerosol: idsOf("aerosol"), fires: idsOf("fires") };

export function defaultState(mode: MapMode, today: string): MapState {
  const local = mode === "local";
  return {
    mode,
    center: local ? [-70.2, 18.9] : [0, 15],
    zoom: local ? 7.3 : 1.6,
    date: today,
    range: "week",
    background: DEFAULT_BACKGROUND,
    overlays: ["reference-basic"],
    imagery: [],
    aerosol: null,
    fireSats: [...GROUP_IDS.fires],
    fireStyle: "age",
    projection: "mercator",
    iso3: "DOM",
  };
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** Query string compacta para compartir la vista. */
export function encodeState(s: MapState): string {
  const p = new URLSearchParams({
    c: `${r4(s.center[0])},${r4(s.center[1])}`,
    z: String(Math.round(s.zoom * 100) / 100),
    d: s.date,
    r: s.range,
    bg: s.background,
    ov: s.overlays.join(","),
    im: s.imagery.join(","),
    ae: s.aerosol ?? "",
    fs: s.fireSats.join(","),
    st: s.fireStyle,
    p: s.projection === "globe" ? "g" : "m",
    iso: s.iso3,
  });
  return p.toString();
}

const list = (v: string | null, allowed: Set<string>) => (v ?? "").split(",").filter((x) => allowed.has(x));

/** Lee el estado de la URL; todo valor inválido se sustituye por el de `defaultState`. */
export function decodeState(qs: string, mode: MapMode, today: string): MapState {
  const d = defaultState(mode, today);
  const p = new URLSearchParams(qs);
  const s = { ...d };
  const c = (p.get("c") ?? "").split(",").map(Number);
  if (c.length === 2 && c.every(Number.isFinite) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 85) s.center = [c[0], c[1]];
  const z = Number(p.get("z"));
  if (p.has("z") && Number.isFinite(z) && z >= 0 && z <= 22) s.zoom = z;
  const date = p.get("d");
  if (isIsoDate(date) && date <= today) s.date = date;
  const r = p.get("r") as TimeRange;
  if (RANGES.includes(r)) s.range = r;
  const bg = p.get("bg");
  if (bg && GROUP_IDS.background.has(bg)) s.background = bg;
  if (p.has("ov")) s.overlays = list(p.get("ov"), GROUP_IDS.overlay);
  if (p.has("im")) s.imagery = list(p.get("im"), GROUP_IDS.imagery);
  const ae = p.get("ae");
  if (ae && GROUP_IDS.aerosol.has(ae)) s.aerosol = ae;
  if (p.has("fs")) s.fireSats = list(p.get("fs"), GROUP_IDS.fires);
  const st = p.get("st") as FireStyle;
  if (STYLES.includes(st)) s.fireStyle = st;
  if (p.get("p") === "g") s.projection = "globe";
  const iso = (p.get("iso") ?? "").toUpperCase();
  if (mode === "global" && /^[A-Z]{3}$/.test(iso)) s.iso3 = iso;
  return s;
}

/** Periodo de la línea de tiempo: termina el día elegido (UTC). */
export function periodBounds(date: string, range: TimeRange): PeriodBounds {
  const back = range === "week" ? 6 : range === "48h" ? 1 : 0;
  return { from: addDays(date, -back), to: date, end: `${date}T23:59:59Z` };
}
