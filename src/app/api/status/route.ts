import { getDb } from "@/db/client";
import { getConfig } from "@/lib/config";
import { handle } from "@/server/http";
import { getSyncStatus } from "@/server/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = () => handle(() => getSyncStatus(getDb(), getConfig()));
