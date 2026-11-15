export const metadata = { title: "Créditos y fuentes — Fuego RD" };

const sources = [
  ["NASA GIBS", "NASA EOSDIS", "Imágenes satelitales, fondos y overlays.", "Uso libre; citar a NASA."],
  ["NASA FIRMS", "NASA LANCE / FIRMS", "Focos de calor y productos de fuego activo.", "Uso libre; citar a NASA FIRMS."],
  ["NASA Visible Earth", "NASA", "Textura Blue Marble del globo.", "Dominio público."],
  ["NASA POWER", "NASA", "Contexto meteorológico cuando esté disponible.", "Uso libre; citar a NASA."],
  ["Esri World Imagery, Streets, Gray y Topographic", "Esri y colaboradores", "Fondos cartográficos opcionales.", "Términos de Esri, atribución obligatoria; no se almacenan en caché."],
  ["WDPA / Protected Planet", "UNEP-WCMC e IUCN", "Áreas protegidas.", "Uso no comercial con atribución, según términos de WDPA."],
  ["Global Volcanism Program", "Smithsonian Institution", "Volcanes holocenos.", "Uso con cita."],
  ["Natural Earth", "Natural Earth", "Límites administrativos de referencia.", "Dominio público."],
  ["geoBoundaries", "William & Mary / contribuidores", "Límites administrativos locales.", "CC BY 4.0."],
];

export default function CreditsPage() {
  return (
    <article className="mx-auto max-w-6xl rounded-[var(--radius-lg)] bg-[var(--color-brand-50)] p-4 sm:p-7">
      <header className="max-w-3xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand-700)]">Transparencia</p>
        <h1 className="text-3xl font-black tracking-tight text-[var(--color-brand-900)]">Créditos y fuentes</h1>
        <p className="mt-3 leading-relaxed text-[var(--color-text)]">Fuego RD es un proyecto independiente. Los datos e imágenes se atribuyen a sus proveedores; esta aplicación no es un sitio oficial de la NASA.</p>
      </header>
      <div className="mt-7 overflow-x-auto rounded-[var(--radius-md)] bg-white shadow-[var(--shadow-float)]">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <caption className="sr-only">Fuentes de datos, imágenes y cartografía</caption>
          <thead className="bg-[var(--color-brand-900)] text-white"><tr><th className="p-3">Fuente</th><th className="p-3">Proveedor</th><th className="p-3">Uso</th><th className="p-3">Condiciones</th></tr></thead>
          <tbody>{sources.map(([source, provider, use, terms]) => <tr key={source} className="border-b border-[var(--color-brand-50)] align-top text-[var(--color-text)]"><th scope="row" className="p-3 font-semibold">{source}</th><td className="p-3">{provider}</td><td className="p-3">{use}</td><td className="p-3">{terms}</td></tr>)}</tbody>
        </table>
      </div>
    </article>
  );
}
