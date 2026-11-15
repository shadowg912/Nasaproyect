"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SyncStatus } from "@/lib/types";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { Skeleton } from "@/components/ui/Skeleton";

export const STATE_INFO: Record<SyncStatus["state"], { label: string; color: string; desc: string }> = {
  fresh: { label: "Datos actualizados", color: "bg-emerald-500", desc: "La última sincronización con NASA FIRMS es reciente." },
  stored: { label: "Datos almacenados localmente", color: "bg-sky-500", desc: "Se muestran datos guardados; la última sincronización no es reciente." },
  offline: { label: "Sin conexión con NASA", color: "bg-amber-500", desc: "El último intento de sincronización no pudo conectar con NASA FIRMS. Se muestran los datos locales." },
  never: { label: "Nunca sincronizado", color: "bg-stone-400", desc: "Aún no se ha descargado ningún dato. Ejecute npm run sync:firms." },
};

/** Evento global para que todos los indicadores se actualicen tras una sincronización. */
export const STATUS_EVENT = "fuego:status-changed";
export const notifyStatusChanged = () => window.dispatchEvent(new Event(STATUS_EVENT));

export function useStatus(intervalMs = 60_000) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/status", { cache: "no-store" })
        .then((r) => r.json())
        .then((s: SyncStatus) => alive && setStatus(s))
        .catch(() => {});
    load();
    const t = setInterval(load, intervalMs);
    window.addEventListener(STATUS_EVENT, load);
    return () => ((alive = false), clearInterval(t), window.removeEventListener(STATUS_EVENT, load));
  }, [intervalMs, tick]);
  return { status, refresh: () => setTick((x) => x + 1) };
}

export function StatusIndicator() {
  const { status } = useStatus();
  if (!status) return <Skeleton className="h-8 w-32" label="Cargando estado de datos…" />;
  const info = STATE_INFO[status.state];
  return (
    <Link
      href="/avanzado/estado"
      data-testid="sync-status"
      data-state={status.state}
      title={`${info.desc}${status.lastErrorMessage ? `\nÚltimo error: ${status.lastErrorMessage}` : ""}`}
      className="flex min-h-9 items-center gap-2 rounded-full border border-[var(--color-brand-500)]/30 bg-white px-3 py-1 text-xs text-[var(--color-text)] hover:bg-[var(--color-brand-50)]"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${info.color} ${status.running ? "animate-pulse" : ""}`} />
      <span className="font-medium">{status.running ? "Sincronizando…" : info.label}</span>
      <span className="hidden text-stone-500 sm:inline">
        · Última sincronización: {status.lastSuccessAt ? <time dateTime={status.lastSuccessAt} title={fmtDateTime(status.lastSuccessAt)}>{fmtRelative(status.lastSuccessAt)}</time> : "nunca"}
      </span>
    </Link>
  );
}
