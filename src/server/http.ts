import { NextResponse } from "next/server";

export const json = (data: unknown, init?: ResponseInit) =>
  NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });

export function handle<T>(fn: () => T | Promise<T>) {
  return Promise.resolve()
    .then(fn)
    .then((d) => (d instanceof Response ? d : json(d)))
    .catch((e: Error) => {
      console.error(e);
      return json({ error: "Error interno al consultar la base de datos local" }, { status: 500 });
    });
}
