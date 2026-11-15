"use client";

import { Panel } from "@/components/ui/Panel";
import { useMapApp } from "../MapAppContext";

/** La interacción de dibujo se conecta al canvas de MapLibre cuando MapApp está disponible. */
export function MeasureTool() {
  const { setOpenTool, setAoi } = useMapApp();
  return <div className="fixed left-3 top-[calc(var(--topbar-h)+1.5rem)] z-40 w-[min(22rem,calc(100vw-1.5rem))]"><Panel id="measure-tool" title="Medir" onClose={() => setOpenTool(null)}><p className="text-sm text-[var(--color-ink-muted)]">Haz clic en el mapa para dibujar una línea o un área. Pulsa Esc para terminar.</p><button type="button" className="ui-btn ui-btn-glass mt-4" onClick={() => setAoi(null)}>Borrar medida</button></Panel></div>;
}
