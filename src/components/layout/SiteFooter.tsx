import Link from "next/link";
import { GUIDE_LINKS } from "@/lib/site";
import { SlicedSunMark } from "@/components/neon/SlicedSun";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#7846AA]/35 py-12 px-4 sm:px-6 bg-[#11072B]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-start text-xs text-[#B9A8DA]">
        <div className="md:col-span-5 space-y-3">
          <Link href="/" className="inline-flex items-center gap-3">
            <SlicedSunMark size={38} />
            <span
              className="chroma-wordmark text-xl"
              data-text="LEONIDA HUD"
            >
              <span>LEONIDA HUD</span>
            </span>
          </Link>
          <p className="max-w-sm leading-relaxed">
            Built for PS5 and Xbox Series X|S OBS capture setups. Live broadcast
            counters and chat polls controlled from your phone or Stream Deck.
          </p>
        </div>

        <div className="md:col-span-4 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#19E3C6]">
            Setup Guides
          </div>
          <ul className="space-y-2">
            {GUIDE_LINKS.map((guide) => (
              <li key={guide.href}>
                <Link
                  href={guide.href}
                  className="hover:text-[#FF3D7F] transition-colors"
                >
                  {guide.shortTitle}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-3 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#19E3C6]">
            Product &amp; Legal
          </div>
          <ul className="space-y-2">
            <li>
              <Link
                href="/studio"
                className="hover:text-[#F6F2FF] transition-colors"
              >
                Neon Broadcast Studio
              </Link>
            </li>
            <li>
              <Link
                href="/controller"
                className="hover:text-[#F6F2FF] transition-colors"
              >
                Mobile Controller
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="hover:text-[#F6F2FF] transition-colors"
              >
                Terms of Service
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="hover:text-[#F6F2FF] transition-colors"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                href="/refunds"
                className="hover:text-[#F6F2FF] transition-colors"
              >
                Refund Policy
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-[#7846AA]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#B9A8DA]">
        <div>
          &copy; 2026 Leonida HUD |{" "}
          <a
            href="mailto:support@leonidahud.com"
            className="hover:text-[#F6F2FF] transition-colors"
          >
            support@leonidahud.com
          </a>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-[#F6F2FF] transition-colors">
            Terms
          </Link>
          <Link
            href="/privacy"
            className="hover:text-[#F6F2FF] transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/refunds"
            className="hover:text-[#F6F2FF] transition-colors"
          >
            Refunds
          </Link>
        </div>
      </div>
    </footer>
  );
}
