import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";
import { getCalendar } from "@/server/calendar";
import { chatTools, NASA_DOMAINS } from "@/server/chat/tools";
import { getSyncStatus } from "@/server/status";
import { tempDb } from "../helpers";

let ctx: ReturnType<typeof tempDb>;
beforeEach(() => (ctx = tempDb()));
afterEach(() => ctx.cleanup());

const tool = (name: string) => {
  const t = chatTools(ctx.db).find((x) => "name" in x && x.name === name);
  if (!t || !("run" in t)) throw new Error(`herramienta ${name} no encontrada`);
  return { run: t.run as (input: unknown) => Promise<unknown> };
};

describe("chat IA", () => {
  it("sin clave de Anthropic responde 503 no_api_key sin llamar a la API", async () => {
    const before = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "";
    const res = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "hola" }] }) }));
    process.env.ANTHROPIC_API_KEY = before;
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "no_api_key" });
  });

  it("consultar_calendario devuelve los datos de getCalendar", async () => {
    const out = JSON.parse(String(await tool("consultar_calendario").run({ iso3: "DOM", mode: "raw" })));
    const cal = getCalendar(ctx.db, { iso3: "DOM" }, "raw");
    expect(out.cells).toEqual(cal.cells.map((c) => [c.year, c.month, c.value, c.anomaly === null ? null : Math.round(c.anomaly * 100) / 100]));
    expect(out.calibration).toEqual(cal.calibration);
    expect(out.current).toEqual(cal.current);
  });

  it("incluye búsqueda y lectura web limitadas a dominios de la NASA", () => {
    const server = chatTools(ctx.db).filter((t) => "type" in t && String(t.type).startsWith("web_"));
    expect(server).toHaveLength(2);
    for (const t of server) expect((t as { allowed_domains: string[] }).allowed_domains).toEqual(NASA_DOMAINS);
  });

  it("el estado indica si hay clave de IA", () => {
    expect(getSyncStatus(ctx.db, { ...ctx.cfg, anthropicKey: "" }).hasAiKey).toBe(false);
    expect(getSyncStatus(ctx.db, { ...ctx.cfg, anthropicKey: "x" }).hasAiKey).toBe(true);
  });
});
