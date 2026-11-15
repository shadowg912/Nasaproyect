import Link from "next/link";

export default function Home() {
  return <div className="space-y-10 py-8">
    <section className="atlas-hero"><p className="eyebrow">Un territorio, muchas historias de fuego</p><h1>Entender el fuego.<br /><em>Ver el cambio.</em></h1><p className="max-w-2xl text-lg">Explora los puntos de calor que observan los satélites. Compara temporadas con un calendario que ajusta las diferencias entre sensores. Acércate a un lugar para conocer su contexto.</p></section>
    <div className="grid gap-5 md:grid-cols-2">
      <Link href="/global" className="atlas-choice"><span className="eyebrow">Atlas global</span><h2>Explorar el mundo ↗</h2><p>Elige un país o delimita tu propia área. Descubre cuándo se concentra la actividad de fuego.</p></Link>
      <Link href="/rd" className="atlas-choice atlas-choice-rd"><span className="eyebrow">Nuestra isla, en detalle</span><h2>Incendios en RD ↗</h2><p>Consulta provincias y municipios, detecciones recientes y el calendario histórico dominicano.</p></Link>
    </div><p className="text-sm text-stone-600">Un foco de calor es un punto que el satélite observa más caliente que su entorno; por sí solo no confirma un incendio. <Link className="underline" href="/aprende">Aprende a interpretar el mapa</Link>.</p>
  </div>;
}
