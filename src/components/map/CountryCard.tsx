"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import type { CountryInfo, LoadJob } from "@/lib/types";
import { useMapApp } from "./MapAppContext";

export function CountryCard() {
  const { state, setHistoryOpen } = useMapApp();
  const [country, setCountry] = useState<CountryInfo | null>(null);
  const [job, setJob] = useState<LoadJob | null>(null);
  useEffect(() => {
    if (state.mode !== "global" || !state.iso3) return;
    fetch("/api/countries").then((response) => response.json()).then((items: CountryInfo[]) => setCountry(items.find((item) => item.iso3 === state.iso3) ?? null)).catch(() => setCountry(null));
  }, [state.mode, state.iso3]);
  useEffect(() => {
    if (!job || job.state === "done" || job.state === "error") return;
    const timer = window.setInterval(() => fetch("/api/countries/" + state.iso3 + "/load").then((response) => response.json()).then(setJob).catch(() => undefined), 2000);
    return () => window.clearInterval(timer);
  }, [job, state.iso3]);
  if (state.mode !== "global" || !country) return null;
  const load = async () => {
    const response = await fetch("/api/countries/" + state.iso3 + "/load", { method: "POST" });
    const data = await response.json() as { jobId: string };
    setJob({ jobId: data.jobId, iso3: state.iso3, state: "queued", done: 0, total: 0, error: null });
  };
  return <div className="fixed right-3 top-[calc(var(--topbar-h)+1.5rem)] z-40 w-[min(22rem,calc(100vw-1.5rem))]"><Panel id="country-card" title={country.name} autoFocus={false}><p className="text-sm text-[var(--color-ink-muted)]">{country.loaded ? "Historial disponible localmente." : "El historial aún no está descargado para este país."}</p>{job && <p className="mt-3 text-sm text-[var(--color-ink-muted)]" role="status">Carga: {job.total ? Math.round(job.done / job.total * 100) : 0}%</p>}<div className="mt-4 flex gap-2">{country.loaded ? <Button variant="glass" icon="history" onClick={() => setHistoryOpen(true)}>Historia</Button> : <Button variant="glass" onClick={() => void load()}>Cargar historial</Button>}</div></Panel></div>;
}
