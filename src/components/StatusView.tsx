"use client";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { fmtDateTime, fmtNumber, fmtRelative } from "@/lib/format";
import { notifyStatusChanged, STATE_INFO, useStatus } from "./StatusIndicator";
import { Button } from "./ui/Button";
import { Skeleton, SkeletonLines } from "./ui/Skeleton";

interface Run {
  id: number; kind: string; trigger: string; status: string; sources: string; dateFrom: string | null; dateTo: string | null;
  startedAt: string; finishedAt: string | null; requests: number; rowsFetched: number; rowsInCountry: number;
  rowsInserted: number; rowsUpdated: number; rowsRejected: number; errorType: string | null; errorMessage: string | null;
}

const KIND: Record<string, string> = { sync: "API de área", public_feed: "Feed público 7 días", history: "Historial" };
const STATUS: Record<string, string> = { success: "Correcta", partial: "Parcial", failed: "Fallida", running: "En curso" };
const ERR: Record<string, string> = {
  network: "Sin conexión", auth: "MAP_KEY inválida", rate_limit: "Límite de transacciones", invalid_response: "Respuesta inválida",
  server: "Error del servidor NASA", config: "Configuración", other: "Otro",
};

export function StatusView() {
  const { status, refresh } = useStatus(15_000);
  const [tick, setTick] = useState(0);
  const { data: runs } = useApi<Run[]>("/api/runs", `${tick}-${status?.lastAttemptAt}`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function syncNow() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/sync", { method: "POST" });
      const d = await r.json();
      if (d.status === "cooldown" || d.status === "locked") setMsg(d.message ?? "Ya hay una sincronización en curso.");
      else if (d.status === "failed") setMsg(`No se pudo sincronizar: ${d.errors?.[0]?.message ?? "error"}. Los datos locales se conservan.`);
      else setMsg(`Sincronización ${d.status === "partial" ? "parcial" : "correcta"}: ${d.rowsInserted} detecciones nuevas${d.rowsInserted === 0 ? " (la conexión funcionó; no hay fuegos nuevos)" : ""}.`);
    } catch {
      setMsg("No se pudo contactar al servidor local.");
    } finally {
      setBusy(false);
      refresh();
      notifyStatusChanged();
      setTick((t) => t + 1);
    }
  }

  const info = status ? STATE_INFO[status.state] : null;
  return (
    <article className="space-y-6 rounded-[var(--radius-lg)] bg-[var(--color-brand-50)] p-4 sm:p-7">
      <header className="max-w-3xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand-700)]">Avanzado</p>
        <h1 className="text-3xl font-black tracking-tight text-[var(--color-brand-900)]">Estado de los datos</h1>
        <p className="mt-2 text-[var(--color-text)]">Consulta la actualización local, el origen de la descarga y las ejecuciones recientes.</p>
      </header>
      {!status && <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-56 md:col-span-2" /><Skeleton className="h-56" /></div>}
      {status && info && (
        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-[var(--radius-md)] bg-white p-5 shadow-[var(--shadow-float)] md:col-span-2">
            <div className="flex items-center gap-2 text-lg font-bold text-[var(--color-brand-900)]" data-testid="status-label">
              <span className={`h-3 w-3 rounded-full ${info.color}`} /> {info.label}
            </div>
            <p className="mt-1 text-sm text-stone-600">{info.desc}</p>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <dt className="text-stone-500">Última sincronización correcta</dt>
              <dd data-testid="last-sync">{status.lastSuccessAt ? `${fmtDateTime(status.lastSuccessAt)} (${fmtRelative(status.lastSuccessAt)})` : "Nunca"}</dd>
              <dt className="text-stone-500">Último intento</dt>
              <dd>{status.lastAttemptAt ? `${fmtDateTime(status.lastAttemptAt)} — ${STATUS[status.lastAttemptStatus ?? ""] ?? status.lastAttemptStatus}` : "—"}</dd>
              {status.lastErrorMessage && (<><dt className="text-stone-500">Último error</dt><dd className="text-amber-800">{status.lastErrorMessage}</dd></>)}
              <dt className="text-stone-500">Detecciones almacenadas</dt><dd>{fmtNumber(status.totalDetections)}</dd>
              <dt className="text-stone-500">Rango de datos locales</dt><dd>{status.firstDetectionDate ?? "—"} → {status.latestDetectionAt?.slice(0, 10) ?? "—"}</dd>
              <dt className="text-stone-500">Fuente de sincronización</dt>
              <dd>{status.hasMapKey ? "API de área de NASA FIRMS (MAP_KEY configurada)" : "Feed público de FIRMS, últimos 7 días (sin MAP_KEY)"}</dd>
            </dl>
          </section>
          <aside className="space-y-3 rounded-[var(--radius-md)] bg-[var(--color-brand-900)] p-5 text-white shadow-[var(--shadow-float)]">
            <Button variant="glass" className="w-full" disabled={busy || status.running} onClick={syncNow}>
              {busy || status.running ? "Sincronizando…" : "Sincronizar ahora"}
            </Button>
            {msg && <p className="text-sm" role="status">{msg}</p>}
            <p className="text-xs text-[var(--color-ink-muted)]">
              También desde la terminal: <code>npm run sync:firms</code>. Para sincronización periódica: <code>npm run sync:watch</code> o
              el planificador del sistema (ver README).
            </p>
            {!status.hasMapKey && (
              <p className="rounded-[var(--radius-sm)] bg-white/10 p-3 text-xs text-[var(--color-ink-muted)]">
                Sin <code>FIRMS_MAP_KEY</code> solo se descargan los últimos 7 días y no es posible importar historial. Solicite una clave
                gratuita en firms.modaps.eosdis.nasa.gov/api/map_key y agréguela a <code>.env</code>.
              </p>
            )}
          </aside>
        </div>
      )}
      <section className="overflow-x-auto rounded-[var(--radius-md)] bg-white p-5 shadow-[var(--shadow-float)]">
        <h2 className="text-lg font-bold text-[var(--color-brand-900)]">Ejecuciones recientes</h2>
        {!runs && <div className="mt-4"><SkeletonLines /></div>}
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="text-xs text-stone-500">
            <tr><th>Inicio</th><th>Tipo</th><th>Resultado</th><th>Periodo</th><th className="text-right">Filas</th><th className="text-right">En RD</th><th className="text-right">Nuevas</th><th className="text-right">Actualiz.</th><th>Error</th></tr>
          </thead>
          <tbody>
            {runs?.map((r) => (
              <tr key={r.id} className="border-t border-stone-100 align-top">
                <td className="py-1 whitespace-nowrap">{fmtDateTime(r.startedAt)}</td>
                <td>{KIND[r.kind] ?? r.kind}<div className="text-xs text-stone-400">{r.trigger}</div></td>
                <td className={r.status === "failed" ? "text-red-700" : r.status === "partial" ? "text-amber-700" : "text-emerald-700"}>{STATUS[r.status] ?? r.status}</td>
                <td className="whitespace-nowrap text-xs">{r.dateFrom ?? "—"} → {r.dateTo ?? "—"}</td>
                <td className="text-right tabular-nums">{fmtNumber(r.rowsFetched)}</td>
                <td className="text-right tabular-nums">{fmtNumber(r.rowsInCountry)}</td>
                <td className="text-right tabular-nums">{fmtNumber(r.rowsInserted)}</td>
                <td className="text-right tabular-nums">{fmtNumber(r.rowsUpdated)}</td>
                <td className="max-w-[16rem] text-xs text-stone-600">{r.errorType ? `${ERR[r.errorType] ?? r.errorType}: ${r.errorMessage ?? ""}` : ""}</td>
              </tr>
            ))}
            {runs && !runs.length && <tr><td colSpan={9} className="py-4 text-center text-stone-400">Aún no hay ejecuciones.</td></tr>}
          </tbody>
        </table>
      </section>
    </article>
  );
}
