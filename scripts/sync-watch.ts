/**
 * Proceso local opcional de sincronización periódica.
 * El bloqueo en SQLite impide que dos procesos sincronicen al mismo tiempo,
 * por lo que es seguro combinarlo con ejecuciones manuales.
 *
 * Uso: npm run sync:watch   (intervalo en SYNC_INTERVAL_MINUTES)
 */
import "./_env";
import { getConfig } from "@/lib/config";

const { syncOnce } = await import("./sync-firms");
const minutes = getConfig().syncIntervalMinutes;
let stopping = false;

async function loop() {
  while (!stopping) {
    const started = new Date();
    console.log(`\n[${started.toISOString()}] Sincronizando…`);
    try {
      await syncOnce("watch");
    } catch (e) {
      console.error("Fallo inesperado:", (e as Error).message);
    }
    const next = new Date(started.getTime() + minutes * 60_000);
    console.log(`Próxima sincronización: ${next.toISOString()}`);
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, Math.max(0, next.getTime() - Date.now()));
      process.once("SIGINT", () => (clearTimeout(t), resolve()));
    });
  }
}

process.on("SIGINT", () => {
  stopping = true;
  console.log("\nDeteniendo sincronización periódica…");
});
await loop();
