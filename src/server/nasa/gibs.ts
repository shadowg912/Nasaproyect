/** NASA GIBS (Global Imagery Browse Services): imagen de color real del día, disponible desde 2000. */
export const GIBS_LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor";
export const GIBS_LAYERS = new Set([GIBS_LAYER, "MODIS_Aqua_CorrectedReflectance_TrueColor", "VIIRS_SNPP_CorrectedReflectance_TrueColor"]);
const GIBS_WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
/** Medio lado del recuadro alrededor del foco (grados) y máximo permitido en el proxy. */
export const IMAGE_HALF_DEG = 0.25;
export const MAX_IMAGE_DEG = 2;

/** `bbox` en orden WMS 1.3.0 para EPSG:4326: sur, oeste, norte, este. */
export function gibsUrl(layer: string, date: string, bbox: [number, number, number, number]): string {
  const p = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: "1.3.0",
    LAYERS: layer,
    CRS: "EPSG:4326",
    BBOX: bbox.join(","),
    WIDTH: "512",
    HEIGHT: "512",
    FORMAT: "image/jpeg",
    TIME: date,
  });
  return `${GIBS_WMS}?${decodeURIComponent(p.toString())}`;
}

/** URL del proxy local que sirve (y guarda en caché) la imagen GIBS de un foco. */
export function localImageryUrl(lat: number, lon: number, date: string, layer = GIBS_LAYER): string {
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const bbox = [r(lat - IMAGE_HALF_DEG), r(lon - IMAGE_HALF_DEG), r(lat + IMAGE_HALF_DEG), r(lon + IMAGE_HALF_DEG)].join(",");
  return `/api/imagery?layer=${layer}&date=${date}&bbox=${bbox}`;
}
