import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { exportCsv, exportFilename } from "@/server/export";
import { handle } from "@/server/http";
import { parseRegion } from "@/server/region";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV descargable: `kind=detections` (focos) o `kind=monthly` (tabla mensual armonizada). */
export const GET = (req: NextRequest) =>
  handle(() => {
    const sp = req.nextUrl.searchParams;
    const q = parseRegion(sp);
    const kind = sp.get("kind") === "monthly" ? "monthly" : "detections";
    return new Response(exportCsv(getDb(), q, kind), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename(q, kind)}"`,
        "Cache-Control": "no-store",
      },
    });
  });
