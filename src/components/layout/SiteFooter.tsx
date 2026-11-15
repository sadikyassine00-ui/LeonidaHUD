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
            Product
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
                href="/signin"
                className="hover:text-[#F4F5F7] transition-colors"
              >
                Launch Free Overlay
              </Link>
            </li>
            <li>
              <Link
                href="/remote"
                className="hover:text-[#F4F5F7] transition-colors"
              >
                Mobile Remote
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
