import os from "node:os";
import crypto from "node:crypto";
import type { DB } from "@/db/client";

/**
 * Bloqueo cooperativo entre procesos almacenado en SQLite. La adquisición se
 * hace dentro de una transacción IMMEDIATE, que SQLite serializa entre procesos.
 */
export function acquireLock(db: DB, name: string, ttlMs: number): string | null {
  const sqlite = db.$client;
  const owner = `${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date();
  const tx = sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM sync_lock WHERE name = ? AND expires_at < ?").run(name, now.toISOString());
    const r = sqlite
      .prepare("INSERT OR IGNORE INTO sync_lock (name, owner, acquired_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(name, owner, now.toISOString(), new Date(now.getTime() + ttlMs).toISOString());
    return r.changes === 1;
  });
  return tx.immediate() ? owner : null;
}

export function releaseLock(db: DB, name: string, owner: string) {
  db.$client.prepare("DELETE FROM sync_lock WHERE name = ? AND owner = ?").run(name, owner);
}

export function currentLock(db: DB, name: string) {
  return db.$client
    .prepare("SELECT owner, acquired_at AS acquiredAt, expires_at AS expiresAt FROM sync_lock WHERE name = ? AND expires_at >= ?")
    .get(name, new Date().toISOString()) as { owner: string; acquiredAt: string; expiresAt: string } | undefined;
}
