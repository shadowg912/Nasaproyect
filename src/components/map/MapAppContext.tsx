"use client";
import { createContext, useContext } from "react";
import type { MapAppValue } from "@/lib/map/types";

/** Contexto del mapa: lo provee `MapApp` (Parte A) y lo consumen barra, herramientas y paneles (Parte B). */
export const MapAppContext = createContext<MapAppValue | null>(null);

export function useMapApp(): MapAppValue {
  const v = useContext(MapAppContext);
  if (!v) throw new Error("useMapApp debe usarse dentro de <MapApp>");
  return v;
}
