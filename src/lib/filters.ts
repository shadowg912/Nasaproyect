"use client";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, toDate } from "./dates";

export type Preset = "24h" | "7d" | "30d" | "365d" | "all" | "custom";
export const PRESETS: { id: Preset; label: string; days?: number }[] = [
  { id: "24h", label: "24 h", days: 2 },
  { id: "7d", label: "7 días", days: 7 },
  { id: "30d", label: "30 días", days: 30 },
  { id: "365d", label: "12 meses", days: 365 },
  { id: "all", label: "Todo" },
];

export interface UiFilters {
  preset: Preset;
  from?: string;
  to?: string;
  satellite: string[];
  confidence: string[];
  province?: string;
  municipality?: string;
  daynight?: string;
}

/** Filtros persistidos en la URL para poder compartir/recargar la vista. */
export function useFilters(defaultPreset: Preset = "7d") {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: UiFilters = useMemo(() => {
    const preset = (sp.get("preset") as Preset) || (sp.get("from") || sp.get("to") ? "custom" : defaultPreset);
    const list = (k: string) => (sp.get(k) ?? "").split(",").filter(Boolean);
    return {
      preset,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      satellite: list("satellite"),
      confidence: list("confidence"),
      province: sp.get("province") ?? undefined,
      municipality: sp.get("municipality") ?? undefined,
      daynight: sp.get("daynight") ?? undefined,
    };
  }, [sp, defaultPreset]);

  const update = useCallback(
    (patch: Partial<UiFilters>) => {
      const next = { ...filters, ...patch };
      const q = new URLSearchParams();
      if (next.preset !== defaultPreset || next.preset === "custom") q.set("preset", next.preset);
      if (next.preset === "custom") {
        if (next.from) q.set("from", next.from);
        if (next.to) q.set("to", next.to);
      }
      if (next.satellite.length) q.set("satellite", next.satellite.join(","));
      if (next.confidence.length) q.set("confidence", next.confidence.join(","));
      if (next.province) q.set("province", next.province);
      if (next.municipality) q.set("municipality", next.municipality);
      if (next.daynight) q.set("daynight", next.daynight);
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [filters, router, pathname, defaultPreset],
  );

  /** Parámetros para las rutas /api/* (rango resuelto a fechas UTC). */
  const apiQuery = useMemo(() => {
    const q = new URLSearchParams();
    const today = toDate(new Date());
    const p = PRESETS.find((x) => x.id === filters.preset);
    if (p?.days) {
      q.set("from", addDays(today, -(p.days - 1)));
      q.set("to", today);
    } else if (filters.preset === "custom") {
      if (filters.from) q.set("from", filters.from);
      if (filters.to) q.set("to", filters.to);
    }
    if (filters.satellite.length) q.set("satellite", filters.satellite.join(","));
    if (filters.confidence.length) q.set("confidence", filters.confidence.join(","));
    if (filters.province) q.set("province", filters.province);
    if (filters.municipality) q.set("municipality", filters.municipality);
    if (filters.daynight) q.set("daynight", filters.daynight);
    return q.toString();
  }, [filters]);

  return { filters, update, apiQuery };
}
