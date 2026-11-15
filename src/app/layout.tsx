import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { StatusIndicator } from "@/components/StatusIndicator";
import { NavLinks } from "@/components/NavLinks";
import { AiChat } from "@/components/AiChat";

export const metadata: Metadata = {
  title: "Fuego RD — Monitoreo de incendios en República Dominicana",
  description: "Detecciones satelitales de incendios de NASA FIRMS para República Dominicana, procesadas localmente.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ea580c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-stone-900">
              <span aria-hidden className="brand-mark">F</span>
              <span>Fuego RD</span>
            </Link>
            <NavLinks />
            <StatusIndicator />
          </div>
        </header>
        <main id="contenido" tabIndex={-1} className="mx-auto max-w-[1500px] px-4 py-4">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-6 text-xs text-stone-500">
          Datos: NASA FIRMS, GIBS, POWER. Proyecto independiente; no es un sitio oficial de la NASA. Límites: geoBoundaries (CC BY 4.0) y Natural Earth (dominio público).
          Las detecciones satelitales son indicativas y no sustituyen la información oficial de los organismos de emergencia.
        </footer>
        <AiChat/>
      </body>
    </html>
  );
}
