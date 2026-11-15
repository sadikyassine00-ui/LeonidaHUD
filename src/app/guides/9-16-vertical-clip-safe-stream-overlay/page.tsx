import type { Metadata } from "next";
import { GuideShell } from "@/components/guides/GuideShell";
import { SITE_URL } from "@/lib/site";

const PATH = "/guides/9-16-vertical-clip-safe-stream-overlay";

export const metadata: Metadata = {
  title: "9:16 Vertical Clip-Safe Stream Overlay Guide | Leonida HUD",
  description:
    "Stop TikTok, YouTube Shorts, Reels, and Whop clippers from cropping your stream HUD. Use 9:16 Clip-Safe mode and a Top Hook Banner in OBS Studio.",
  alternates: {
    canonical: `${SITE_URL}${PATH}`,
  },
};

export default function ClipSafeVerticalGuidePage() {
  const steps = [
    {
      num: "01",
      title: "Why Standard 16:9 Overlays Break in Vertical Clips",
      body: "Most stream overlays anchor stats to the far left and right edges of a 1920x1080 frame. When you or a clipper crop the center 608x1080 slice for TikTok, Instagram Reels, YouTube Shorts, or Whop campaigns, those corner counters get sliced off completely.",
    },
    {
      num: "02",
      title: "Flip 9:16 Clip-Safe Mode in One Click",
      body: "Inside your Leonida HUD Dashboard or Mobile Remote, toggle 9:16 Clip-Safe Mode on. Every active widget (Story %, Cash, Wasted, Busted, and Poll cards) snaps inside the center vertical safe zone so editors never lose your run context.",
    },
    {
      num: "03",
      title: "Add a Top Hook Banner for Scroll-Stopping Clips",
      body: "Use the built-in Top Hook Banner field to write a short challenge line like 'NO DEATHS STORY RUN' or 'DAY 1 CONSOLE LAUNCH'. It sits cleanly above the center action area inside vertical crops without covering gameplay.",
    },
  ];

  return (
    <GuideShell
      eyebrow="Vertical Clipping Guide"
      title="9:16 Clip-Safe Stream Overlay for TikTok, Reels & Whop"
      intro="If your best console moments are getting clipped for TikTok, YouTube Shorts, Reels, or Whop, standard corner overlays get cut off. Keep your counters and challenge context locked inside the center 9:16 frame."
      currentHref={PATH}
    >
      <section className="space-y-4">
        <h2 className="font-hud font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-[#F4F5F7]">
          How 9:16 Clip-Safe Mode Works
        </h2>
        <div className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.num}
              className="rounded-2xl bg-[#131720] border border-white/8 p-6 flex flex-col sm:flex-row gap-4"
            >
              <div className="font-hud font-extrabold text-3xl text-[#F7B267] tabular-nums shrink-0">
                {step.num}
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-[#F4F5F7]">
                  {step.title}
                </h3>
                <p className="text-sm text-[#8D96A5] leading-relaxed">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-hud font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-[#F4F5F7]">
          Clean Broadcast Look with Zero Watermark
        </h2>
        <div className="rounded-2xl bg-[#131720] border border-white/8 p-6 space-y-2 text-sm text-[#8D96A5] leading-relaxed">
          <p>
            Clip-Safe Mode, the Top Hook Banner, and Zero Watermark mode are
            included in the $49 one-time Pro Broadcaster Launch Pass (or $29/mo).
          </p>
          <p>
            That means your vertical exports look native to your channel with no
            third-party branding in the bottom corner.
          </p>
        </div>
      </section>
    </GuideShell>
  );
}
