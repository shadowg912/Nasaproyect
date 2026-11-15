/**
 * Genera public/data/globe-fires.json (focos de los últimos 7 días agregados a celdas de 1°) para el globo de la portada,
 * a partir de la descarga global más reciente de FIRMS en data/raw/firms-global-7d/<fecha>/.
 * Uso: npm run globe:prepare
 */
import fs from "node:fs";
import path from "node:path";
import { aggregateGlobeFires } from "@/server/globe";

const root = "data/raw/firms-global-7d";
const latest = fs.existsSync(root) ? fs.readdirSync(root).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1) : undefined;
if (!latest) {
  console.error(`No hay descargas en ${root}. Descargue los CSV globales de 7 días de FIRMS primero.`);
  process.exit(1);
}
const dir = path.join(root, latest);
const texts = fs.readdirSync(dir).filter((f) => f.endsWith(".csv")).map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
const dates = texts.flatMap((t) => t.split(/\r?\n/).slice(1).map((l) => l.split(",")[5]).filter(Boolean)).sort();
const cells = aggregateGlobeFires(texts);
fs.mkdirSync("public/data", { recursive: true });
fs.writeFileSync(
  "public/data/globe-fires.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), dateFrom: dates[0] ?? null, dateTo: dates.at(-1) ?? null, cells }),
);
console.log(`globe-fires.json: ${cells.length} celdas, ${dates[0]} → ${dates.at(-1)}`);
