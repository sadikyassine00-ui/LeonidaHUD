import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Check,
  Crown,
  MessageSquare,
  Monitor,
  Smartphone,
  SmartphoneNfc,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { LandingHeroSandbox } from "@/components/landing/LandingHeroSandbox";
import { PaddleUpgradeButtons } from "@/components/billing/PaddleUpgradeButtons";
import { auth } from "@/auth";
import { getUserBillingInfo } from "@/lib/overlay-service";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Leonida HUD: Live OBS Overlay for PS5 & Xbox Streamers",
  description:
    "Add live Story %, Cash, Wasted/Busted counters, and Twitch or Kick chat polls to PS5 and Xbox OBS streams in 60 seconds. Control from phone or Stream Deck.",
  alternates: {
    canonical: `${SITE_URL}/`,
  },
};

export const dynamic = "force-dynamic";

const HOME_FAQS = [
  {
    question: "Does Leonida HUD work with PS5 and Xbox capture cards?",
    answer:
      "Yes, works with Elgato, AVerMedia, and any capture card feeding into OBS Studio as a standard 1920x1080 Browser Source.",
  },
  {
    question: "Do I need PC mods or software downloads?",
    answer:
      "No downloads, plugins, or EXE files. Paste one Browser Source URL into OBS and control everything from your phone browser or Stream Deck.",
  },
  {
    question: "How does 9:16 Vertical Clip-Safe Mode work?",
    answer:
      "Flip one toggle in your dashboard to stack your counters and Top Hook Banner inside a vertical frame so TikTok, Reels, and Whop clippers never crop out your HUD.",
  },
  {
    question:
      "What is the difference between Free Starter and the $49 Launch Pass?",
    answer:
      "Free Starter gives you all 4 HUD widgets, phone control, Stream Deck triggers, and chat polls with a small bottom corner watermark. The $49 one-time Launch Pass removes the watermark permanently and unlocks 9:16 Clip-Safe Mode, Top Hook Banners, custom themes, and editable chapter checklists.",
  },
];

const SOFTWARE_APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Leonida HUD",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web, OBS Studio, Windows, macOS",
  url: `${SITE_URL}/`,
  description:
    "Live OBS Browser Source overlay and mobile/Stream Deck remote for PS5 and Xbox console streamers.",
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "0",
      priceCurrency: "USD",
    },
    {
      "@type": "Offer",
      name: "Pro Broadcaster Launch Pass",
      price: "49",
      priceCurrency: "USD",
    },
  ],
};

