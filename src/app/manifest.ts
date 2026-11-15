import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leonida HUD",
    short_name: "Leonida HUD",
    description:
      "Live PS5 and Xbox OBS overlays controlled from your phone or Stream Deck.",
    start_url: "/remote",
    display: "standalone",
    background_color: "#0B0D12",
    theme_color: "#0B0D12",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
