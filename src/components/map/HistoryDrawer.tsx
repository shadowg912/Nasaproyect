"use client";

import { Calendar } from "@/components/Calendar";
import { Panel } from "@/components/ui/Panel";
import { useMapApp } from "./MapAppContext";

export function HistoryDrawer() {
  const { historyOpen, setHistoryOpen, state, aoi, region } = useMapApp();
  if (!historyOpen) return null;
  return (
    <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-6xl">
      <Panel id="history-drawer" title="Historia armonizada" onClose={() => setHistoryOpen(false)} className="max-h-[min(70dvh,44rem)]">
        <Calendar region={{ iso3: state.mode === "local" ? "DOM" : state.iso3, ...region, ...(aoi ? { aoi } : {}) }} />
      </Panel>
    </div>
  );
}
