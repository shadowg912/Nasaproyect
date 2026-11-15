/** Marcador de carga. Anuncia «Cargando…» a lectores de pantalla una sola vez por bloque. */
export function Skeleton({ className = "h-4 w-full", label = "Cargando…" }: { className?: string; label?: string }) {
  return (
    <div role="status" aria-busy="true" className={`ui-skeleton ${className}`}>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Varias líneas de esqueleto para listas y paneles. */
export function SkeletonLines({ lines = 4, label }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-2">
      <span className="sr-only">{label ?? "Cargando…"}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} aria-hidden="true" className="ui-skeleton h-4" style={{ width: `${90 - ((i * 17) % 35)}%` }} />
      ))}
    </div>
  );
}
