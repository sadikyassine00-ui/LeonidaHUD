export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://leonidahud.vercel.app"
).replace(/\/+$/, "");

export interface GuideLink {
  href: string;
  title: string;
  shortTitle: string;
  description: string;
}

export const GUIDE_LINKS: GuideLink[] = [
  {
    href: "/guides/ps5-xbox-obs-browser-source-overlay",
    title: "PS5 & Xbox OBS Browser Source Overlay Setup",
    shortTitle: "PS5 & Xbox OBS Overlay Setup",
    description:
      "Add a 1920x1080 Browser Source overlay to OBS for PS5 and Xbox capture cards in 60 seconds with zero PC mods.",
  },
  {
    href: "/guides/9-16-vertical-clip-safe-stream-overlay",
    title: "9:16 Vertical Clip-Safe Stream Overlay Guide",
    shortTitle: "9:16 Clip-Safe Vertical HUD",
    description:
      "Keep Story %, Cash, and hook banners centered inside TikTok, Reels, YouTube Shorts, and Whop 9:16 vertical crops.",
  },
  {
    href: "/guides/stream-deck-twitch-kick-chat-polls",
    title: "Stream Deck & Twitch/Kick Chat Polls Setup",
    shortTitle: "Stream Deck & Chat Polls",
    description:
      "Trigger instant Wasted, Busted, and cash updates from Elgato Stream Deck buttons and run automated !A / !B viewer polls.",
  },
];
