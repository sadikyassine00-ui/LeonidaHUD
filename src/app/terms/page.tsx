import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service | Leonida HUD",
  description:
    "Terms of Service for Leonida HUD live OBS Browser Source overlays, mobile remote controls, and Paddle billing.",
  alternates: {
    canonical: `${SITE_URL}/terms`,
  },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" effectiveDate="November 15, 2026">
      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          1. Operator &amp; Acceptance
        </h2>
        <p>
          Leonida HUD (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides
          live broadcast overlay and remote control tools for console and PC
          streamers. By creating an account or using the OBS Browser Source
          overlay, mobile remote, or Stream Deck webhooks, you agree to these
          Terms of Service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          2. Service Description &amp; License
        </h2>
        <p>
          We grant you a non-exclusive, revocable, non-transferable license to
          use Leonida HUD overlays on live broadcasts (Twitch, Kick, YouTube)
          and recorded video clips. Account sharing, reselling overlay URLs, or
          reverse-engineering the service is prohibited.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          3. Merchant of Record &amp; Billing (Paddle)
        </h2>
        <p>
          All paid orders ($49 One-Time Launch Pass and $29/month Pro
          Broadcaster subscriptions) are processed by our Merchant of Record,
          Paddle.com Market Limited (&quot;Paddle&quot;), who handles payment
          processing, invoicing, and applicable sales tax or VAT. Subscriptions
          renew monthly until canceled via your Paddle customer portal or
          dashboard.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          4. Trademarks &amp; Third-Party Platforms
        </h2>
        <p>
          Leonida HUD is an independent broadcast graphics tool and is not
          affiliated with, endorsed by, or sponsored by Sony, Microsoft, Twitch,
          Kick, OBS Studio, Elgato, or any video game publisher. Broadcasters are
          solely responsible for their own stream content and compliance with
          their streaming platform&apos;s rules.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          5. Availability &amp; Limitation of Liability
        </h2>
        <p>
          While we maintain redundant real-time sync for long broadcasts, the
          service is provided &quot;as is&quot; without warranties of
          uninterrupted uptime. Our total liability is capped at the amount you
          paid for the service in the past 12 months.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">6. Contact</h2>
        <p>
          Direct legal questions to{" "}
          <a
            href="mailto:support@leonidahud.com"
            className="text-[#F4F5F7] underline hover:text-[#F25C54]"
          >
            support@leonidahud.com
          </a>
          .
        </p>
      </section>
    </LegalShell>
  );
}
