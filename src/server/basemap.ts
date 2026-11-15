import fs from "node:fs";
import path from "node:path";

/** Usa el mapa base PMTiles si fue preparado con `npm run maps:prepare`. */
export function detectBasemap(): "pmtiles" | "geojson" {
  const root = path.join(process.cwd(), "public", "maps");
  return fs.existsSync(path.join(root, "rd.pmtiles")) && fs.existsSync(path.join(root, "fonts")) && fs.existsSync(path.join(root, "sprites"))
    ? "pmtiles"
    : "geojson";
}
