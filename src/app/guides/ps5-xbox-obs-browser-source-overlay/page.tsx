import type { Metadata } from "next";
import { GuideShell } from "@/components/guides/GuideShell";
import { SITE_URL } from "@/lib/site";

const PATH = "/guides/ps5-xbox-obs-browser-source-overlay";

export const metadata: Metadata = {
  title: "PS5 & Xbox OBS Browser Source Overlay Setup | Leonida HUD",
  description:
    "Set up a 1920x1080 OBS Browser Source overlay for PS5 and Xbox capture cards in 60 seconds. Track Story %, Cash, Wasted, and Busted from your phone.",
  alternates: {
    canonical: `${SITE_URL}${PATH}`,
  },
};

export default function Ps5XboxObsOverlayGuidePage() {
  const steps = [
    {
      num: "01",
      title: "Copy Your Private 1920x1080 Browser Source URL",
      body: "Sign in to Leonida HUD and open your Dashboard. Copy your unique overlay link. Each account gets one dedicated 1920x1080 transparent canvas that works with any PS5 or Xbox Series X|S capture card feed (Elgato, AVerMedia, or generic HDMI capture).",
    },
    {
      num: "02",
      title: "Add a Browser Source in OBS Studio",
      body: "In your OBS Scene, click the + button under Sources and pick Browser. Name it Leonida HUD, paste your overlay URL, set Width to 1920 and Height to 1080, and click OK. Keep it above your Video Capture Device layer so your counters sit cleanly over gameplay.",
    },
    {
      num: "03",
      title: "Open the Mobile Remote on Your Phone",
      body: "Scan the QR code or open /remote on your phone browser. Because console playthroughs run through HDMI capture without PC mods, your phone becomes the live controller. Tap Wasted +1, Busted +1, update Cash, or bump Story % without leaving your controller.",
    },
  ];

  return (
    <GuideShell
      eyebrow="OBS Setup Guide"
      title="PS5 & Xbox OBS Browser Source Overlay in 60 Seconds"
      intro="Console streamers capturing PS5 or Xbox Series X|S over HDMI cannot run PC memory mods. Drop one 1920x1080 Browser Source into OBS Studio and update Story %, Cash, Wasted, and Busted counters live from your phone."
      currentHref={PATH}
    >
      <section className="space-y-4">
        <h2 className="font-hud font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-[#F4F5F7]">
          What You Need Before Going Live
        </h2>
        <div className="rounded-2xl bg-[#131720] border border-white/8 p-5 space-y-2 text-sm text-[#8D96A5] leading-relaxed">
          <p>
            You do not need OBS plugins, EXE installers, or PC game mods. Any
            capture setup running OBS Studio on Windows or macOS with a PS5 or
            Xbox capture card works out of the box.
          </p>
          <p>
            Keep your OBS base canvas at 1920x1080 (or match your scaled output)
            so the four HUD corners align cleanly around your game UI.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-hud font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-[#F4F5F7]">
          Step-by-Step OBS Browser Source Setup
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
          Recommended OBS Layer Order
        </h2>
        <ul className="rounded-2xl bg-[#131720] border border-white/8 p-6 space-y-2.5 text-sm text-[#8D96A5] list-disc list-inside">
          <li>
            Top layer: <strong className="text-[#F4F5F7]">Leonida HUD</strong>{" "}
            (Browser Source, 1920x1080)
          </li>
          <li>
            Middle layer: <strong className="text-[#F4F5F7]">Facecam</strong>{" "}
            (positioned clear of the corner HUD card you enable)
          </li>
          <li>
            Bottom layer:{" "}
            <strong className="text-[#F4F5F7]">PS5 / Xbox Capture Card</strong>{" "}
            (Video Capture Device)
          </li>
        </ul>
      </section>
    </GuideShell>
  );
}
