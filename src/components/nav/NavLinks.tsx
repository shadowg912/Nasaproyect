"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MAP_LINKS = [
  { href: "/global", label: "Global" },
  { href: "/local", label: "Local" },
];

/** Selector compacto de los dos ámbitos cartográficos principales. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Ámbito del mapa" className="flex rounded-[var(--radius-sm)] border border-white/20 p-0.5">
      {MAP_LINKS.map((link) => {
        const active = pathname === link.href || (link.href === "/local" && pathname === "/rd");
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              active ? "bg-white text-[var(--color-brand-900)]" : "text-[var(--color-ink-muted)] hover:bg-white/10 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
