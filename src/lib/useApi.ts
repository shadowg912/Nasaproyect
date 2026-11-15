"use client";
import { useEffect, useState } from "react";

async function fixtureFor(url: string): Promise<unknown | null> {
  const u = new URL(url, "http://local");
  if (u.pathname === "/api/countries") return (await import("../../tests/fixtures/api/countries.json")).default;
  if (u.pathname === "/api/calendar" && (u.searchParams.get("iso3") ?? "DOM") === "DOM" && !["provinceId", "municipalityId", "aoi", "from", "to"].some(k => u.searchParams.has(k))) {
    return u.searchParams.get("mode") === "raw" ? (await import("../../tests/fixtures/api/calendar-dom-raw.json")).default : (await import("../../tests/fixtures/api/calendar-dom.json")).default;
  }
  return null;
}

/** Obtiene JSON de una ruta local /api/*. */
export function useApi<T>(url: string | null, refreshKey: unknown = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"api" | "fixture">("api");
  useEffect(() => {
    setData(null);
    setError(null);
    setSource("api");
    if (!url) { setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(url, { signal: ctrl.signal, cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404) {
          const fixture = await fixtureFor(url);
          if (fixture) { if (!ctrl.signal.aborted) setSource("fixture"); return fixture as T; }
        }
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `HTTP ${r.status}`);
        return r.json() as Promise<T>;
      })
      .then((d) => { if (!ctrl.signal.aborted) { setData(d); setError(null); } })
      .catch((e: Error) => !ctrl.signal.aborted && setError(e.message))
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [url, refreshKey]);
  return { data, error, loading, source };
}
