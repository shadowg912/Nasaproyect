"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { parseCoordinates } from "@/lib/map/tools";
import { useMapApp } from "../MapAppContext";

export function LocationTool() {
  const { map, setState, setOpenTool } = useMapApp();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const move = (coords: [number, number]) => {
    map?.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 7) });
    setState({ center: coords });
  };
  const submit = () => {
    const coords = parseCoordinates(query);
    if (!coords) return setMessage("No encontrado. Escribe coordenadas como «18.5, -70.2».");
    move(coords);
    setMessage("Ubicación centrada en el mapa.");
  };
  return <div className="fixed left-3 top-[calc(var(--topbar-h)+1.5rem)] z-40 w-[min(22rem,calc(100vw-1.5rem))]"><Panel id="location-tool" title="Ubicación" onClose={() => setOpenTool(null)}><label className="block text-sm font-semibold" htmlFor="map-location">Coordenadas</label><div className="mt-2 flex gap-2"><input id="map-location" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder="18.5, -70.2" className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-[var(--color-ink-muted)]" /><Button variant="glass" onClick={submit}>Ir</Button></div><Button variant="glass" className="mt-3" icon="locate" onClick={() => navigator.geolocation?.getCurrentPosition((position) => move([position.coords.longitude, position.coords.latitude]), () => setMessage("No se pudo obtener tu ubicación."))}>Mi ubicación</Button>{message && <p className="mt-3 text-sm text-[var(--color-ink-muted)]" role="status">{message}</p>}</Panel></div>;
}
