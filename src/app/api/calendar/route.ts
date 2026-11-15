import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { getCalendar } from "@/server/calendar";
import { handle } from "@/server/http";
import { parseRegion } from "@/server/region";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Calendario de quemas año × mes (`mode=harmonized|raw`) de un país, provincia, municipio o área. */
export const GET = (req: NextRequest) =>
  handle(() => {
    const sp = req.nextUrl.searchParams;
    return getCalendar(getDb(), parseRegion(sp), sp.get("mode") === "raw" ? "raw" : "harmonized");
  });
