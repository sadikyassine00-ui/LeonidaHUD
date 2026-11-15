import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund Policy | Leonida HUD",
  description:
    "Refund Policy for Leonida HUD Pro Launch Pass and monthly subscriptions processed by Paddle.",
  alternates: {
    canonical: `${SITE_URL}/refunds`,
  },
};

export default function RefundsPage() {
  return (
    <LegalShell title="Refund Policy" effectiveDate="November 15, 2026">
      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          1. Merchant of Record
        </h2>
        <p>
          All purchases for Leonida HUD are processed by Paddle.com Market
          Limited (&quot;Paddle&quot;).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          2. 14-Day Refund Window
        </h2>
        <p>
          Because Leonida HUD is an instant-access digital SaaS product, we
          offer a full refund within 14 calendar days of purchase if you
          experience a verified technical failure that prevents the OBS Browser
          Source or Mobile Remote from functioning on your setup and our support
          team cannot resolve it within 48 hours.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          3. Non-Refundable Scenarios
        </h2>
        <p>
          Refunds are not issued after 14 days, for completed playthroughs or
          events where the Pro overlay was actively used on live streams, for
          failure to cancel a monthly subscription before its renewal date, or
          for user-side hardware issues unrelated to Leonida HUD.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          4. Subscription Cancellations
        </h2>
        <p>
          If you choose the $29/month plan instead of the $49 One-Time Launch
          Pass, you can cancel anytime in one click before your next billing
          date to stop future charges. Your Pro access remains active through
          the end of the current paid period.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          5. How to Request a Refund
        </h2>
        <p>
          Email{" "}
          <a
            href="mailto:support@leonidahud.com"
            className="text-[#F4F5F7] underline hover:text-[#F25C54]"
          >
            support@leonidahud.com
          </a>{" "}
          with your Paddle Order ID and account email, or submit a request
          directly through your Paddle receipt link. Approved refunds are
          processed back to your original payment method within 5 to 10 business
          days.
        </p>
      </section>
    </LegalShell>
  );
}
