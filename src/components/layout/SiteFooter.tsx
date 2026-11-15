import Image from "next/image";
import Link from "next/link";
import { GUIDE_LINKS } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 py-12 px-4 sm:px-6 bg-[#0B0D12]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-start text-xs text-[#8D96A5]">
        <div className="md:col-span-5 space-y-3">
          <Link href="/" className="inline-block">
            <Image
              src="/logos/leonida-hud-logo-cropped.png"
              alt="Leonida HUD"
              width={160}
              height={55}
              className="h-11 w-auto object-contain"
            />
          </Link>
          <p className="max-w-sm leading-relaxed">
            Built for PS5 and Xbox Series X|S OBS capture setups. Live broadcast
            counters and chat polls controlled from your phone or Stream Deck.
          </p>
        </div>

        <div className="md:col-span-4 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#F4F5F7]">
            Setup Guides
          </div>
          <ul className="space-y-2">
            {GUIDE_LINKS.map((guide) => (
              <li key={guide.href}>
                <Link
                  href={guide.href}
                  className="hover:text-[#F25C54] transition-colors"
                >
                  {guide.shortTitle}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-3 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#F4F5F7]">
            Product &amp; Legal
          </div>
          <ul className="space-y-2">
            <li>
              <Link href="/" className="hover:text-[#F4F5F7] transition-colors">
                Live HUD Sandbox
              </Link>
            </li>
            <li>
              <Link
                href="/#pricing"
                className="hover:text-[#F4F5F7] transition-colors"
              >
                Starter &amp; Launch Pass Pricing
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="hover:text-[#F4F5F7] transition-colors"
              >
                Terms of Service
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="hover:text-[#F4F5F7] transition-colors"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                href="/refunds"
                className="hover:text-[#F4F5F7] transition-colors"
              >
                Refund Policy
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#8D96A5]">
        <div>
          &copy; 2026 Leonida HUD |{" "}
          <a
            href="mailto:support@leonidahud.com"
            className="hover:text-[#F4F5F7] transition-colors"
          >
            support@leonidahud.com
          </a>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-[#F4F5F7] transition-colors">
            Terms
          </Link>
          <Link
            href="/privacy"
            className="hover:text-[#F4F5F7] transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/refunds"
            className="hover:text-[#F4F5F7] transition-colors"
          >
            Refunds
          </Link>
        </div>
      </div>
    </footer>
  );
}
