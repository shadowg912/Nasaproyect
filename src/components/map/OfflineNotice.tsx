"use client";
import { Icon } from "@/components/ui/Icon";
import { useMapApp } from "./MapAppContext";

/** Aviso cuando los fondos de terceros no cargan y el mapa usa el fondo local. */
export function OfflineNotice() {
  const { offline } = useMapApp();
  if (!offline) return null;
  return (
    <p role="status" className="glass absolute left-1/2 top-[calc(var(--topbar-h)+0.75rem)] z-20 flex -translate-x-1/2 items-center gap-2 px-3 py-2 text-sm">
      <Icon name="warning" className="text-warn" /> Sin conexión con los mapas de fondo: se muestra el mapa local.
    </p>
  );
}