const FAQ_PAGE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HOME_FAQS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;
  const billing = userId ? await getUserBillingInfo(userId) : null;

  const features = [
    {
      icon: <Smartphone className="w-5 h-5 text-[#F25C54]" />,
      title: "Phone & Stream Deck Control",
      description:
        "Tap Wasted +1, Busted +1, or update your cash balance from your phone browser or Stream Deck without alt-tabbing out of your capture preview.",
    },
    {
      icon: <SmartphoneNfc className="w-5 h-5 text-[#F7B267]" />,
      title: "9:16 Vertical Clip-Safe Mode",
      description:
        "Running TikTok, Reels, or Whop clipping campaigns? Flip one switch to stack your HUD inside a vertical frame so editors never crop out your counters or hook banner.",
    },
    {
      icon: <MessageSquare className="w-5 h-5 text-[#2EC4B6]" />,
      title: "Automated Twitch & Kick Polls",
      description:
        "Type a question and let chat vote with !A or !B. The poll card slides onto your stream automatically, tallies live votes, and clears when time is up.",
    },
    {
      icon: <Monitor className="w-5 h-5 text-[#F25C54]" />,
      title: "60-Second OBS Setup",
      description:
        "No plugins, no EXE installers, and zero frame drops. Paste one 1920x1080 Browser Source link into OBS and you are live.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0D12] text-[#F4F5F7] flex flex-col">
      <TopNav activePath="/" isSignedIn={Boolean(userId)} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
          <div className="min-h-[calc(100svh-15rem)] py-12 sm:py-16 flex flex-col items-center justify-center text-center max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#131720] border border-white/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#F7B267]">
              <span className="w-2 h-2 rounded-full bg-[#F25C54]" />
              <span>Ready for the November 19, 2026 Console Launch</span>
            </div>

            <h1 className="font-hud font-extrabold text-5xl sm:text-6xl lg:text-7xl uppercase tracking-tight leading-[0.95] text-[#F4F5F7]">
              Console Streamers Don&apos;t Get PC Mods. Run Live Story &amp; Cash
              HUDs Anyway.
            </h1>

            <p className="text-base sm:text-lg text-[#8D96A5] max-w-2xl mx-auto leading-relaxed">
              Built for PS5 and Xbox capture card setups. Drop one Browser
              Source into OBS and control your Story %, Cash counter,
              Wasted/Busted tallies, and live chat polls straight from your
              phone or Stream Deck.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href={userId ? "/dashboard" : "/signin"}
                className="h-12 px-6 rounded-xl bg-[#F25C54] hover:bg-[#F25C54]/90 text-white font-extrabold text-sm inline-flex items-center gap-2 transition-colors"
              >
                <span>Launch Free Overlay</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#live-sandbox"
                className="h-12 px-5 rounded-xl bg-[#131720] border border-white/12 hover:border-white/25 text-[#F4F5F7] font-bold text-sm inline-flex items-center gap-2 transition-colors"
              >
                <ArrowDown className="w-4 h-4 text-[#2EC4B6]" />
                <span>Test Live Demo Below</span>
              </a>
            </div>
          </div>

          {/* Interactive Live Sandbox (peeks from bottom of initial viewport) */}
          <div id="live-sandbox" className="scroll-mt-24">
            <LandingHeroSandbox />
          </div>
        </section>

        {/* Feature Grid */}
        <section className="border-t border-white/8 bg-[#0E1118] py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
            <div className="max-w-2xl space-y-2">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#F7B267]">
                BUILT FOR LAUNCH NIGHT
              </div>
              <h2 className="font-hud font-extrabold text-4xl sm:text-5xl uppercase tracking-wide">
                EVERYTHING YOU NEED ON STREAM. NOTHING IN YOUR WAY.
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {features.map((feat) => (
                <div
                  key={feat.title}
                  className="broadcast-card rounded-2xl p-6 space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#0B0D12] border border-white/10 flex items-center justify-center">
                    {feat.icon}
                  </div>
                  <h3 className="font-hud font-extrabold text-2xl uppercase tracking-wide text-[#F4F5F7]">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-[#8D96A5] leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="border-t border-white/8 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
            <div className="text-center space-y-2">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#2EC4B6]">
                STRAIGHTFORWARD PRICING
              </div>
              <h2 className="font-hud font-extrabold text-4xl sm:text-5xl uppercase tracking-wide">
                START FREE. UPGRADE FOR CLEAN STREAMS.
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Starter Free */}
              <div className="broadcast-card rounded-2xl p-7 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-hud font-extrabold text-3xl uppercase text-[#F4F5F7]">
                      Starter
                    </span>
                    <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-[#8D96A5]">
                      FREE FOREVER
                    </span>
                  </div>
                  <div className="font-hud font-extrabold text-5xl text-[#F4F5F7]">
                    $0
                  </div>
                  <ul className="space-y-2.5 text-sm text-[#8D96A5]">
                    {[
                      "All 4 modular OBS corner widgets",
                      "Mobile Remote & 350px OBS Browser Dock",
                      "Elgato Stream Deck button triggers",
                      "Twitch & Kick live chat polls",
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-[#2EC4B6] shrink-0 mt-0.5" />
                        <span>{line}</span>
                      </li>
                    ))}
                    <li className="flex items-start gap-2.5 text-[#F7B267]/90 font-medium">
                      <Check className="w-4 h-4 text-[#F7B267] shrink-0 mt-0.5" />
                      <span>Includes bottom-corner LEONIDAHUD.COM watermark</span>
                    </li>
                  </ul>
                </div>

                <Link
                  href={userId ? "/dashboard" : "/signin"}
                  className="h-12 rounded-xl bg-[#1C2230] border border-white/12 hover:border-white/30 text-[#F4F5F7] font-extrabold text-sm flex items-center justify-center transition-colors"
                >
                  {userId ? "Open Setup Hub" : "Start Free Account"}
                </Link>
              </div>

              {/* Pro Broadcaster */}
              <div className="rounded-2xl p-7 bg-[#131720] border border-[#F25C54]/45 flex flex-col justify-between space-y-6 shadow-xl shadow-[#F25C54]/5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-hud font-extrabold text-3xl uppercase flex items-center gap-2 text-[#F4F5F7]">
                      <Crown className="w-6 h-6 text-[#F7B267]" />
                      <span>Pro Broadcaster</span>
                    </span>
                    <span className="rounded-full bg-[#F7B267] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#0B0D12] shrink-0">
                      LAUNCH PASS
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-hud font-extrabold text-5xl text-[#F4F5F7]">
                        $49
                      </span>
                      <span className="text-base font-semibold text-[#8D96A5]">
                        one-time
                      </span>
                    </div>
                    <p className="text-[13px] text-[#8D96A5]">
                      Pay once. Own it for your entire playthrough. (Or $29/mo)
                    </p>
                  </div>
                  <ul className="space-y-2.5 text-sm text-[#F4F5F7]">
                    {[
                      "Zero Watermark: Remove LEONIDAHUD.COM for a 100% clean, native broadcast look",
                      "9:16 Clip-Safe Mode + Top Hook Banner: Keep counters and context locked inside TikTok, Reels, and Whop vertical crops",
                      "Custom Broadcast Themes: Switch between Minimal Glass and Tactical Dark presets in one click",
                      "Custom Chapter & Mission Checklists: Edit objectives live for speedruns, 100% completion runs, or subathons",
                      "Unlimited Stream Deck & Mobile Triggers: Instant zero-latency updates from your phone or macro pad",
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-[#F25C54] shrink-0 mt-0.5" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <PaddleUpgradeButtons
                  userId={userId}
                  userEmail={billing?.email ?? session?.user?.email ?? undefined}
                  currentPlan={billing?.plan ?? "free"}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section
          id="faq"
          className="border-t border-white/8 py-16 px-4 sm:px-6"
        >
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-[#F7B267]">
                FAQ
              </div>
              <h2 className="font-hud font-extrabold text-3xl sm:text-4xl uppercase tracking-tight text-[#F4F5F7]">
                Console Capture &amp; OBS Questions
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {HOME_FAQS.map((item) => (
                <div
                  key={item.question}
                  className="rounded-2xl bg-[#131720] border border-white/8 p-5 space-y-2"
                >
                  <h3 className="text-sm font-bold text-[#F4F5F7]">
                    {item.question}
                  </h3>
                  <p className="text-sm text-[#8D96A5] leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(SOFTWARE_APP_JSON_LD),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(FAQ_PAGE_JSON_LD),
        }}
      />

      <SiteFooter />
    </div>
  );
}
