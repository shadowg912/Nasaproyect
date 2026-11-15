import Papa from "papaparse";

export interface GlobeCell {
  lat: number;
  lon: number;
  count: number;
}

/** Agrupa focos de CSV de FIRMS en celdas de `cellDeg` grados (centro de la celda) para el globo de la portada. */
export function aggregateGlobeFires(csvTexts: string[], cellDeg = 1): GlobeCell[] {
  const cells = new Map<string, GlobeCell>();
  for (const text of csvTexts) {
    const { data } = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
    for (const r of data) {
      const lat = Number(r.latitude);
      const lon = Number(r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const cLat = Math.floor(lat / cellDeg) * cellDeg + cellDeg / 2;
      const cLon = Math.floor(lon / cellDeg) * cellDeg + cellDeg / 2;
      const key = `${cLat}:${cLon}`;
      const cell = cells.get(key) ?? { lat: cLat, lon: cLon, count: 0 };
      cell.count++;
      cells.set(key, cell);
    }
  }
  return [...cells.values()];
}
