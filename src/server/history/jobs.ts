import type { DB } from "@/db/client";
import type { AppConfig } from "@/lib/config";
import type { LoadJob } from "@/lib/types";
import { redact } from "@/server/firms/client";
import { importCountry, type ImportOptions } from "./importCountry";
import { rebuildHarmonized } from "./rebuild";

type RunningJob = LoadJob & { finished: Promise<void> };

/** Trabajos en memoria del proceso (sobrevive a recargas de Next en desarrollo). */
const g = globalThis as unknown as { __fuegoJobs?: Map<string, RunningJob> };
const jobs = (g.__fuegoJobs ??= new Map());

const view = ({ finished: _finished, ...job }: RunningJob): LoadJob => job;

/** Inicia la carga del historial de un país. Si ya hay una en curso para ese país, devuelve la misma. */
export function startLoad(db: DB, cfg: AppConfig, iso3: string, opts: ImportOptions = {}): RunningJob {
  const current = jobs.get(iso3);
  if (current && (current.state === "queued" || current.state === "running")) return current;
  const job = { jobId: `${iso3}-${Date.now()}`, iso3, state: "queued", done: 0, total: 0, error: null } as RunningJob;
  job.finished = (async () => {
    job.state = "running";
    try {
      await importCountry(db, cfg, iso3, { ...opts, onProgress: (done, total) => Object.assign(job, { done, total }) });
      rebuildHarmonized(db, iso3);
      job.state = "done";
    } catch (e) {
      job.state = "error";
      job.error = redact(e instanceof Error ? e.message : String(e), cfg.mapKey);
    }
  })();
  jobs.set(iso3, job);
  return job;
}

export function getLoad(iso3: string): LoadJob | null {
  const job = jobs.get(iso3);
  return job ? view(job) : null;
}
