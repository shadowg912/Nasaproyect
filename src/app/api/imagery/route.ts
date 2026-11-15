import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { isIsoDate } from "@/lib/dates";
import { handle, HttpError } from "@/server/http";
import { cached } from "@/server/nasa/cache";
import { GIBS_LAYERS, gibsUrl, MAX_IMAGE_DEG } from "@/server/nasa/gibs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Las imágenes de un día pasado no cambian: se guardan sin caducidad práctica. */
const IMAGERY_TTL_MS = 365 * 86400000;

/** Proxy local de NASA GIBS: solo capas conocidas y recuadros pequeños (sin URL arbitrarias). Guarda la imagen en caché. */
export const GET = (req: NextRequest) =>
  handle(async () => {
    const sp = req.nextUrl.searchParams;
    const layer = sp.get("layer") ?? "";
    const date = sp.get("date");
    const bbox = (sp.get("bbox") ?? "").split(",").map(Number);
    const [s, w, n, e] = bbox;
    if (
      !GIBS_LAYERS.has(layer) || !isIsoDate(date) || bbox.length !== 4 || !bbox.every(Number.isFinite) ||
      s >= n || w >= e || n - s > MAX_IMAGE_DEG || e - w > MAX_IMAGE_DEG || s < -90 || n > 90 || w < -180 || e > 180
    )
      throw new HttpError(400, "Parámetros de imagen inválidos");
    const body = await cached(getDb(), `gibs:${layer}:${date}:${bbox.join(",")}`, IMAGERY_TTL_MS, async () => {
      const res = await fetch(gibsUrl(layer, date, [s, w, n, e]));
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) throw new Error(`GIBS ${res.status}`);
      return Buffer.from(await res.arrayBuffer()).toString("base64");
    });
    if (!body) throw new HttpError(502, "La imagen satelital no está disponible sin conexión");
    return new Response(Buffer.from(body, "base64"), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
    });
  });
