"use client";

import { useMapApp } from "../MapAppContext";

export function CaptureTool() {
  const { map, state } = useMapApp();
  if (!map) return null;
  const capture = () => {
    const link = document.createElement("a");
    link.download = "satflame-" + state.date + ".png";
    link.href = map.getCanvas().toDataURL("image/png");
    link.click();
  };
  return <button type="button" className="sr-only" onClick={capture}>Guardar captura</button>;
}
