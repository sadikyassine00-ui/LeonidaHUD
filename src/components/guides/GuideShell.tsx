import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { GUIDE_LINKS } from "@/lib/site";

interface GuideShellProps {
  eyebrow: string;
  title: string;
  intro: string;
  currentHref: string;
  children: React.ReactNode;
}

export function GuideShell({
  eyebrow,
  title,
  intro,
  currentHref,
  children,
}: GuideShellProps) {
  const otherGuides = GUIDE_LINKS.filter((g) => g.href !== currentHref);

  return (
    <div className="min-h-screen bg-[#0B0D12] text-[#F4F5F7] flex flex-col">
      <TopNav activePath="/" />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
        <div className="space-y-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8D96A5] hover:text-[#F4F5F7] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Leonida HUD</span>
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full bg-[#131720] border border-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#F7B267]">
            <span>{eyebrow}</span>
          </div>

          <h1 className="font-hud font-extrabold text-4xl sm:text-5xl uppercase tracking-tight leading-[0.98] text-[#F4F5F7]">
            {title}
          </h1>

          <p className="text-base sm:text-lg text-[#8D96A5] leading-relaxed">
            {intro}
          </p>
        </div>

        <article className="space-y-8">{children}</article>

        <section className="rounded-2xl bg-[#131720] border border-white/10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-[#F7B267]">
              Try It Before You Stream
            </div>
            <h2 className="font-hud font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-[#F4F5F7]">
              Test Every Counter Live in Your Browser
            </h2>
            <p className="text-sm text-[#8D96A5]">
              Click Story %, Cash, Wasted, Busted, and 9:16 Clip-Safe Mode in
              the interactive sandbox.
            </p>
          </div>
          <Link
            href="/#live-sandbox"
            className="h-12 px-6 rounded-xl bg-[#F25C54] hover:bg-[#F25C54]/90 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 shrink-0 transition-colors"
          >
            <span>Test the Live HUD Demo</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>

        <section className="space-y-4 pt-4 border-t border-white/8">
          <h2 className="font-hud font-extrabold text-2xl uppercase tracking-tight text-[#F4F5F7]">
            More Console Streaming Guides
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {otherGuides.map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="rounded-2xl bg-[#131720] border border-white/8 hover:border-white/20 p-5 space-y-2 transition-colors block"
              >
                <div className="text-sm font-bold text-[#F4F5F7]">
                  {guide.title}
                </div>
                <p className="text-xs text-[#8D96A5] leading-relaxed">
                  {guide.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
