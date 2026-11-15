"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

/** Interfaz preparada para un proveedor futuro; no transmite mensajes ni requiere clave. */
export function AiChat() {
  const [open, setOpen] = useState(false);
  return (
    <aside className="fixed bottom-4 right-4 z-40" aria-label="Asistente IA">
      {open && (
        <Panel id="ai-panel" title="Asistente IA" onClose={() => setOpen(false)} className="absolute bottom-14 right-0 w-[min(24rem,calc(100vw-2rem))]">
          <div className="space-y-4 text-sm">
            <p className="text-[var(--color-ink-muted)]">Consulta cómo interpretar los focos, las capas y el historial.</p>
            <div className="rounded-[var(--radius-sm)] border border-white/15 bg-white/5 p-4">
              <p className="font-semibold text-white">Asistente IA: disponible cuando se configure la clave</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--color-ink-muted)]">Este panel no envía mensajes ni datos mientras el servicio no esté configurado.</p>
            </div>
          </div>
        </Panel>
      )}
      <IconButton label={open ? "Cerrar asistente IA" : "Abrir asistente IA"} icon="help" pressed={open} onClick={() => setOpen((value) => !value)} className="!h-12 !w-12 !rounded-full shadow-[var(--shadow-float)]" />
    </aside>
  );
}
