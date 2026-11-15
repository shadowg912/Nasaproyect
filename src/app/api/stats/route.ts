import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { handle } from "@/server/http";
import { getStats, parseFilters } from "@/server/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => handle(() => getStats(getDb(), parseFilters(req.nextUrl.searchParams)));
