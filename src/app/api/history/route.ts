import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { handle } from "@/server/http";
import { getHistory, parseFilters } from "@/server/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => handle(() => getHistory(getDb(), parseFilters(req.nextUrl.searchParams)));
