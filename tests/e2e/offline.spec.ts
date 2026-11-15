import { expect, test, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DB } from "../../playwright.config";
import { readFileSync } from "node:fs";
const calendar = JSON.parse(readFileSync("tests/fixtures/api/calendar-dom.json", "utf8"));

const isLocal = (url: string) => {
  const u = new URL(url);
  return ["127.0.0.1", "localhost"].includes(u.hostname) || u.protocol === "data:" || u.protocol === "blob:";
};

/** Bloquea y registra cualquier solicitud fuera de la app local. */
async function trackExternal(page: Page) {
  const external: string[] = [];
  await page.context().route("**/*", (route) => {
    const url = route.request().url();
    // Contrato de calendario provisional mientras la Parte 1 publica la ruta.
    if (new URL(url).pathname === "/api/calendar") return route.fulfill({ json: calendar });
    if (isLocal(url)) return route.continue();
    external.push(url);
    return route.abort();
  });
  page.on("request", (r) => !isLocal(r.url()) && !external.includes(r.url()) && external.push(r.url()));
  return external;
}

const dbCount = () => {
  const db = new Database(E2E_DB, { readonly: true });
  const n = (db.prepare("SELECT COUNT(*) AS n FROM fire_detections").get() as { n: number }).n;
  db.close();
  return n;
};

test("la interfaz carga sin solicitudes externas y con NASA inaccesible", async ({ page }) => {
  const external = await trackExternal(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const [path, heading] of [["/", "Entender el fuego"], ["/rd", "Detecciones"], ["/historico", "Análisis histórico"], ["/aprende", "¿Cómo se detectan"], ["/estado", "Estado de los datos"]]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(heading).first()).toBeVisible();
  }
  expect(external, `Solicitudes externas: ${external.join(", ")}`).toEqual([]);
  expect(errors, `Errores en la página: ${errors.join(" | ")}`).toEqual([]);
});

test("el mapa se renderiza sin conexión con capas locales", async ({ page }) => {
  const external = await trackExternal(page);
  await page.goto("/rd");
  await expect(page.getByTestId("map")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  const box = await page.getByTestId("map").boundingBox();
  expect(box!.height).toBeGreaterThan(300);
  const features = await page.evaluate(async () => {
    const r = await fetch("/api/detections");
    return (await r.json()).features.length;
  });
  expect(features).toBe(4);
  expect(external).toEqual([]);
});

test("los indicadores y gráficos coinciden con SQLite y los filtros funcionan sin conexión", async ({ page }) => {
  const external = await trackExternal(page);
  await page.goto("/rd");
  await expect(page.getByTestId("kpi-total")).toHaveText(String(dbCount()));
  await page.getByTestId("conf-high").click();
  await expect(page).toHaveURL(/confidence=high/);
  await expect(page.getByTestId("kpi-total")).toHaveText("2");
  await page.getByTestId("conf-high").click();
  await page.getByTestId("province-select").selectOption({ label: "Santiago" });
  await expect(page.getByTestId("kpi-total")).toHaveText("1");
  await expect(page.getByTestId("recent-table")).toContainText("Santiago");
  expect(external).toEqual([]);
});

test("un fallo de NASA no borra datos y se muestra como 'Sin conexión con NASA'", async ({ page }) => {
  const before = dbCount();
  await page.goto("/estado");
  await expect(page.getByTestId("status-label")).toContainText("Datos almacenados localmente");
  await page.getByRole("button", { name: "Sincronizar ahora" }).click();
  await expect(page.getByRole("status").filter({ hasText: "No se pudo sincronizar" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("status-label")).toContainText("Sin conexión con NASA", { timeout: 20_000 });
  await expect(page.getByTestId("sync-status")).toHaveAttribute("data-state", "offline", { timeout: 10_000 });
  expect(dbCount()).toBe(before);
  // El panel sigue mostrando los datos locales
  await page.goto("/rd");
  await expect(page.getByTestId("kpi-total")).toHaveText(String(before));
});

test("todas las rutas API devuelven datos sin conexión", async ({ request }) => {
  for (const p of ["/api/status", "/api/stats", "/api/history", "/api/territory", "/api/runs", "/api/detections"]) {
    const r = await request.get(p);
    expect(r.status(), p).toBe(200);
  }
});
