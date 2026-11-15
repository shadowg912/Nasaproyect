import { z } from "zod";
import { getDb } from "@/db/client";
import { getConfig } from "@/lib/config";
import { runChat } from "@/server/chat/run";
import { json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGES = 30;
const MAX_CHARS = 4000;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(MAX_CHARS) }))
    .min(1)
    .max(MAX_MESSAGES)
    .refine((m) => m.at(-1)?.role === "user", "El último mensaje debe ser del usuario"),
  context: z
    .object({
      iso3: z.string().regex(/^[A-Z]{3}$/),
      provinceId: z.number().int().positive().optional(),
      municipalityId: z.number().int().positive().optional(),
      aoi: z.string().max(20000).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
});

/** Chat IA en streaming de texto. Sin `ANTHROPIC_API_KEY` responde 503 `no_api_key` y no llama a ningún servicio. */
export async function POST(req: Request) {
  const cfg = getConfig();
  if (!cfg.anthropicKey) return json({ error: "no_api_key" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Mensaje inválido" }, { status: 400 });
  return new Response(runChat(getDb(), cfg, parsed.data), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
