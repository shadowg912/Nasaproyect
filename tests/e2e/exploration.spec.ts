import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const calendar=JSON.parse(readFileSync('tests/fixtures/api/calendar-dom.json','utf8'));
const raw=JSON.parse(readFileSync('tests/fixtures/api/calendar-dom-raw.json','utf8'));
const countries=JSON.parse(readFileSync('tests/fixtures/api/countries.json','utf8'));

test('inicio, calendario accesible, cambio de modo y asistente sin clave',async({page})=>{
  await page.route('**/api/calendar?**',route=>route.fulfill({json:new URL(route.request().url()).searchParams.get('mode')==='raw'?raw:calendar}));
  await page.route('**/api/countries',route=>route.fulfill({json:countries}));
  await page.goto('/');
  await page.screenshot({path:'test-results/inicio.png',fullPage:true});
  await page.getByRole('link',{name:'Explorar el mundo'}).click();
  await expect(page.getByRole('heading',{name:'Calendario de actividad'})).toBeVisible();
  await page.getByRole('button',{name:'Crudo',exact:true}).click();
  await expect(page.getByRole('button',{name:'Crudo',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Armonizado',exact:true}).click();
  const cell=page.getByRole('button',{name:/Ene 2001:/});
  await cell.focus();await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button',{name:/Feb 2001:/})).toBeFocused();
  await page.getByRole('button',{name:'Asistente IA',exact:true}).click();
  await expect(page.getByText('Asistente IA: disponible cuando se configure la clave')).toBeVisible();
  await page.getByRole('button',{name:'Cerrar asistente'}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'test-results/exploracion-global.png',fullPage:true});
});

test('el área manual viaja al calendario y rechaza límites invertidos',async({page})=>{
  await page.route('**/api/countries',route=>route.fulfill({json:countries}));
  const urls:string[]=[];
  await page.route('**/api/calendar?**',route=>{urls.push(route.request().url());return route.fulfill({json:calendar});});
  await page.goto('/global');
  await page.getByLabel('Oeste (longitud)',{exact:true}).fill('-71');await page.getByLabel('Este (longitud)',{exact:true}).fill('-70');
  await page.getByLabel('Sur (latitud)').fill('18');await page.getByLabel('Norte (latitud)').fill('19');
  await page.getByRole('button',{name:'Aplicar área'}).click();
  await expect.poll(()=>urls.some(u=>new URL(u).searchParams.get('aoi')==='-71,18,-70,19')).toBe(true);
  await page.getByLabel('Oeste (longitud)').fill('-69');await page.getByRole('button',{name:'Aplicar área'}).click();
  await expect(page.getByRole('alert').filter({hasText:'Escribe límites válidos'})).toBeVisible();
});

test('detalle del foco se abre por teclado y permite cerrar con Escape',async({page})=>{
  await page.route('**/api/detections/*/context',route=>route.fulfill({json:{imagery:null,weather:null,cause:null,spread:null}}));
  await page.goto('/rd');
  await expect(page.getByTestId('map')).toHaveAttribute('data-ready','true',{timeout:20000});
  await expect(page.getByRole('button',{name:/Ver contexto del foco/}).first()).toBeVisible();
  await page.screenshot({path:'test-results/panel-rd.png',fullPage:true});
  await page.getByRole('button',{name:/Ver contexto del foco/}).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('No disponible');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('respaldo provisional explícito y diseño móvil sin desbordamiento',async({page})=>{
  await page.route('**/api/calendar?**',route=>route.fulfill({status:404,json:{error:'not_found'}}));
  await page.route('**/api/countries',route=>route.fulfill({status:404,json:{error:'not_found'}}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/global');
  await expect(page.getByText(/Ejemplo provisional de RD/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/global-movil.png',fullPage:true});
  await page.getByRole('combobox',{name:/^País/}).selectOption('HTI');
  await expect(page.getByText(/Calendario no disponible para esta selección/)).toBeVisible();
  await expect(page.getByText(/Ejemplo provisional de RD/)).not.toBeVisible();
});
