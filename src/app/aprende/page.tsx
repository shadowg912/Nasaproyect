export const metadata = { title: "Aprende — Fuego RD" };

const concepts = [
  ["Foco de calor", "Un píxel que el satélite ve más caliente que su entorno. No equivale necesariamente a un incendio."],
  ["FRP", "La potencia radiativa emitida al momento de la observación, expresada en megavatios. No mide superficie quemada."],
  ["Anomalía", "Una comparación con lo habitual para ese mes: un valor mayor que uno indica más actividad que la mediana histórica."],
];

export default function LearnPage() {
  return (
    <article className="mx-auto max-w-5xl space-y-5 rounded-[var(--radius-lg)] bg-[var(--color-brand-50)] p-4 sm:p-7">
      <header className="max-w-3xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand-700)]">Guía de lectura</p>
        <h1 className="text-3xl font-black tracking-tight text-[var(--color-brand-900)]">¿Cómo se detectan los incendios desde el espacio?</h1>
        <p className="mt-3 text-lg leading-relaxed text-[var(--color-text)]">Los satélites observan anomalías térmicas. Esta guía ayuda a interpretarlas sin confundir una señal con una confirmación.</p>
      </header>

      <dl className="grid gap-4 md:grid-cols-3">
        {concepts.map(([term, definition]) => <div key={term} className="rounded-[var(--radius-md)] bg-white p-5 shadow-[var(--shadow-float)]"><dt className="text-lg font-bold text-[var(--color-brand-900)]">{term}</dt><dd className="mt-3 leading-relaxed text-[var(--color-text)]">{definition}</dd></div>)}
      </dl>

      <section className="rounded-[var(--radius-md)] bg-white p-5 shadow-[var(--shadow-float)]">
        <h2 className="text-xl font-bold text-[var(--color-brand-900)]">Satélites, confianza y límites</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 leading-relaxed text-[var(--color-text)]">
            <p>La aplicación usa anomalías térmicas de <b>VIIRS</b> a bordo de Suomi NPP, NOAA-20 y NOAA-21, publicadas por NASA FIRMS. Cada punto representa el centro de un píxel, no la ubicación exacta del fuego.</p>
            <p>Un píxel VIIRS cubre aproximadamente 375 × 375 metros. Un incendio grande puede generar puntos contiguos y un mismo foco puede aparecer en más de un paso satelital.</p>
            <p>Las detecciones nocturnas tienen menos interferencia solar; las diurnas pueden incluir más señales de baja confianza.</p>
          </div>
          <ul className="space-y-3 rounded-[var(--radius-sm)] bg-[var(--color-brand-50)] p-4 text-[var(--color-text)]">
            <li><b>Alta:</b> señal térmica muy fuerte.</li>
            <li><b>Nominal:</b> detección clara con contraste moderado.</li>
            <li><b>Baja:</b> señal débil o afectada por reflejos, superficies calientes o nubes.</li>
            <li><b>Nubes y humo:</b> pueden ocultar fuegos; la ausencia de puntos no garantiza que no haya incendio.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-[var(--radius-md)] bg-white p-5 shadow-[var(--shadow-float)]">
        <h2 className="text-xl font-bold text-[var(--color-brand-900)]">Tiempo casi real e histórico</h2>
        <p className="mt-3 leading-relaxed text-[var(--color-text)]">Los productos NRT se publican en pocas horas, pero cubren meses recientes. Para el historial se usan productos de procesamiento estándar, publicados con retraso. El calendario armonizado ayuda a comparar periodos en los que MODIS y VIIRS observaron con capacidades distintas.</p>
        <p className="mt-4 text-sm text-[var(--color-text)]/75">Las horas se almacenan en UTC y la interfaz las presenta en America/Santo_Domingo. Fuente científica: NASA FIRMS — LANCE / EOSDIS.</p>
      </section>
    </article>
  );
}
