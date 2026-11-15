import type { Metadata } from "next";
import {
  Plus_Jakarta_Sans,
  Barlow_Condensed,
  Poppins,
  Inter,
} from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-hud",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["700", "800"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Leonida HUD: Live OBS Overlay for PS5 & Xbox Streamers",
  description:
    "Live PS5 and Xbox Series X|S HUD widgets controlled from your phone, Stream Deck, or Twitch and Kick chat polls.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Leonida HUD | Live Broadcast Overlay & Mobile Remote",
    description:
      "Drop one Browser Source into OBS and control your Story %, Cash counter, Wasted/Busted tallies, and live chat polls from your phone or Stream Deck.",
    images: [{ url: "/icons/og-card-1200x630.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Leonida HUD | Live Broadcast Overlay & Mobile Remote",
    description:
      "Live PS5 and Xbox OBS overlays controlled from your phone or Stream Deck.",
    images: ["/icons/og-card-1200x630.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${barlowCondensed.variable} ${poppins.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0B0D12] text-[#F4F5F7] font-sans selection:bg-[#F25C54]/30 selection:text-[#F4F5F7]">
        {children}
      </body>
    </html>
  );
}
