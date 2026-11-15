import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { getConfig } from "@/lib/config";

export type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export function openDatabase(file: string, opts: { readonly?: boolean } = {}): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file, { readonly: !!opts.readonly, fileMustExist: !!opts.readonly });
  if (!opts.readonly) sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");
  return drizzle(sqlite, { schema }) as DB;
}

export const MIGRATIONS_DIR = path.resolve(process.cwd(), "drizzle");

export function runMigrations(db: DB) {
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}

const g = globalThis as unknown as { __fuegoDb?: DB };

/** Conexión compartida para el servidor Next.js. Aplica migraciones pendientes al abrir. */
export function getDb(): DB {
  if (!g.__fuegoDb) {
    const db = openDatabase(getConfig().databasePath);
    runMigrations(db);
    g.__fuegoDb = db;
  }
  return g.__fuegoDb;
}
