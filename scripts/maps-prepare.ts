/**
 * Prepara el mapa base LOCAL en public/maps/ (herramienta de desarrollo).
 *
 *   1. Descarga la CLI oficial `pmtiles` (protomaps/go-pmtiles) en .cache/.
 *   2. Extrae de la compilación diaria de Protomaps (datos OpenStreetMap) solo
 *      el recuadro de República Dominicana → public/maps/rd.pmtiles.
 *   3. Descarga glyphs (Noto Sans) y sprites del estilo → public/maps/fonts, sprites.
 *
 * Después de ejecutarlo, la app usa automáticamente el mapa base PMTiles; si no
 * se ejecuta, usa el mapa GeoJSON local. En ambos casos la app no realiza
 * solicitudes remotas en tiempo de ejecución.
 *
 * Uso: npm run maps:prepare [-- --maxzoom 13] [-- --build 20261114]
 * Licencias: datos © OpenStreetMap contributors (ODbL); Protomaps basemaps (BSD/CC0);
 *            fuentes Noto Sans (SIL OFL 1.1).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { maxzoom: { type: "string", default: "13" }, build: { type: "string" } } });
const CACHE = path.resolve(".cache/maps");
const OUT = path.resolve("public/maps");
const BBOX = "-72.1,17.35,-68.2,20.05";
const PMTILES_VERSION = "1.31.2";
const FONTS = ["Noto Sans Regular", "Noto Sans Medium", "Noto Sans Italic"];

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function pmtilesBinary(): Promise<string> {
  const platform = { linux: "Linux", darwin: "Darwin", win32: "Windows" }[os.platform() as string];
  const arch = { x64: "x86_64", arm64: "arm64" }[os.arch() as string];
  if (!platform || !arch) throw new Error(`Plataforma no soportada: ${os.platform()}/${os.arch()}`);
  const exe = path.join(CACHE, os.platform() === "win32" ? "pmtiles.exe" : "pmtiles");
  if (fs.existsSync(exe)) return exe;
  const name =
    platform === "Linux" ? `go-pmtiles_${PMTILES_VERSION}_${platform}_${arch}.tar.gz` : `go-pmtiles${platform === "Darwin" ? "-" : "_"}${PMTILES_VERSION}_${platform}_${arch}.zip`;
  const archive = path.join(CACHE, name);
  console.log(`Descargando CLI pmtiles ${PMTILES_VERSION}…`);
  await download(`https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/${name}`, archive);
  execFileSync("tar", ["-xf", archive, "-C", CACHE], { stdio: "inherit" });
  fs.chmodSync(exe, 0o755);
  return exe;
}

async function latestBuild(): Promise<string> {
  if (values.build) return `${values.build}.pmtiles`;
  const builds = (await (await fetch("https://build-metadata.protomaps.dev/builds.json")).json()) as { key: string }[];
  return builds[builds.length - 1].key;
}

async function assets() {
  const tgz = path.join(CACHE, "basemaps-assets.tar.gz");
  console.log("Descargando fuentes y sprites (protomaps/basemaps-assets)…");
  await download("https://codeload.github.com/protomaps/basemaps-assets/tar.gz/refs/heads/main", tgz);
  const tmp = path.join(CACHE, "assets");
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  execFileSync("tar", ["-xzf", tgz, "-C", tmp, "--strip-components=1"], { stdio: "inherit" });
  for (const font of FONTS) {
    fs.cpSync(path.join(tmp, "fonts", font), path.join(OUT, "fonts", font), { recursive: true });
  }
  fs.mkdirSync(path.join(OUT, "sprites/v4"), { recursive: true });
  for (const f of fs.readdirSync(path.join(tmp, "sprites/v4")).filter((f) => f.startsWith("light"))) {
    fs.copyFileSync(path.join(tmp, "sprites/v4", f), path.join(OUT, "sprites/v4", f));
  }
}

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const bin = await pmtilesBinary();
  const build = await latestBuild();
  const target = path.join(OUT, "rd.pmtiles");
  console.log(`Extrayendo ${build} (bbox ${BBOX}, zoom ≤ ${values.maxzoom})…`);
  execFileSync(bin, ["extract", `https://build.protomaps.com/${build}`, target, `--bbox=${BBOX}`, `--maxzoom=${values.maxzoom}`], {
    stdio: "inherit",
  });
  await assets();
  fs.writeFileSync(
    path.join(OUT, "sources.json"),
    JSON.stringify(
      {
        basemap: { file: "rd.pmtiles", build, bbox: BBOX, maxzoom: Number(values.maxzoom), source: "Protomaps daily build", license: "ODbL (© OpenStreetMap contributors)" },
        fonts: { families: FONTS, license: "SIL Open Font License 1.1" },
        sprites: { source: "protomaps/basemaps-assets", license: "CC0 / BSD-3-Clause" },
        generated: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`Listo: ${(fs.statSync(target).size / 1e6).toFixed(1)} MB. Reinicie el servidor para usar el mapa base PMTiles.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
