"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { NavLinks } from "./NavLinks";

const ADVANCED_LINKS = [
  { href: "/avanzado/estado", label: "Estado de los datos", description: "Actualización y calidad" },
  { href: "/metodologia", label: "Metodología", description: "Cómo se comparan sensores" },
  { href: "/historico", label: "Histórico", description: "Tendencias y cobertura" },
  { href: "/aprende", label: "Aprende", description: "Guía para interpretar focos" },
  { href: "/creditos", label: "Créditos", description: "Datos, imágenes y licencias" },
];

/** Barra compacta: los destinos poco frecuentes quedan en un único menú accesible. */
export function TopBar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function closeMenu(returnFocus = false) {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => buttonRef.current?.focus());
  }

  return (
    <header className="fixed inset-x-3 top-3 z-50 mx-auto max-w-7xl" aria-label="Cabecera principal">
      <div className="glass flex h-[var(--topbar-h)] items-center justify-between gap-2 px-3 sm:px-4">
        <Link href="/" className="flex min-h-9 items-center gap-2 rounded-md pr-1 font-bold text-white hover:text-[var(--color-ink-muted)]">
          <span aria-hidden className="brand-mark !grid !h-7 !w-7 place-items-center text-sm">S</span>
          <span className="hidden sm:inline">Satflame</span>
          <span className="sr-only sm:hidden">Inicio de Satflame</span>
        </Link>

        <NavLinks />

        <div className="relative" ref={menuRef}>
          <button
            ref={buttonRef}
            type="button"
            className="ui-btn ui-btn-glass min-h-9"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls="advanced-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name="menu" size={18} />
            <span>Avanzado</span>
            <Icon name="chevron" size={15} className={open ? "rotate-90 transition-transform" : "transition-transform"} />
          </button>
          {open && (
            <div
              id="advanced-menu"
              role="menu"
              aria-label="Opciones avanzadas"
              className="glass absolute right-0 top-[calc(100%+0.5rem)] w-72 overflow-hidden p-1"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeMenu(true);
                }
              }}
            >
              {ADVANCED_LINKS.map((link) => (
                <Link
                  key={link.href}
                  role="menuitem"
                  href={link.href}
                  className="block rounded-[var(--radius-sm)] px-3 py-2.5 text-sm hover:bg-white/10 focus:bg-white/10"
                  onClick={() => closeMenu()}
                >
                  <span className="block font-semibold text-white">{link.label}</span>
                  <span className="block text-xs text-[var(--color-ink-muted)]">{link.description}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
