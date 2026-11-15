"use client";
import { useApi } from "@/lib/useApi";
import { PRESETS, type UiFilters } from "@/lib/filters";
import { CONFIDENCE_LABEL } from "@/lib/types";

interface Territory {
  provinces: { id: number; name: string }[];
  municipalities: { id: number; name: string; provinceId: number | null }[];
}

const SATS = [
  { id: "NOAA20", label: "NOAA-20" },
  { id: "NOAA21", label: "NOAA-21" },
  { id: "SNPP", label: "Suomi NPP" },
];

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function FilterBar({ filters, update, presets = PRESETS }: { filters: UiFilters; update: (p: Partial<UiFilters>) => void; presets?: typeof PRESETS }) {
  const { data: territory } = useApi<Territory>("/api/territory");
  const munis = territory?.municipalities.filter((m) => !filters.province || String(m.provinceId) === filters.province) ?? [];
  const active =
    filters.satellite.length + filters.confidence.length + (filters.province ? 1 : 0) + (filters.municipality ? 1 : 0) + (filters.daynight ? 1 : 0);

  return (
    <section className="card space-y-3" aria-label="Filtros" data-testid="filters">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold text-stone-600">Periodo</span>
        {presets.map((p) => (
          <button key={p.id} type="button" className={`chip ${filters.preset === p.id ? "chip-on" : "chip-off"}`} onClick={() => update({ preset: p.id })}>
            {p.label}
          </button>
        ))}
        <button type="button" className={`chip ${filters.preset === "custom" ? "chip-on" : "chip-off"}`} onClick={() => update({ preset: "custom" })}>
          Personalizado
        </button>
        {filters.preset === "custom" && (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <label>
              Desde <input type="date" className="input" value={filters.from ?? ""} onChange={(e) => update({ from: e.target.value || undefined })} />
            </label>
            <label>
              Hasta <input type="date" className="input" value={filters.to ?? ""} onChange={(e) => update({ to: e.target.value || undefined })} />
            </label>
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-stone-600">Satélite</span>
          {SATS.map((s) => (
            <button key={s.id} type="button" aria-pressed={filters.satellite.includes(s.id)} className={`chip ${filters.satellite.includes(s.id) ? "chip-on" : "chip-off"}`} onClick={() => update({ satellite: toggle(filters.satellite, s.id) })}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-stone-600">Confianza</span>
          {(["high", "nominal", "low"] as const).map((c) => (
            <button key={c} type="button" aria-pressed={filters.confidence.includes(c)} data-testid={`conf-${c}`} className={`chip ${filters.confidence.includes(c) ? "chip-on" : "chip-off"}`} onClick={() => update({ confidence: toggle(filters.confidence, c) })}>
              {CONFIDENCE_LABEL[c]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-stone-600">Momento</span>
          <select className="input" value={filters.daynight ?? ""} onChange={(e) => update({ daynight: e.target.value || undefined })}>
            <option value="">Día y noche</option>
            <option value="D">Día</option>
            <option value="N">Noche</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-stone-600">Provincia</span>
          <select data-testid="province-select" className="input max-w-[12rem]" value={filters.province ?? ""} onChange={(e) => update({ province: e.target.value || undefined, municipality: undefined })}>
            <option value="">Todo el país</option>
            {territory?.provinces.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-stone-600">Municipio</span>
          <select className="input max-w-[12rem]" value={filters.municipality ?? ""} onChange={(e) => update({ municipality: e.target.value || undefined })}>
            <option value="">Todos</option>
            {munis.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        {active > 0 && (
          <button type="button" className="text-sm text-fuego-700 underline" onClick={() => update({ satellite: [], confidence: [], province: undefined, municipality: undefined, daynight: undefined })}>
            Limpiar filtros ({active})
          </button>
        )}
      </div>
    </section>
  );
}
