"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import { geojsonStyle, pmtilesStyle } from "@/lib/mapStyle";
import { CONFIDENCE_COLOR, fmtDateTime, fmtNumber } from "@/lib/format";
import { CONFIDENCE_LABEL, SATELLITE_LABEL, type Confidence } from "@/lib/types";

let protocolAdded = false;

export interface FireMapProps {
  fires: GeoJSON.FeatureCollection | null;
  provinceCounts?: { id: number | null; count: number }[];
  selectedProvince?: number;
  onSelectProvince?: (id: number | undefined) => void;
  basemap: "pmtiles" | "geojson";
  height?: string;
}

const RD_BOUNDS: [[number, number], [number, number]] = [[-72.05, 17.45], [-68.3, 19.95]];

function escapeHtml(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export default function FireMap({ fires, provinceCounts, selectedProvince, onSelectProvince, basemap, height = "28rem" }: FireMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"points" | "heat" | "provinces">("points");
  const onSelectRef = useRef(onSelectProvince);
  onSelectRef.current = onSelectProvince;

  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl(`${window.location.origin}/vendor/maplibre-gl-worker.mjs`);
    if (basemap === "pmtiles" && !protocolAdded) {
      maplibregl.addProtocol("pmtiles", new Protocol().tile);
      protocolAdded = true;
    }
    const origin = window.location.origin;
    const map = new maplibregl.Map({
      container: container.current,
      style: basemap === "pmtiles" ? pmtilesStyle(origin) : geojsonStyle(origin),
      bounds: RD_BOUNDS,
      maxBounds: [[-74.5, 16.5], [-66.5, 21]],
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("load", () => setReady(true));

    map.on("click", "fires", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as Record<string, string>;
      const conf = p.confidence as Confidence;
      new maplibregl.Popup({ maxWidth: "260px" })
        .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(
          `<div class="text-sm space-y-0.5">
            <div class="font-semibold">${escapeHtml(p.municipality ?? "Municipio desconocido")}, ${escapeHtml(p.province ?? "")}</div>
            <div>${escapeHtml(fmtDateTime(p.acquiredAt))}</div>
            <div>Confianza: <b style="color:${CONFIDENCE_COLOR[conf] ?? "#000"}">${escapeHtml(CONFIDENCE_LABEL[conf] ?? conf)}</b></div>
            <div>FRP: ${p.frp != null && p.frp !== "null" ? `${fmtNumber(Number(p.frp), 1)} MW` : "—"}</div>
            <div class="text-stone-500">${escapeHtml(SATELLITE_LABEL[p.satellite] ?? p.satellite)} · ${escapeHtml(p.source)}</div>
          </div>`,
        )
        .addTo(map);
    });
    map.on("click", "province-fill", (e) => {
      if (map.queryRenderedFeatures(e.point, { layers: ["fires"] }).length) return;
      const id = e.features?.[0]?.properties?.id as number | undefined;
      onSelectRef.current?.(id);
    });
    for (const layer of ["fires", "province-fill"]) {
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }
    // El contenedor puede cambiar de tamaño tras la carga (CSS, diseño responsive).
    let fitted = false;
    const ro = new ResizeObserver(() => {
      map.resize();
      if (!fitted && container.current && container.current.clientWidth > 200) {
        map.fitBounds(RD_BOUNDS, { padding: 10, animate: false });
        fitted = true;
      }
    });
    ro.observe(container.current);
    mapRef.current = map;
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !fires) return;
    (map.getSource("fires") as GeoJSONSource).setData(fires);
  }, [fires, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.removeFeatureState({ source: "provinces" });
    for (const p of provinceCounts ?? []) {
      if (p.id != null) map.setFeatureState({ source: "provinces", id: p.id }, { count: p.count, choropleth: mode === "provinces" });
    }
    if (mode === "provinces") {
      for (let id = 1; id <= 40; id++) map.setFeatureState({ source: "provinces", id }, { choropleth: true });
    }
    map.setLayoutProperty("fires", "visibility", mode === "points" ? "visible" : "none");
    map.setLayoutProperty("fires-heat", "visibility", mode === "heat" ? "visible" : "none");
  }, [provinceCounts, mode, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("province-selected", ["==", ["get", "id"], selectedProvince ?? -1]);
  }, [selectedProvince, ready]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-stone-200" style={{ height }}>
      <div ref={container} className="h-full w-full" data-testid="map" data-ready={ready ? "true" : "false"} aria-label="Mapa de detecciones de incendios" />
      <div className="absolute top-2 left-2 flex gap-1 rounded-lg bg-white/90 p-1 text-xs shadow" role="group" aria-label="Modo del mapa">
        {([["points", "Puntos"], ["heat", "Calor"], ["provinces", "Provincias"]] as const).map(([m, label]) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`rounded px-2 py-1 ${mode === m ? "bg-fuego-600 text-white" : "hover:bg-stone-100"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="absolute bottom-8 right-2 rounded-lg bg-white/90 p-2 text-xs shadow">
        {(["high", "nominal", "low"] as const).map((c) => (
          <div key={c} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CONFIDENCE_COLOR[c] }} />
            Confianza {CONFIDENCE_LABEL[c].toLowerCase()}
          </div>
        ))}
        <div className="mt-1 text-stone-500">Tamaño ∝ FRP</div>
      </div>
    </div>
  );
}
