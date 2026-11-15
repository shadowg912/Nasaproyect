import { expect, test } from "@playwright/test";

test("la portada ofrece los dos ámbitos y el menú avanzado", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "El fuego visto desde el espacio." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explorar el mundo" })).toHaveAttribute("href", "/global");
  await expect(page.getByRole("link", { name: "Mi territorio" })).toHaveAttribute("href", "/local");
  await page.getByRole("button", { name: "Avanzado" }).click();
  await expect(page.getByRole("menuitem", { name: /Estado de los datos/ })).toHaveAttribute("href", "/avanzado/estado");
  await expect(page.getByRole("menuitem", { name: /Créditos/ })).toHaveAttribute("href", "/creditos");
});

test("/estado redirige y créditos informa las fuentes", async ({ page }) => {
  await page.goto("/estado");
  await expect(page).toHaveURL(/\/avanzado\/estado$/);
  await page.goto("/creditos");
  await expect(page.getByRole("heading", { name: "Créditos y fuentes" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Fuentes de datos, imágenes y cartografía" })).toBeVisible();
});
