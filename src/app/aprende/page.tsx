export const metadata = { title: "Aprende — Fuego RD" };

export default function Page() {
  return (
    <article className="prose-es mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">¿Cómo se detectan los incendios desde el espacio?</h1>
      <p className="mt-3">
        Esta aplicación muestra <b>anomalías térmicas</b> detectadas por satélites de órbita polar y publicadas por el sistema
        <b> FIRMS</b> (Fire Information for Resource Management System) de la NASA. Cada punto del mapa es un píxel donde el
        sensor registró una temperatura mucho mayor que la de su entorno, lo que normalmente indica fuego activo.
      </p>

      <h2>Los satélites y el sensor VIIRS</h2>
      <p>
        Usamos datos del instrumento <b>VIIRS</b> (Visible Infrared Imaging Radiometer Suite) a bordo de tres satélites:
        <b> Suomi NPP</b>, <b>NOAA-20</b> y <b>NOAA-21</b>. Cada uno pasa sobre República Dominicana aproximadamente dos veces al
        día (alrededor de la 1:30 p. m. y la 1:30 a. m., hora local), por lo que un mismo incendio puede aparecer varias veces.
      </p>
      <ul>
        <li>Resolución: cada píxel VIIRS cubre unos <b>375 × 375 metros</b>. El punto marca el centro del píxel, no la ubicación exacta del fuego.</li>
        <li>Un píxel puede contener uno o varios focos; un incendio grande genera muchos puntos contiguos.</li>
        <li>Las nubes densas, el humo espeso o el dosel del bosque pueden ocultar incendios.</li>
      </ul>

      <h2>¿Qué significa cada dato?</h2>
      <h3>Nivel de confianza</h3>
      <ul>
        <li><b>Alta:</b> la señal térmica es muy fuerte; casi seguro es fuego.</li>
        <li><b>Nominal:</b> detección clara con un contraste térmico moderado.</li>
        <li><b>Baja:</b> señal débil o afectada por reflejos solares, superficies calientes o bordes de nubes. Puede ser un falso positivo.</li>
      </ul>
      <h3>FRP — Potencia radiativa del fuego</h3>
      <p>
        Se mide en <b>megavatios (MW)</b> y estima la energía que emite el fuego en el momento de la observación. Valores más
        altos suelen corresponder a incendios más intensos o extensos.
      </p>
      <h3>Día y noche</h3>
      <p>Las detecciones nocturnas tienen menos interferencia solar; las diurnas pueden incluir más falsos positivos de baja confianza.</p>

      <h2>Tiempo casi real e histórico</h2>
      <p>
        Los productos <b>NRT</b> (Near Real-Time) se publican en pocas horas, pero solo están disponibles para los meses recientes.
        Para el historial se usan los productos de <b>procesamiento estándar (SP)</b>, más precisos y publicados con retraso.
        La aplicación evita contar dos veces el mismo día cuando ambos productos están descargados.
      </p>

      <h2>Limitaciones importantes</h2>
      <ul>
        <li>No todas las detecciones son incendios forestales: también aparecen quemas agrícolas, vertederos e industrias.</li>
        <li>La ausencia de puntos no garantiza que no haya fuego (nubes, horario del paso del satélite, fuegos pequeños).</li>
        <li>Las horas se registran en UTC por NASA; la interfaz las muestra en hora de República Dominicana (UTC−4).</li>
        <li>Los límites de provincias y municipios provienen de fuentes abiertas y pueden diferir ligeramente de los oficiales.</li>
      </ul>

      <h2>Incendios y temporada seca en RD</h2>
      <p>
        La mayor actividad suele concentrarse en la temporada seca (aproximadamente de enero a abril), especialmente en zonas de
        montaña como la Cordillera Central y la Sierra de Bahoruco, y en áreas agrícolas donde se practica la quema.
      </p>

      <h2>Si ve un incendio</h2>
      <ul>
        <li>Llame al <b>911</b> (Sistema Nacional de Atención a Emergencias y Seguridad).</li>
        <li>Informe al Ministerio de Medio Ambiente y Recursos Naturales o al cuerpo de bomberos más cercano.</li>
        <li>No intente apagar incendios grandes por su cuenta; aléjese en dirección contraria al viento.</li>
      </ul>
      <p className="mt-6 text-sm text-stone-500">
        Fuente científica: NASA FIRMS — LANCE / EOSDIS. Esta herramienta es informativa y no reemplaza los canales oficiales.
      </p>
    </article>
  );
}
