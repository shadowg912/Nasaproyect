import { getDb } from "@/db/client";
import { getConfig } from "@/lib/config";
import { runSync } from "@/server/firms/ingest";
import { handle, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOLDOWN_MS = 2 * 60_000;

/** Sincronización manual desde la interfaz. El bloqueo de SQLite evita ejecuciones simultáneas. */
export const POST = () =>
  handle(async () => {
    const db = getDb();
    const last = db.$client
      .prepare("SELECT started_at AS t FROM ingestion_runs WHERE kind IN ('sync','public_feed') ORDER BY started_at DESC LIMIT 1")
      .get() as { t: string } | undefined;
    if (last && Date.now() - Date.parse(last.t) < COOLDOWN_MS) {
      return json({ status: "cooldown", message: "Espere un par de minutos entre sincronizaciones." }, { status: 429 });
    }
    const r = await runSync(db, getConfig(), { kind: "auto", trigger: "ui" });
    return json(r, { status: r.status === "locked" ? 409 : 200 });
  });
