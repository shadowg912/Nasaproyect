/** Utilidades sin DOM ni MapLibre: se prueban y reutilizan desde las herramientas del mapa. */
const compactNumber = (value: number, decimals = 1) => {
  const rounded = Number(value.toFixed(decimals));
  return String(rounded).replace(".", ",");
};

export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "—";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${compactNumber(km)} km`;
}

export function formatArea(km2: number): string {
  if (!Number.isFinite(km2) || km2 < 0) return "—";
  return km2 < 1 ? `${compactNumber(km2 * 100)} ha` : `${compactNumber(km2)} km²`;
}

/** Devuelve [longitud, latitud] para entradas «lat, lon», «lat lon» y decimales con coma. */
export function parseCoordinates(text: string): [number, number] | null {
  const values = text.match(/[-+]?\d+(?:[.,]\d+)?/g);
  if (!values || values.length !== 2) return null;
  const [lat, lon] = values.map((value) => Number(value.replace(",", ".")));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lon, lat];
}

const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es");

/** Coincidencias locales: prefijo primero, luego contenido; conserva el orden de la fuente en empates. */
export function searchPlaces<T extends { name: string }>(query: string, places: readonly T[]): T[] {
  const needle = normalize(query.trim());
  if (!needle) return [];
  return places
    .map((place, index) => ({ place, index, name: normalize(place.name) }))
    .filter(({ name }) => name.includes(needle))
    .sort((a, b) => {
      const rank = (name: string) => name.startsWith(needle) ? 0 : 1;
      return rank(a.name) - rank(b.name) || a.index - b.index;
    })
    .slice(0, 8)
    .map(({ place }) => place);
}
