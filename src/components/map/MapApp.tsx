"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { decodeState, defaultState, encodeState, periodBounds } from "@/lib/map/state";
import type { Aoi, MapAppValue, MapMode, MapState, ToolId } from "@/lib/map/types";
import { CountryCard } from "./CountryCard";
import { FocusList } from "./FocusList";
import { FocusPanel } from "./FocusPanel";
import { HistoryDrawer } from "./HistoryDrawer";
import { LayerPanel } from "./LayerPanel";
import { MapAppContext } from "./MapAppContext";
import { MapView } from "./MapView";
import { OfflineNotice } from "./OfflineNotice";
import { Timeline } from "./Timeline";
import { Toolbar } from "./Toolbar";

const todayUtc = () => new Date().toISOString().slice(0, 10);

/** Aplicación de mapa a pantalla completa (Global o Local). El estado vive en la URL para poder compartirlo. */
export function MapApp({ mode }: { mode: MapMode }) {
  const [state, setFullState] = useState<MapState>(() => defaultState(mode, todayUtc()));
  const [ready, setReady] = useState(false);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [openTool, setOpenTool] = useState<ToolId | null>(null);
  const [offline, setOffline] = useState(false);
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null);
  const [aoi, setAoi] = useState<Aoi>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [region, setRegion] = useState<{ provinceId?: number; municipalityId?: number }>({});

  useEffect(() => {
    setFullState(decodeState(window.location.search, mode, todayUtc()));
    setReady(true);
  }, [mode]);

  useEffect(() => {
    if (ready) window.history.replaceState(null, "", `${window.location.pathname}?${encodeState(state)}`);
  }, [state, ready]);

  const setState = useCallback((patch: Partial<MapState>) => setFullState((s) => ({ ...s, ...patch })), []);
  const period = useMemo(() => periodBounds(state.date, state.range), [state.date, state.range]);

  const value: MapAppValue = {
    state, setState, map, openTool, setOpenTool, offline, period,
    selectedFocus, setSelectedFocus, aoi, setAoi, historyOpen, setHistoryOpen, region, setRegion,
  };

  return (
    <MapAppContext.Provider value={value}>
      <div className="fixed inset-0 overflow-hidden bg-brand-900" data-map-app={mode}>
        <h1 className="sr-only">{mode === "local" ? "Mapa de incendios de República Dominicana" : "Mapa mundial de incendios"}</h1>
        {ready && <MapView onMap={setMap} onOffline={setOffline} />}
        <LayerPanel />
        <OfflineNotice />
        {mode === "global" && <CountryCard />}
        <FocusPanel />
        <FocusList />
        <HistoryDrawer />
        <Toolbar />
        <Timeline />
      </div>
    </MapAppContext.Provider>
  );
}
