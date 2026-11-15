import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { handle } from "@/server/http";
import { listDetections, parseFilters, toGeoJSON } from "@/server/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) =>
  handle(() => {
    const { rows, truncated } = listDetections(getDb(), parseFilters(req.nextUrl.searchParams));
    return { ...toGeoJSON(rows), truncated };
  });
