"use client";

import { DetectionDetail } from "@/components/DetectionDetail";
import { useMapApp } from "./MapAppContext";

export function FocusPanel() {
  const { selectedFocus, setSelectedFocus } = useMapApp();
  return <DetectionDetail id={selectedFocus} onClose={() => setSelectedFocus(null)} />;
}
