"use client";
import { availableOn, GROUP_LABELS, LAYERS, type LayerDef, type LayerGroup } from "@/lib/layers";
import type { FireStyle } from "@/lib/map/types";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { useMapApp } from "./MapAppContext";

const STYLE_LABELS: Record<FireStyle, string> = { simple: "Simple", age: "Por antigüedad", confidence: "Por confianza" };
const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Availability({ layer, date }: { layer: LayerDef; date: string }) {
  if (availableOn(layer, date) || !layer.available) return null;
  const range = layer.available.to ? `del ${fmt(layer.available.from)} al ${fmt(layer.available.to)}` : `desde el ${fmt(layer.available.from)}`;
  return (
    <p className="mt-1 rounded bg-warn px-2 py-0.5 text-xs font-semibold text-text">Datos solo disponibles {range}</p>
  );
}

function Legend({ layer }: { layer: LayerDef }) {
  if (!layer.legend) return null;
  return (
    <div className="mt-1" aria-label={`Leyenda: de ${layer.legend.min} a ${layer.legend.max}`}>
      <div className="h-2 rounded" style={{ background: `linear-gradient(90deg, ${layer.legend.colors.join(",")})` }} />
      <div className="glass-muted flex justify-between text-[11px]"><span>{layer.legend.min}</span><span>{layer.legend.max}</span></div>
    </div>
  );
}

interface RowProps {
  layer: LayerDef;
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  date: string;
}

function Row({ layer, type, name, checked, onChange, date }: RowProps) {
  const disabled = !availableOn(layer, date);
  return (
    <li className="border-b border-white/10 py-1.5 last:border-0">
      <label className={`flex min-h-8 items-center gap-2 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
        <input type={type} name={name} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand-500" />
        <span className="flex-1 text-sm">{layer.name}</span>
        <span className="glass-muted" title={`Fuente: ${layer.attribution}`}>
          <Icon name="info" size={16} />
          <span className="sr-only">Fuente: {layer.attribution}</span>
        </span>
      </label>
      <Availability layer={layer} date={date} />
      {checked && <Legend layer={layer} />}
    </li>
  );
}

function Group({ group, count, children, open = false }: { group: LayerGroup; count: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-white/15 py-1">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-semibold">
        <span className="flex items-center gap-2">
          <Icon name="chevron" size={16} className="transition-transform group-open:rotate-90" />
          {GROUP_LABELS[group]}
        </span>
        <span className="glass-muted text-xs">{count}</span>
      </summary>
      <ul className="pl-6">{children}</ul>
    </details>
  );
}

/** Panel de capas: 5 grupos plegados con valores por defecto ya elegidos (ley de Hick). */
export function LayerPanel() {
  const { state, setState, openTool, setOpenTool } = useMapApp();
  if (openTool !== "layers") return null;
  const by = (g: LayerGroup) => LAYERS.filter((l) => l.group === g);
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id));
  const multiImagery = state.imagery.length > 1;
  const visibleOverlays = by("overlay");

  return (
    <div className="absolute left-3 top-[calc(var(--topbar-h)+0.75rem)] z-30 w-[min(340px,calc(100vw-1.5rem))]">
      <Panel id="layers" title="Capas" onClose={() => setOpenTool(null)}>
        <Group group="fires" count={`${state.fireSats.length}/5`} open>
          {by("fires").map((l) => (
            <Row key={l.id} layer={l} type="checkbox" name="fires" date={state.date} checked={state.fireSats.includes(l.id)}
              onChange={(on) => setState({ fireSats: toggle(state.fireSats, l.id, on) })} />
          ))}
          <li className="pt-2">
            <fieldset>
              <legend className="glass-muted mb-1 text-xs uppercase tracking-wide">Color de los focos</legend>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(STYLE_LABELS) as FireStyle[]).map((st) => (
                  <button key={st} type="button" aria-pressed={state.fireStyle === st} onClick={() => setState({ fireStyle: st })}
                    className="ui-btn ui-btn-glass ui-btn-sm">{STYLE_LABELS[st]}</button>
                ))}
              </div>
            </fieldset>
          </li>
        </Group>
        <Group group="background" count="1/6">
          {by("background").map((l) => (
            <Row key={l.id} layer={l} type="radio" name="background" date={state.date} checked={state.background === l.id}
              onChange={() => setState({ background: l.id })} />
          ))}
        </Group>
        <Group group="overlay" count={`${state.overlays.length}/${visibleOverlays.length}`}>
          {visibleOverlays.map((l) => (
            <Row key={l.id} layer={l} type="checkbox" name="overlays" date={state.date} checked={state.overlays.includes(l.id)}
              onChange={(on) => setState({ overlays: toggle(state.overlays, l.id, on) })} />
          ))}
        </Group>
        <Group group="imagery" count={`${state.imagery.length}/7`}>
          <li className="py-1.5">
            <label className="flex min-h-8 items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-brand-500" checked={multiImagery}
                onChange={(e) => !e.target.checked && setState({ imagery: state.imagery.slice(0, 1) })} disabled={!multiImagery} />
              Varias a la vez (marca otra con Ctrl)
            </label>
          </li>
          {by("imagery").map((l) => (
            <Row key={l.id} layer={l} type="checkbox" name="imagery" date={state.date} checked={state.imagery.includes(l.id)}
              onChange={(on) => setState({ imagery: on ? (multiImagery ? toggle(state.imagery, l.id, true) : [l.id]) : toggle(state.imagery, l.id, false) })} />
          ))}
        </Group>
        <Group group="aerosol" count={state.aerosol ? "1/6" : "0/6"}>
          <li className="py-1.5">
            <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="aerosol" className="size-4 accent-brand-500" checked={!state.aerosol} onChange={() => setState({ aerosol: null })} />
              Ninguno
            </label>
          </li>
          {by("aerosol").map((l) => (
            <Row key={l.id} layer={l} type="radio" name="aerosol" date={state.date} checked={state.aerosol === l.id}
              onChange={() => setState({ aerosol: l.id })} />
          ))}
        </Group>
        <p className="glass-muted mt-3 text-xs">Fondos de Esri y áreas protegidas de UNEP-WCMC requieren Internet. Datos de focos, imágenes y aerosoles: NASA.</p>
      </Panel>
    </div>
  );
}
