import { HomeHero } from "@/components/home/HomeHero";

const imagery = "/api/imagery?layer=MODIS_Terra_CorrectedReflectance_TrueColor&date=2023-03-15&bbox=18.25,-70.75,18.75,-70.25";

export default function Home() {
  return (
    <div className="space-y-16 bg-[var(--color-brand-50)]">
      <HomeHero />
      <section aria-labelledby="aprende-desde-portada" className="grid gap-5 pb-8 lg:grid-cols-3">
        <h2 id="aprende-desde-portada" className="sr-only">Claves para interpretar los datos</h2>
        {[
          ["Un foco no es un incendio", "El satélite detecta una anomalía térmica en un píxel. Puede ser fuego activo, una quema agrícola u otra fuente de calor."],
          ["MODIS y VIIRS no son equivalentes", "Sus sensores, resolución y horas de paso son distintos. Para comparar años, la aplicación muestra un calendario armonizado."],
          ["El calendario da contexto", "Mira los datos almacenados y su cobertura antes de concluir que un mes tuvo más o menos actividad."],
        ].map(([title, body]) => (
          <article key={title} className="overflow-hidden rounded-[var(--radius-md)] bg-white shadow-[var(--shadow-float)]">
            <img src={imagery} alt="Vista satelital de República Dominicana" className="h-40 w-full object-cover" />
            <div className="p-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand-700)]">Lectura responsable</p>
              <h3 className="text-xl font-bold text-[var(--color-brand-900)]">{title}</h3>
              <p className="mt-3 leading-relaxed text-[var(--color-text)]">{body}</p>
              <p className="mt-4 text-xs text-[var(--color-text)]/70">Imagen: NASA GIBS / MODIS Terra</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
