import type { Metadata } from "next";
import { GuideShell } from "@/components/guides/GuideShell";
import { SITE_URL } from "@/lib/site";

const PATH = "/guides/stream-deck-twitch-kick-chat-polls";

export const metadata: Metadata = {
  title: "Stream Deck & Twitch/Kick Chat Polls Setup | Leonida HUD",
  description:
    "Trigger instant Wasted, Busted, and cash updates with Elgato Stream Deck URL actions and run automated !A / !B viewer polls on Twitch and Kick.",
  alternates: {
    canonical: `${SITE_URL}${PATH}`,
  },
};

export default function StreamDeckAndPollsGuidePage() {
  const steps = [
    {
      num: "01",
      title: "Bind Elgato Stream Deck Buttons in Seconds",
      body: "Open your Leonida HUD Dashboard and copy the pre-built trigger URLs for Wasted +1, Busted +1, Cash +$500, or Story % +1%. In the Elgato Stream Deck app, drag a Website action onto any key, paste the trigger URL, and enable GET request in background so no browser tab opens.",
    },
    {
      num: "02",
      title: "Connect Twitch or Kick Chat for Live Polls",
      body: "Enter your Twitch or Kick channel name in the Dashboard or Mobile Remote. Type a quick question with Option A and Option B (for example: 'Steal the jet or take the boat?') and set your timer.",
    },
    {
      num: "03",
      title: "Let Chat Vote with !A and !B",
      body: "As soon as you launch the poll, the poll card slides onto your OBS Browser Source. Viewers type !A or !B in Twitch or Kick chat, live vote bars update on screen, and the card clears automatically when the timer ends.",
    },
  ];

  return (
    <GuideShell
      eyebrow="Hardware & Chat Automation"
      title="Stream Deck Triggers & Automated Twitch / Kick Polls"
      intro="Keep your hands on the controller during launch week. Trigger instant counter updates from an Elgato Stream Deck or phone, and let Twitch and Kick viewers vote directly on your stream HUD with !A and !B."
      currentHref={PATH}
    >
      <section className="space-y-4">
        <h2 className="font-hud font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-[#F4F5F7]">
          Set Up Stream Deck Keys &amp; Live Chat Polls
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
          No Stream Deck? Use the Mobile Remote or OBS Dock
        </h2>
        <div className="rounded-2xl bg-[#131720] border border-white/8 p-6 space-y-2 text-sm text-[#8D96A5] leading-relaxed">
          <p>
            Every trigger available on Stream Deck also lives inside the
            thumb-friendly Mobile Remote at <code>/remote</code>.
          </p>
          <p>
            You can also add <code>/remote</code> as a Custom Browser Dock in
            OBS Studio if you want one-click counter controls right next to your
            scene switcher.
          </p>
        </div>
      </section>
    </GuideShell>
  );
}
