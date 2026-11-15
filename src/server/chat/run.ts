import Anthropic from "@anthropic-ai/sdk";
import type { DB } from "@/db/client";
import type { AppConfig } from "@/lib/config";
import type { ChatRequest } from "@/lib/types";
import { chatTools } from "./tools";

export const CHAT_MODEL = "claude-opus-5-5";
const MAX_TOKENS = 16000;

const SYSTEM = `Eres el asistente de Satflame, una aplicación que muestra focos de calor detectados por satélites de la NASA (FIRMS: MODIS y VIIRS) y su serie armonizada desde 2000.
Reglas:
- Responde en español, en frases cortas y sin jerga; si usas un término técnico, explícalo.
- Toda cifra debe salir de tus herramientas (consultar_calendario, resumen_focos, contexto_foco, metodologia) o de una página de la NASA que hayas leído. Nunca inventes datos.
- Si no tienes una fuente para algo, dilo con claridad.
- Nunca afirmes la causa de un incendio como hecho: habla de causa probable y explica por qué.
- RD = República Dominicana (código DOM).`;

const regionNote = (req: ChatRequest) =>
  req.context ? `\nEl usuario está mirando esta región: ${JSON.stringify(req.context)}. Úsala por defecto.` : "";

/** Respuesta del chat como texto en streaming. Los errores se comunican como texto, sin exponer la clave. */
export function runChat(db: DB, cfg: AppConfig, req: ChatRequest, client = new Anthropic({ apiKey: cfg.anthropicKey })): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const say = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        const runner = client.beta.messages.toolRunner({
          model: CHAT_MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM + regionNote(req),
          messages: req.messages,
          tools: chatTools(db),
          output_config: { effort: "medium" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          stream: true,
        });
        for await (const messageStream of runner) {
          for await (const event of messageStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") say(event.delta.text);
          }
          const message = await messageStream.finalMessage();
          if (message.stop_reason === "refusal") {
            say("\n\nNo puedo ayudar con esa consulta.");
            break;
          }
          if (message.stop_reason === "max_tokens" && message.content.some((b) => b.type === "tool_use")) break;
        }
      } catch (e) {
        const status = e instanceof Anthropic.APIError ? e.status : null;
        say(status === 401 ? "\n\nLa clave del asistente no es válida." : status === 429 ? "\n\nEl asistente está saturado; inténtalo en un momento." : "\n\nEl asistente no está disponible ahora mismo.");
      } finally {
        controller.close();
      }
    },
  });
}
