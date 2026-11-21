import { redirect } from "next/navigation";
import { hasDatabaseConfig } from "@/db";
import { getAuthenticatedUserId } from "@/lib/session";
import {
  getOrCreateOverlayForUser,
  getUserBillingInfo,
} from "@/lib/overlay-service";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage(props: {
  searchParams: Promise<{ checkout?: string; upgraded?: string }>;
}) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/signin?callbackUrl=/dashboard");
  }

  const { checkout, upgraded } = await props.searchParams;
  const autoCheckoutPlan =
    checkout === "lifetime" || checkout === "monthly" ? checkout : null;

  const [overlay, user] = await Promise.all([
    getOrCreateOverlayForUser(userId),
    getUserBillingInfo(userId),
  ]);

  if (!overlay || !user) {
    redirect("/signin");
  }

  return (
    <DashboardClient
      initialOverlay={overlay}
      user={user}
      hasDatabase={hasDatabaseConfig()}
      autoCheckoutPlan={autoCheckoutPlan}
      justUpgraded={upgraded === "1"}
    />
  );
}
