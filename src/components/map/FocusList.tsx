"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { useMapApp } from "./MapAppContext";

type Feature = { id: string; properties?: { acquiredAt?: string; satellite?: string; confidence?: string; province?: string } };

export function FocusList() {
  const { period, setSelectedFocus } = useMapApp();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Feature[] | null>(null);
  const show = async () => {
    setOpen(true);
    const response = await fetch("/api/detections?from=" + period.from + "&to=" + period.to);
    const data = await response.json() as { features?: Feature[] };
    setRows(data.features ?? []);
  };
  if (!open) return <Button variant="glass" icon="list" onClick={() => void show()}>Ver focos como lista</Button>;
  return <div className="fixed bottom-20 left-3 z-40 w-[min(38rem,calc(100vw-1.5rem))]"><Panel id="focus-list" title="Focos como lista" onClose={() => setOpen(false)}>{!rows ? <p role="status">Cargando focos…</p> : <div className="max-h-72 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Hora</th><th>Satélite</th><th>Confianza</th><th>Territorio</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-white/15 hover:bg-white/10" onClick={() => setSelectedFocus(row.id)}><td className="py-2">{row.properties?.acquiredAt ?? "—"}</td><td>{row.properties?.satellite ?? "—"}</td><td>{row.properties?.confidence ?? "—"}</td><td>{row.properties?.province ?? "—"}</td></tr>)}</tbody></table></div>}</Panel></div>;
}
