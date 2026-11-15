import { getDb } from "@/db/client";
import { handle } from "@/server/http";
import { listTerritory } from "@/server/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = () => handle(() => listTerritory(getDb()));
