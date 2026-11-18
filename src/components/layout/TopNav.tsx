import Image from "next/image";
import Link from "next/link";
import { SlidersHorizontal, Smartphone } from "lucide-react";

interface TopNavProps {
  activePath?: "/" | "/dashboard" | "/remote" | "/dashboard/vision";
  isSignedIn?: boolean;
}

export function TopNav({ activePath = "/", isSignedIn = false }: TopNavProps) {
  const navItems: Array<{
    href: "/" | "/dashboard" | "/remote";
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: <SlidersHorizontal className="w-4 h-4" />,
    },
    {
      href: "/remote",
      label: "Mobile Remote",
      icon: <Smartphone className="w-4 h-4" />,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0B0D12]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/logos/leonida-hud-logo-cropped.png"
            alt="Leonida HUD"
            width={200}
            height={69}
            className="h-9 sm:h-12 md:h-14 w-auto object-contain"
            priority
          />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const active = activePath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#131720] text-[#F4F5F7] border border-white/12"
                    : "text-[#8D96A5] hover:text-[#F4F5F7]"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/remote"
            aria-label="Open Mobile Remote"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#131720] border border-white/10 hover:border-white/25 px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#F4F5F7] transition-colors"
          >
            <Smartphone className="w-4 h-4 text-[#2EC4B6]" />
            <span className="hidden sm:inline">Open Remote</span>
          </Link>
          <Link
            href={isSignedIn ? "/dashboard" : "/signin"}
            className="inline-flex items-center rounded-xl bg-[#F25C54] hover:bg-[#F25C54]/90 px-3 sm:px-4 py-2 text-xs sm:text-sm font-extrabold text-white transition-colors whitespace-nowrap"
          >
            {isSignedIn ? "Setup Hub" : "Launch Free Overlay"}
          </Link>
        </div>
      </div>
    </header>
  );
}
