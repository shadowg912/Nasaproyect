"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { useMapApp } from "../MapAppContext";

export function ShareTool() {
  const { setOpenTool } = useMapApp();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(location.href);
    setCopied(true);
  };
  return <div className="fixed left-3 top-[calc(var(--topbar-h)+1.5rem)] z-40 w-[min(22rem,calc(100vw-1.5rem))]"><Panel id="share-tool" title="Compartir" onClose={() => setOpenTool(null)}><p className="text-sm text-[var(--color-ink-muted)]">El enlace conserva la vista, fecha y capas elegidas.</p><Button variant="glass" className="mt-4" icon="share" onClick={() => void copy()}>{copied ? "Enlace copiado" : "Copiar enlace"}</Button></Panel></div>;
}
