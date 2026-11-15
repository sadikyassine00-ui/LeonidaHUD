export type HudTheme = "sunset-broadcast" | "minimal-glass" | "tactical-dark";

export type UserPlan = "free" | "pro";

export interface MissionItem {
  id: string;
  chapterNumber: number;
  chapterTitle: string;
  title: string;
  region: string;
  isCustom?: boolean;
}

export interface PollSnapshot {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  votesA: number;
  votesB: number;
  isActive: boolean;
  endsAt: string | null;
  createdAt: string;
}

export interface OverlayStateSnapshot {
  id: string;
  userId: string;
  publicKey: string;
  secretTriggerKey: string;
  theme: HudTheme;
  plan: UserPlan;
  twitchChannel: string | null;
  kickChannel: string | null;
  storyChapter: string;
  storyPercent: number;
  completedMissionIds: string[];
  customMissions: MissionItem[];
  wastedCount: number;
  bustedCount: number;
  cashBalance: number;
  showStoryWidget: boolean;
  showDeathWidget: boolean;
  showCashWidget: boolean;
  showPollWidget: boolean;
  stateVersion: number;
  updatedAt: string;
  activePoll: PollSnapshot | null;
}

export interface PresetPoll {
  id: string;
  label: string;
  question: string;
  optionA: string;
  optionB: string;
  durationSeconds: number;
}

export const PRESET_POLLS: PresetPoll[] = [
  {
    id: "armored-chase",
    label: "Armored Truck vs. 5-Star Chase",
    question: "NEXT MOVE?",
    optionA: "Rob the armored truck",
    optionB: "5-star police chase",
    durationSeconds: 60,
  },
  {
    id: "jet-safehouse",
    label: "Steal a Jet vs. Buy Safe House",
    question: "SPEND THE STASH?",
    optionA: "Steal a jet",
    optionB: "Buy safe house",
    durationSeconds: 60,
  },
  {
    id: "stealth-loud",
    label: "Quiet Approach vs. Heavy Entry",
    question: "HEIST APPROACH?",
    optionA: "Quiet breach",
    optionB: "Loud entry",
    durationSeconds: 45,
  },
  {
    id: "coastal-escape",
    label: "Speedboat vs. Muscle Car",
    question: "ESCAPE VEHICLE?",
    optionA: "Coastal speedboat",
    optionB: "Armored muscle car",
    durationSeconds: 45,
  },
];
