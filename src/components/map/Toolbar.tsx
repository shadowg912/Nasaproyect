"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { ToolId } from "@/lib/map/types";
import { useMapApp } from "./MapAppContext";
import { LocationTool } from "./tools/LocationTool";
import { MeasureTool } from "./tools/MeasureTool";
import { ShareTool } from "./tools/ShareTool";
import { HelpDialog } from "./tools/HelpDialog";

const actions: { id: ToolId; label: string; icon: IconName }[] = [
  { id: "measure", label: "Medir", icon: "ruler" },
  { id: "location", label: "Ubicación", icon: "pin" },
  { id: "layers", label: "Capas", icon: "layers" },
  { id: "timeline", label: "Línea de tiempo", icon: "timeline" },
  { id: "capture", label: "Capturar", icon: "camera" },
  { id: "share", label: "Compartir", icon: "share" },
  { id: "help", label: "Ayuda", icon: "help" },
  { id: "view", label: "Vista", icon: "globe" },
];

export function Toolbar() {
  const { openTool, setOpenTool, state, setState, map } = useMapApp();
  const [more, setMore] = useState(false);
  const active = (id: ToolId) => openTool === id;
  const select = (id: ToolId) => {
    if (id === "capture" && map) {
      const link = document.createElement("a");
      link.download = "satflame-" + state.date + ".png";
      link.href = map.getCanvas().toDataURL("image/png");
      link.click();
      return;
    }
    if (id === "view") {
      setState({ projection: state.projection === "globe" ? "mercator" : "globe" });
      return;
    }
    setOpenTool(active(id) ? null : id);
  };
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const shortcut: Record<string, ToolId> = { l: "layers", t: "timeline", m: "measure", "/": "location" };
      if (event.key === "Escape") setOpenTool(null);
      else if (shortcut[event.key.toLowerCase()]) {
        event.preventDefault();
        select(shortcut[event.key.toLowerCase()]);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });
  return (
    <>
      <div className="glass tool-bar fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 p-1.5" role="toolbar" aria-label="Herramientas del mapa">
        {actions.map((action, index) => (
          <button key={action.id} type="button" aria-label={action.label} aria-pressed={active(action.id)} title={action.label}
            className={`tool-btn ${index > 3 && !more ? "hidden sm:inline-flex" : ""}`} onClick={() => select(action.id)}>
            <Icon name={action.icon} size={22} />
            <span className="tool-label" aria-hidden="true">{action.label}</span>
          </button>
        ))}
        <button type="button" aria-label={more ? "Menos herramientas" : "Más herramientas"} aria-expanded={more} className="tool-btn sm:hidden"
          onClick={() => setMore((value) => !value)}>
          <Icon name="menu" size={22} />
          <span className="tool-label" aria-hidden="true">{more ? "Menos" : "Más"}</span>
        </button>
      </div>
      {openTool === "measure" && <MeasureTool />}
      {openTool === "location" && <LocationTool />}
      {openTool === "share" && <ShareTool />}
      {openTool === "help" && <HelpDialog />}
    </>
  );
}
