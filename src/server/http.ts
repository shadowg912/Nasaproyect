import { NextResponse } from "next/server";

export const json = (data: unknown, init?: ResponseInit) =>
  NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });

/** Error esperado de la petición (parámetros inválidos, recurso inexistente): se responde con su estado y mensaje. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function handle<T>(fn: () => T | Promise<T>) {
  return Promise.resolve()
    .then(fn)
    .then((d) => (d instanceof Response ? d : json(d)))
    .catch((e: Error) => {
      if (e instanceof HttpError) return json({ error: e.message }, { status: e.status });
      console.error(e);
      return json({ error: "Error interno al consultar la base de datos local" }, { status: 500 });
    });
}
