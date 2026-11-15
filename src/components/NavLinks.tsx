"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Panel" },
  { href: "/historico", label: "Histórico" },
  { href: "/aprende", label: "Aprende" },
  { href: "/estado", label: "Estado" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="order-3 flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:w-auto" aria-label="Principal">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-1.5 ${path === l.href ? "bg-fuego-100 font-semibold text-fuego-700" : "text-stone-600 hover:bg-stone-100"}`}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
