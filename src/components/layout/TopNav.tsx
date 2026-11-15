import Link from "next/link";
import { Layers, SlidersHorizontal, Smartphone } from "lucide-react";
import { SlicedSunMark } from "@/components/neon/SlicedSun";

interface TopNavProps {
  activePath?: "/" | "/dashboard" | "/remote" | "/dashboard/vision" | "/studio";
  isSignedIn?: boolean;
}

export function TopNav({ activePath = "/", isSignedIn = false }: TopNavProps) {
  const navItems: Array<{
    href: "/studio" | "/dashboard" | "/remote";
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      href: "/studio",
      label: "Neon Studio",
      icon: <Layers className="w-4 h-4" />,
    },
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
    <header className="sticky top-0 z-40 border-b border-[#7846AA]/35 bg-[#11072B]/92 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <SlicedSunMark size={42} />
          <div className="leading-none">
            <div
              className="chroma-wordmark text-xl sm:text-2xl"
              data-text="LEONIDA HUD"
            >
              <span>LEONIDA HUD</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#B9A8DA]">
              Broadcast Viewfinder
            </div>
          </div>
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
                    ? "bg-[#1B0B3A] text-[#19E3C6] border border-[#19E3C6]/50"
                    : "text-[#B9A8DA] hover:text-[#F6F2FF]"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/controller"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#1B0B3A] border border-[#19E3C6]/45 hover:border-[#19E3C6] px-3.5 py-2 text-sm font-semibold text-[#19E3C6] transition-colors"
          >
            <Smartphone className="w-4 h-4" />
            <span>Open Controller</span>
          </Link>
          <Link
            href={isSignedIn ? "/dashboard" : "/signin"}
            className="inline-flex items-center rounded-xl bg-[#FF3D7F] hover:opacity-95 px-4 py-2 text-sm font-extrabold text-[#F6F2FF] neon-glow-pink transition-opacity"
          >
            {isSignedIn ? "Setup Hub" : "Launch Free Overlay"}
          </Link>
        </div>
      </div>
    </header>
  );
}
