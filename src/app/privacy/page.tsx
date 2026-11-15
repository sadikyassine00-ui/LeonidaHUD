import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy | Leonida HUD",
  description:
    "Privacy Policy for Leonida HUD explaining account authentication, stream state storage, Paddle billing, and user data rights.",
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" effectiveDate="November 15, 2026">
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#F7B267]">
          1. Data We Collect
        </h2>
        <ul className="space-y-2.5 list-disc list-inside">
          <li>
            <strong className="text-[#F4F5F7]">Account &amp; Auth Data:</strong>{" "}
            When you sign in via Twitch OAuth, Discord OAuth, or Magic Link
            email, we store your email address, public username, avatar URL, and
            provider ID to authenticate your account and generate your private
            OBS overlay keys.
          </li>
          <li>
            <strong className="text-[#F4F5F7]">
              Overlay &amp; Stream State Data:
            </strong>{" "}
            Counter values (Story %, Cash, Wasted, Busted), custom mission
            checklists, hook banner text, and temporary chat poll tallies (!A /
            !B vote counts) are stored to sync your overlay in real time. We do
            not archive or sell your viewers&apos; chat logs.
          </li>
          <li>
            <strong className="text-[#F4F5F7]">Billing Metadata:</strong>{" "}
            Payment card details are never stored on our servers. Paddle
            processes all payments and shares only transaction IDs, subscription
            status, and billing country/email with us to unlock Pro features.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          2. Infrastructure &amp; Sub-Processors
        </h2>
        <p>
          Leonida HUD uses trusted cloud infrastructure providers (Vercel for
          hosting, Neon for serverless Postgres database storage, and Paddle for
          payment processing) solely to operate the application.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          3. Cookies &amp; Sessions
        </h2>
        <p>
          We use essential HTTP-only authentication cookies to keep you logged
          into /dashboard and /remote. We do not use invasive third-party
          ad-tracking cookies.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#F7B267]">
          4. Data Retention &amp; User Rights
        </h2>
        <p>
          You may request account deletion, data export, or correction at any
          time by emailing{" "}
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
