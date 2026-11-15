import type { MissionItem } from "@/lib/types";

export const DEFAULT_MISSIONS: MissionItem[] = [
  // Chapter 1: Welcome to Leonida
  {
    id: "ch1-m1",
    chapterNumber: 1,
    chapterTitle: "Chapter 1: Welcome to Leonida",
    title: "Coastal Arrival & Safe House Check",
    region: "Ocean Causeway",
  },
  {
    id: "ch1-m2",
    chapterNumber: 1,
    chapterTitle: "Chapter 1: Welcome to Leonida",
    title: "Midnight Repo on South Boulevard",
    region: "Coral Strip",
  },
  {
    id: "ch1-m3",
    chapterNumber: 1,
    chapterTitle: "Chapter 1: Welcome to Leonida",
    title: "Burner Phone Handshake",
    region: "Harbor District",
  },
  {
    id: "ch1-m4",
    chapterNumber: 1,
    chapterTitle: "Chapter 1: Welcome to Leonida",
    title: "First Score at the Pawn Vault",
    region: "Palm Alley",
  },

  // Chapter 2: Saltwater Hustle
  {
    id: "ch2-m1",
    chapterNumber: 2,
    chapterTitle: "Chapter 2: Saltwater Hustle",
    title: "Dockside Container Sweep",
    region: "Port Leonida",
  },
  {
    id: "ch2-m2",
    chapterNumber: 2,
    chapterTitle: "Chapter 2: Saltwater Hustle",
    title: "Interceptor Highway Run",
    region: "Interstate 95",
  },
  {
    id: "ch2-m3",
    chapterNumber: 2,
    chapterTitle: "Chapter 2: Saltwater Hustle",
    title: "Nightclub Ledger Extraction",
    region: "Neon Marina",
  },
  {
    id: "ch2-m4",
    chapterNumber: 2,
    chapterTitle: "Chapter 2: Saltwater Hustle",
    title: "Coastline Smuggler Drop",
    region: "Key Shoals",
  },

  // Chapter 3: Everglades Signal
  {
    id: "ch3-m1",
    chapterNumber: 3,
    chapterTitle: "Chapter 3: Everglades Signal",
    title: "Airboat Convoy Ambush",
    region: "Sawgrass Basin",
  },
  {
    id: "ch3-m2",
    chapterNumber: 3,
    chapterTitle: "Chapter 3: Everglades Signal",
    title: "Relay Tower Override",
    region: "Cypress Ridge",
  },
  {
    id: "ch3-m3",
    chapterNumber: 3,
    chapterTitle: "Chapter 3: Everglades Signal",
    title: "Blackout at the Airstrip",
    region: "Gator Flats",
  },
  {
    id: "ch3-m4",
    chapterNumber: 3,
    chapterTitle: "Chapter 3: Everglades Signal",
    title: "Armored Van Hijack",
    region: "State Route 27",
  },

  // Chapter 4: High-Rise Syndicate
  {
    id: "ch4-m1",
    chapterNumber: 4,
    chapterTitle: "Chapter 4: High-Rise Syndicate",
    title: "Penthouse Keycard Swap",
    region: "Bayfront Towers",
  },
  {
    id: "ch4-m2",
    chapterNumber: 4,
    chapterTitle: "Chapter 4: High-Rise Syndicate",
    title: "Rooftop Chopper Escape",
    region: "Downtown Core",
  },
  {
    id: "ch4-m3",
    chapterNumber: 4,
    chapterTitle: "Chapter 4: High-Rise Syndicate",
    title: "Crypto Vault Decryption",
    region: "Brickell Mile",
  },
  {
    id: "ch4-m4",
    chapterNumber: 4,
    chapterTitle: "Chapter 4: High-Rise Syndicate",
    title: "Yacht Basin Takedown",
    region: "Starfish Pier",
  },

  // Chapter 5: Heat Wave
  {
    id: "ch5-m1",
    chapterNumber: 5,
    chapterTitle: "Chapter 5: Heat Wave",
    title: "Federal Evidence Wipe",
    region: "Civic Plaza",
  },
  {
    id: "ch5-m2",
    chapterNumber: 5,
    chapterTitle: "Chapter 5: Heat Wave",
    title: "Bridge Blockade Breakout",
    region: "Bay Causeway",
  },
  {
    id: "ch5-m3",
    chapterNumber: 5,
    chapterTitle: "Chapter 5: Heat Wave",
    title: "Double-Cross at the Marina",
    region: "Pelican Cove",
  },
  {
    id: "ch5-m4",
    chapterNumber: 5,
    chapterTitle: "Chapter 5: Heat Wave",
    title: "Cargo Plane Intercept",
    region: "Southern Runway",
  },

  // Chapter 6: Sunset Protocol
  {
    id: "ch6-m1",
    chapterNumber: 6,
    chapterTitle: "Chapter 6: Sunset Protocol",
    title: "Reserve Bank Blueprint",
    region: "Financial Row",
  },
  {
    id: "ch6-m2",
    chapterNumber: 6,
    chapterTitle: "Chapter 6: Sunset Protocol",
    title: "The Grand Reserve Vault",
    region: "Financial Row",
  },
  {
    id: "ch6-m3",
    chapterNumber: 6,
    chapterTitle: "Chapter 6: Sunset Protocol",
    title: "Offshore Speedboat Run",
    region: "Deep Water Channel",
  },
  {
    id: "ch6-m4",
    chapterNumber: 6,
    chapterTitle: "Chapter 6: Sunset Protocol",
    title: "Final Dawn Over Leonida",
    region: "Key Horizon",
  },
];

export function calculateStoryProgress(
  completedMissionIds: string[],
  customMissions: MissionItem[] = []
): { storyPercent: number; storyChapter: string } {
  const allMissions = [...DEFAULT_MISSIONS, ...customMissions];
  if (allMissions.length === 0) {
    return { storyPercent: 0, storyChapter: "Chapter 1: Welcome to Leonida" };
  }

  const completedSet = new Set(completedMissionIds);
  const completedCount = allMissions.filter((m) => completedSet.has(m.id)).length;
  const storyPercent = Math.min(
    100,
    Math.round((completedCount / allMissions.length) * 100)
  );

  // Pick the first incomplete mission's chapter, or the last completed chapter if all are done
  const nextMission = allMissions.find((m) => !completedSet.has(m.id));
  if (nextMission) {
    return {
      storyPercent,
      storyChapter: nextMission.chapterTitle,
    };
  }

  const lastMission = allMissions[allMissions.length - 1];
  return {
    storyPercent: 100,
    storyChapter: lastMission.chapterTitle,
  };
}
