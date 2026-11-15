"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { LayerSpecification, Map as MapLibreMap, MapMouseEvent, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { layerById } from "@/lib/layers";
import { buildStyle, fireColorExpression } from "@/lib/map/style";
import type { MapState, PeriodBounds } from "@/lib/map/types";
import { COLORS } from "@/lib/tokens";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMapApp } from "./MapAppContext";

/** Errores de teselas de un fondo de terceros antes de pasar al fondo local. */
const OFFLINE_AFTER_ERRORS = 3;

function detectionsUrl(s: MapState, period: PeriodBounds, loaded: boolean): string | null {
  if (s.mode === "global" && !loaded) return null;
  const sats = [...new Set(s.fireSats.map((id) => layerById(id)?.satellite).filter(Boolean))];
  if (!sats.length) return null;
  const q = new URLSearchParams({ from: period.from, to: period.to, iso3: s.iso3, satellite: sats.join(",") });
  return `/api/detections?${q}`;
}

/** Capas propias encima del estilo base: focos clicables, volcanes y límites locales. */
function withOwnLayers(base: StyleSpecification, s: MapState, period: PeriodBounds, firesUrl: string | null): StyleSpecification {
  const style = { ...base, sources: { ...base.sources }, layers: [...base.layers] };
  if (s.mode === "local") {
    style.sources.provinces = { type: "geojson", data: "/geo/provinces.geojson" };
    style.layers.push({ id: "provinces-line", type: "line", source: "provinces", paint: { "line-color": COLORS.inkMuted, "line-width": 1, "line-opacity": 0.7 } });
  }
  if (s.overlays.includes("volcanoes")) {
    style.sources.volcanoes = { type: "geojson", data: "/geo/volcanoes.geojson" };
    style.layers.push({
      id: "volcanoes", type: "circle", source: "volcanoes",
      paint: { "circle-radius": 5, "circle-color": "#f2711c", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 },
    });
  }
  if (firesUrl) {
    style.sources.fires = { type: "geojson", data: firesUrl, attribution: "NASA FIRMS" };
    const color = fireColorExpression(s.fireStyle, period.end) as never;
    style.layers.push(
      {
        id: "fires-halo", type: "circle", source: "fires",
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 4, 10, 10], "circle-color": color, "circle-opacity": 0.25, "circle-blur": 0.6 },
      } as LayerSpecification,
      {
        id: "fires", type: "circle", source: "fires",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 2.5, 10, 6, 14, 9],
          "circle-color": color, "circle-stroke-color": "#1b0a00", "circle-stroke-width": 0.6,
        },
      } as LayerSpecification,
    );
  }
  return style;
}

export function MapView({ onMap, onOffline }: { onMap: (m: MapLibreMap | null) => void; onOffline: (v: boolean) => void }) {
  const { state, setState, period, offline, setSelectedFocus } = useMapApp();
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const errors = useRef(0);
  const [loading, setLoading] = useState(true);
  const [loadedCountries, setLoadedCountries] = useState<Set<string>>(new Set(["DOM"]));

  useEffect(() => {
    if (state.mode !== "global") return;
    fetch("/api/countries")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { iso3: string; loaded: boolean }[]) => setLoadedCountries(new Set(list.filter((c) => c.loaded).map((c) => c.iso3))))
      .catch(() => undefined);
  }, [state.mode]);

  const firesUrl = detectionsUrl(state, period, loadedCountries.has(state.iso3));
  const style = useMemo(() => withOwnLayers(buildStyle(state, { offline }), state, period, firesUrl), [state, period, offline, firesUrl]);

  useEffect(() => {
    if (!ref.current) return;
    maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
    const map = new maplibregl.Map({
      container: ref.current, style, center: state.center, zoom: state.zoom, attributionControl: { compact: true },
      canvasContextAttributes: { preserveDrawingBuffer: true }, maxPitch: 0,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("load", () => setLoading(false));
    map.on("moveend", () => {
      const c = map.getCenter();
      setState({ center: [c.lng, c.lat], zoom: map.getZoom() });
    });
    map.on("error", (ev) => {
      const e = ev as unknown as { sourceId?: string };
      const src = e.sourceId ? layerById(e.sourceId.replace(/-\d+$/, "")) : undefined;
      if (src && src.source !== "gibs" && src.group === "background" && ++errors.current >= OFFLINE_AFTER_ERRORS) onOffline(true);
    });
    map.on("click", (e: MapMouseEvent) => {
      if (!map.getLayer("fires")) return;
      const f = map.queryRenderedFeatures(e.point, { layers: ["fires"] })[0];
      if (f?.properties?.id) setSelectedFocus(String(f.properties.id));
    });
    map.on("mousemove", (e: MapMouseEvent) => {
      const hit = !!map.getLayer("fires") && map.queryRenderedFeatures(e.point, { layers: ["fires"] }).length > 0;
      map.getCanvas().style.cursor = hit ? "pointer" : "";
    });
    mapRef.current = map;
    onMap(map);
    return () => {
      map.remove();
      mapRef.current = null;
      onMap(null);
    };
    // El mapa se crea una sola vez; los cambios de estilo se aplican en el efecto siguiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setStyle(style, { diff: true });
  }, [style]);

  return (
    <div className="absolute inset-0">
      <div ref={ref} className="h-full w-full" role="region" aria-label="Mapa de focos de calor. Usa «Ver focos como lista» para una alternativa en texto." />
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Skeleton className="h-24 w-64" label="Cargando mapa…" />
        </div>
      )}
    </div>
  );
}
