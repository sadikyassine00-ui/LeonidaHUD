import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { ensureDatabaseSchema } from "@/db/ensure-schema";

export async function GET(request: NextRequest) {
  await ensureDatabaseSchema();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  await ensureDatabaseSchema();
  return handlers.POST(request);
}
