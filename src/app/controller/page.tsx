import type { Metadata } from "next";
import { NeonControllerApp } from "@/components/neon/NeonControllerApp";

export const metadata: Metadata = {
  title: "Controller | Leonida HUD",
  description:
    "Mobile-first broadcast controller for Leonida HUD OBS overlays.",
};

export default function ControllerPage() {
  return <NeonControllerApp />;
}
