import { HomeHero } from "@/components/home/HomeHero";


export default function Home() {
  return (
    <div className="home-content space-y-16">
      <HomeHero />
      <section aria-labelledby="aprende-desde-portada" className="grid gap-5 pb-8 lg:grid-cols-3">
        <h2 id="aprende-desde-portada" className="sr-only">Claves para interpretar los datos</h2>
        {[
          ["Un foco no es un incendio", "El satélite detecta una anomalía térmica en un píxel. Puede ser fuego activo, una quema agrícola u otra fuente de calor."],
          ["MODIS y VIIRS no son equivalentes", "Sus sensores, resolución y horas de paso son distintos. Para comparar años, la aplicación muestra un calendario armonizado."],
          ["El calendario da contexto", "Mira los datos almacenados y su cobertura antes de concluir que un mes tuvo más o menos actividad."],
        ].map(([title, body]) => (
          <article key={title} className="home-explainer">
            <div className="p-5">
              <h3 className="text-xl font-bold text-white">{title}</h3>
              <p className="mt-3 leading-relaxed text-blue-100">{body}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
