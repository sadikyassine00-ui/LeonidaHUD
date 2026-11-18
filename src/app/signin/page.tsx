import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TopNav } from "@/components/layout/TopNav";
import { SignInForm } from "@/components/auth/SignInForm";
import { getAuthProviderFlags } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign In | Leonida HUD",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function SignInPage(props: {
  searchParams: Promise<{ callbackUrl?: string; plan?: string }>;
}) {
  const { callbackUrl, plan } = await props.searchParams;
  const checkoutPlan =
    plan === "lifetime" || plan === "monthly" ? plan : null;
  const targetCallbackUrl = checkoutPlan
    ? `/dashboard?checkout=${checkoutPlan}`
    : callbackUrl || "/dashboard";

  const session = await auth();
  if (session?.user?.id) {
    redirect(targetCallbackUrl);
  }

  const providers = getAuthProviderFlags();

  return (
    <div className="min-h-screen bg-[#0B0D12] flex flex-col">
      <TopNav />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <SignInForm
          callbackUrl={targetCallbackUrl}
          checkoutPlan={checkoutPlan}
          providers={providers}
        />
      </main>
    </div>
  );
}
