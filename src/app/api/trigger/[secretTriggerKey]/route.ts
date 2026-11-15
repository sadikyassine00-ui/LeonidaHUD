import { NextRequest } from "next/server";
import { applyTriggerAction, type TriggerAction } from "@/lib/overlay-service";

export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = new Set<TriggerAction>([
  "wasted",
  "busted",
  "undo_wasted",
  "undo_busted",
  "cash",
]);

async function handleTrigger(
  request: NextRequest,
  secretTriggerKey: string
): Promise<Response> {
  const url = new URL(request.url);
  let actionParam = url.searchParams.get("action");
  let amountParam = url.searchParams.get("amount");

  if (request.method === "POST" && !actionParam) {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      if (typeof body.action === "string") actionParam = body.action;
      if (body.amount !== undefined) amountParam = String(body.amount);
    } catch {
      // Ignore empty body
    }
  }

  if (!actionParam || !ALLOWED_ACTIONS.has(actionParam as TriggerAction)) {
    return Response.json(
      {
        ok: false,
        error:
          "Invalid or missing action. Supported: wasted, busted, undo_wasted, undo_busted, cash",
      },
      { status: 400 }
    );
  }

  const action = actionParam as TriggerAction;
  const amount = amountParam !== null ? Number(amountParam) : undefined;
  if (action === "cash" && (amount === undefined || !Number.isFinite(amount))) {
    return Response.json(
      { ok: false, error: "cash action requires a numeric amount parameter" },
      { status: 400 }
    );
  }

  const result = await applyTriggerAction(secretTriggerKey, action, amount);
  if (!result) {
    return Response.json(
      { ok: false, error: "Invalid trigger key" },
      { status: 404 }
    );
  }

  return Response.json(result, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ secretTriggerKey: string }> }
) {
  const { secretTriggerKey } = await context.params;
  return handleTrigger(request, secretTriggerKey);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ secretTriggerKey: string }> }
) {
  const { secretTriggerKey } = await context.params;
  return handleTrigger(request, secretTriggerKey);
}
