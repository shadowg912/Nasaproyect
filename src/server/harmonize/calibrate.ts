import type { Calibration } from "@/lib/types";
import type { MonthCounts } from "./cells";

/** Calibración interna: añade el factor NOAA-20 → Suomi NPP (no forma parte del contrato público). */
export interface EngineCalibration extends Calibration {
  kNoaa20: number | null;
}

export const MIN_OVERLAP_MONTHS = 12;
const BOOTSTRAP_SAMPLES = 1000;

type Pair = [num: number, den: number];

const ratio = (pairs: Pair[]): number | null => {
  const den = pairs.reduce((s, p) => s + p[1], 0);
  return den > 0 ? pairs.reduce((s, p) => s + p[0], 0) / den : null;
};

const percentile = (sorted: number[], p: number) => {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
};

/** Intervalo de confianza del 95 % de k remuestreando meses con reemplazo. */
function bootstrapCi(pairs: Pair[], rng: () => number): [number, number] {
  const ks: number[] = [];
  for (let b = 0; b < BOOTSTRAP_SAMPLES; b++) {
    const sample: Pair[] = [];
    for (let i = 0; i < pairs.length; i++) sample.push(pairs[Math.floor(rng() * pairs.length)]);
    const k = ratio(sample);
    if (k !== null) ks.push(k);
  }
  ks.sort((a, b) => a - b);
  return [percentile(ks, 0.025), percentile(ks, 0.975)];
}

/** R² de VIIRS mensual frente a MODIS × k. */
function rSquared(pairs: Pair[], k: number): number {
  const mean = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const ssTot = pairs.reduce((s, p) => s + (p[0] - mean) ** 2, 0);
  const ssRes = pairs.reduce((s, p) => s + (p[0] - p[1] * k) ** 2, 0);
  return ssTot > 0 ? 1 - ssRes / ssTot : 1;
}

/**
 * k = Σ celdas-día VIIRS / Σ celdas-día MODIS en los meses del solape con ambos > 0.
 * Devuelve null si hay menos de 12 meses utilizables.
 */
export function calibrate(
  m: Map<string, MonthCounts>,
  overlap: [number, number],
  rng: () => number = Math.random,
): EngineCalibration | null {
  const inOverlap = [...m.entries()]
    .filter(([ym]) => {
      const y = Number(ym.slice(0, 4));
      return y >= overlap[0] && y <= overlap[1];
    })
    .map(([, c]) => c);
  const pairsOf = (den: (c: MonthCounts) => number): Pair[] =>
    inOverlap.filter((c) => c.viirsCd > 0 && den(c) > 0).map((c) => [c.viirsCd, den(c)]);
  const pairs = pairsOf((c) => c.modisCd);
  if (pairs.length < MIN_OVERLAP_MONTHS) return null;
  const k = ratio(pairs)!;
  const n20 = pairsOf((c) => c.noaa20Cd);
  return {
    k,
    ci: bootstrapCi(pairs, rng),
    r2: rSquared(pairs, k),
    overlapYears: overlap,
    kTerra: ratio(pairsOf((c) => c.terraCd)) ?? k * 2,
    kNoaa20: n20.length >= MIN_OVERLAP_MONTHS ? ratio(n20) : null,
    source: "region",
  };
}
