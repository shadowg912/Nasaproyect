// Copia el worker de MapLibre a public/vendor para servirlo localmente (sin CDN).
import fs from "node:fs";
fs.mkdirSync("public/vendor", { recursive: true });
fs.copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre-gl-worker.mjs");
