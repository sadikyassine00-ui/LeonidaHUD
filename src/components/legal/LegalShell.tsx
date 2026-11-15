import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { SiteFooter } from "@/components/layout/SiteFooter";

interface LegalShellProps {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}

export function LegalShell({
  title,
  effectiveDate,
  children,
}: LegalShellProps) {
  return (
    <div className="min-h-screen bg-[#0B0D12] text-[#F4F5F7] flex flex-col">
      <TopNav activePath="/" />

      <main className="flex-1 max-w-3xl w-full mx-auto py-16 px-6 space-y-8">
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8D96A5] hover:text-[#F4F5F7] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Leonida HUD</span>
          </Link>

          <div className="space-y-2">
            <h1 className="font-hud font-extrabold text-4xl sm:text-5xl uppercase tracking-tight text-[#F4F5F7]">
              {title}
            </h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#F7B267]">
              Effective Date: {effectiveDate}
            </p>
          </div>
        </div>

        <article className="rounded-2xl bg-[#131720] border border-white/8 p-6 sm:p-8 space-y-6 text-sm text-[#8D96A5] leading-relaxed">
          {children}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
