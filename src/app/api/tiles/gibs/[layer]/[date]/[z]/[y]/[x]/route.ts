import type { NextRequest } from "next/server";
import { fetchGibsTile, validTileRequest } from "@/server/tiles/gibs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ layer: string; date: string; z: string; y: string; x: string }> };

/** Proxy de teselas NASA GIBS (lista blanca de `src/lib/layers.ts`) con caché local. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const p = await ctx.params;
  const [z, y, x] = [p.z, p.y, p.x].map((v) => Number(v));
  if (!validTileRequest(p.layer, p.date, z, y, x)) return new Response("Tesela inválida", { status: 400 });
  const tile = await fetchGibsTile(p.layer, p.date, z, y, x);
  if (!tile) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(tile.body), {
    headers: { "Content-Type": tile.type, "Cache-Control": p.date === "default" ? "public, max-age=86400" : "public, max-age=3600" },
  });
}
