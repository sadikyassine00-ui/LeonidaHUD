import { getAuthenticatedUserId } from "@/lib/session";
import { getUserBillingInfo } from "@/lib/overlay-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const billing = await getUserBillingInfo(userId);
  if (!billing) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json(
    {
      id: billing.id,
      email: billing.email,
      plan: billing.plan,
      planTier: billing.planTier,
      planType: billing.planType,
      subscriptionStatus: billing.subscriptionStatus,
      overlayToken: billing.overlayToken,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
