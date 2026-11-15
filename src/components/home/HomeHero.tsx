"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";

const Globe = dynamic(() => import("./Globe"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-[var(--radius-lg)]" label="Cargando globo…" />,
});

export function HomeHero() {
  return (
    <section className="grid min-h-[calc(100svh-var(--topbar-h)-3rem)] items-center gap-8 py-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(25rem,1.1fr)] lg:py-10">
      <div className="relative z-10 order-2 lg:order-1">
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-brand-700)]">Observatorio de focos de calor</p>
        <h1 className="max-w-xl text-5xl font-black tracking-[-0.05em] text-[var(--color-brand-900)] sm:text-6xl">El fuego visto desde el espacio.</h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--color-text)]">Explora señales térmicas observadas por satélite y comprende sus límites antes de tomar decisiones.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/global" className="ui-btn ui-btn-primary min-h-12 px-6 text-base">Explorar el mundo <span aria-hidden>→</span></Link>
          <Link href="/local" className="ui-btn ui-btn-ghost min-h-12 px-6 text-base">Mi territorio <span aria-hidden>→</span></Link>
        </div>
        <p className="mt-7 text-sm text-[var(--color-text)]/75">Datos e imágenes: NASA. Un foco de calor es una observación, no una confirmación automática de incendio.</p>
      </div>
      <div className="order-1 h-[min(56vw,34rem)] min-h-80 lg:order-2 lg:h-[min(48vw,38rem)]"><Globe /></div>
    </section>
  );
}
