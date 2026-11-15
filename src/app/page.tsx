import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { detectBasemap } from "@/server/basemap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function Home() {
  return (
    <Suspense>
      <Dashboard basemap={detectBasemap()} />
    </Suspense>
  );
}
