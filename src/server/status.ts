import type { DB } from "@/db/client";
import type { AppConfig } from "@/lib/config";
import { currentLock } from "./lock";
import { SYNC_LOCK } from "./firms/ingest";
import type { SyncStatus } from "@/lib/types";

interface RunRow {
  id: number;
  kind: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  rowsInserted: number;
  rowsInCountry: number;
  errorType: string | null;
  errorMessage: string | null;
}

const RUN_COLS = `id, kind, status, started_at AS startedAt, finished_at AS finishedAt, rows_inserted AS rowsInserted,
  rows_in_country AS rowsInCountry, error_type AS errorType, error_message AS errorMessage`;

/**
 * Estado de sincronización. Distingue entre "sincronizado sin detecciones nuevas"
 * (éxito) y "sin conexión con NASA" (error de red o del servidor).
 */
export function getSyncStatus(db: DB, cfg: AppConfig, now = new Date()): SyncStatus {
  const s = db.$client;
  const lastAttempt = s
    .prepare(`SELECT ${RUN_COLS} FROM ingestion_runs WHERE kind IN ('sync','public_feed') AND status != 'running' ORDER BY started_at DESC, id DESC LIMIT 1`)
    .get() as RunRow | undefined;
  const lastSuccess = s
    .prepare(`SELECT ${RUN_COLS} FROM ingestion_runs WHERE kind IN ('sync','public_feed') AND status IN ('success','partial') ORDER BY started_at DESC, id DESC LIMIT 1`)
    .get() as RunRow | undefined;
  const agg = s
    .prepare("SELECT COUNT(*) AS n, MAX(acquired_at) AS latest, MIN(acq_date) AS first FROM fire_detections")
    .get() as { n: number; latest: string | null; first: string | null };
  const running = !!currentLock(db, SYNC_LOCK);

  let state: SyncStatus["state"];
  if (!lastSuccess) state = "never";
  else if (lastAttempt && lastAttempt.status === "failed" && (lastAttempt.errorType === "network" || lastAttempt.errorType === "server"))
    state = "offline";
  else {
    const ageH = (now.getTime() - Date.parse(lastSuccess.finishedAt ?? lastSuccess.startedAt)) / 3600_000;
    state = ageH <= cfg.freshHours ? "fresh" : "stored";
  }
  return {
    state,
    running,
    hasMapKey: !!cfg.mapKey,
    hasAiKey: !!process.env.ANTHROPIC_API_KEY,
    freshHours: cfg.freshHours,
    lastSuccessAt: lastSuccess?.finishedAt ?? null,
    lastSuccessKind: lastSuccess?.kind ?? null,
    lastSuccessInserted: lastSuccess?.rowsInserted ?? null,
    lastAttemptAt: lastAttempt?.finishedAt ?? null,
    lastAttemptStatus: lastAttempt?.status ?? null,
    lastErrorType: lastAttempt?.status === "success" ? null : (lastAttempt?.errorType ?? null),
    lastErrorMessage: lastAttempt?.status === "success" ? null : (lastAttempt?.errorMessage ?? null),
    totalDetections: agg.n,
    latestDetectionAt: agg.latest,
    firstDetectionDate: agg.first,
  };
}
