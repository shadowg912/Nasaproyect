import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { getContext } from "@/server/context";
import { handle, HttpError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Imagen satelital del día (GIBS), clima (POWER), causa probable y propagación estimada de un foco. */
export const GET = (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const { id } = await ctx.params;
    const c = await getContext(getDb(), id);
    if (!c) throw new HttpError(404, "Foco no encontrado");
    return c;
  });
