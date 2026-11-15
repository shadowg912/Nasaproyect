import type { DB } from "@/db/client";

/**
 * Caché en SQLite de respuestas externas de la NASA. Devuelve el cuerpo guardado si sigue vigente; si no, llama a
 * `fetcher` y lo guarda. Si `fetcher` falla (sin Internet), devuelve la copia vencida o null; nunca lanza.
 */
export async function cached(db: DB, key: string, ttlMs: number, fetcher: () => Promise<string>): Promise<string | null> {
  const row = db.$client.prepare("SELECT body, fetched_at FROM context_cache WHERE key = ?").get(key) as
    | { body: string; fetched_at: string }
    | undefined;
  if (row && Date.now() - Date.parse(row.fetched_at) < ttlMs) return row.body;
  try {
    const body = await fetcher();
    db.$client
      .prepare("INSERT OR REPLACE INTO context_cache (key, body, fetched_at) VALUES (?, ?, ?)")
      .run(key, body, new Date().toISOString());
    return body;
  } catch {
    return row?.body ?? null;
  }
}
