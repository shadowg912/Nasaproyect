"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AiChat } from "@/components/AiChat";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isMap = pathname === "/global" || pathname === "/local" || pathname === "/rd";

  return (
    <div className={isHome ? "home-shell" : undefined}>
      <a className="skip-link sr-only-focusable" href="#contenido">Saltar al contenido</a>
      <TopBar />
      <main
        id="contenido"
        tabIndex={-1}
        className={isMap ? "min-h-screen" : "mx-auto min-h-screen max-w-7xl px-4 pb-12 pt-[calc(var(--topbar-h)+2rem)]"}
      >
        {children}
      </main>
      {!isMap && (
        <footer className="mx-auto max-w-7xl px-4 pb-24 text-xs leading-relaxed text-[var(--color-text)]/75">
          Datos e imágenes: NASA. Proyecto independiente; no es un sitio oficial de la NASA. Las detecciones satelitales
          son indicativas y no sustituyen la información oficial de los organismos de emergencia.
        </footer>
      )}
      <AiChat />
    </div>
  );
}
