"use client";

import { Panel } from "@/components/ui/Panel";
import { useMapApp } from "../MapAppContext";

export function HelpDialog() {
  const { setOpenTool } = useMapApp();
  return <div className="fixed left-3 top-[calc(var(--topbar-h)+1.5rem)] z-40 w-[min(25rem,calc(100vw-1.5rem))]"><Panel id="help-tool" title="Ayuda" onClose={() => setOpenTool(null)}><ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--color-ink-muted)]"><li>Elige una capa o periodo en la barra inferior.</li><li>Toca un foco para ver su contexto.</li><li>Abre Historia para comparar el calendario armonizado.</li></ol><p className="mt-4 text-xs text-[var(--color-ink-muted)]">Atajos: L capas · T línea de tiempo · M medir · / ubicación · Esc cerrar.</p></Panel></div>;
}
