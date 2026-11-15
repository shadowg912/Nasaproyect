import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { detectBasemap } from "@/server/basemap";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default function RdPage() {
  return <><div className="py-5"><p className="eyebrow">Observatorio dominicano</p><h1 className="text-3xl font-bold">Incendios en RD</h1><p>Del patrón histórico al punto de calor más reciente.</p></div><Suspense><Dashboard basemap={detectBasemap()} /></Suspense></>;
}
