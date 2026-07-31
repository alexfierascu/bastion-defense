/**
 * Campaign progress helpers — unlock graph, clears, profile.
 */

import { CAMPAIGN, getMission, MissionDef, MissionRewards } from '../config/campaign';
import { DifficultyId } from '../config/difficulty';
import { HeroId } from '../config/heroes';
import { TowerType } from '../config/towers';

export interface MissionClearRecord {
  bestWave: number;
  difficulty: DifficultyId;
  clearedAt: number;
  score: number;
}

export interface PlayerProfile {
  displayName: string;
  createdAt: number;
  missionsCleared: number;
  campaignComplete: boolean;
}

export interface CampaignProgressData {
  campaignId: string;
  /** Missions the player may attempt. */
  unlockedMissions: string[];
  /** Cleared mission records. */
  cleared: Record<string, MissionClearRecord>;
  /** Suggested next mission (animated marker). */
  currentMissionId: string;
  unlockedHeroes: HeroId[];
  profile: PlayerProfile;
}

export function defaultCampaignProgress(): CampaignProgressData {
  const start = CAMPAIGN.startingMissionId;
  return {
    campaignId: CAMPAIGN.id,
    unlockedMissions: [start],
    cleared: {},
    currentMissionId: start,
    unlockedHeroes: ['warden'],
    profile: {
      displayName: 'Warden',
      createdAt: Date.now(),
      missionsCleared: 0,
      campaignComplete: false,
    },
  };
}

export function isMissionUnlocked(progress: CampaignProgressData, missionId: string): boolean {
  if (progress.unlockedMissions.includes(missionId)) return true;
  const m = getMission(missionId);
  if (!m) return false;
  if (m.requires.length === 0) return true;
  return m.requires.every((id) => !!progress.cleared[id]);
}

export function isMissionCleared(progress: CampaignProgressData, missionId: string): boolean {
  return !!progress.cleared[missionId];
}

/** After a win — record clear, apply unlocks, advance current marker. */
export function applyMissionVictory(
  progress: CampaignProgressData,
  mission: MissionDef,
  difficulty: DifficultyId,
  wave: number,
  score: number,
): {
  progress: CampaignProgressData;
  rewards: MissionRewards;
  newlyUnlocked: string[];
} {
  const next: CampaignProgressData = {
    ...progress,
    unlockedMissions: [...progress.unlockedMissions],
    cleared: { ...progress.cleared },
    unlockedHeroes: [...progress.unlockedHeroes],
    profile: { ...progress.profile },
  };

  const prev = next.cleared[mission.id];
  next.cleared[mission.id] = {
    bestWave: Math.max(prev?.bestWave ?? 0, wave),
    difficulty,
    clearedAt: Date.now(),
    score: Math.max(prev?.score ?? 0, score),
  };
  if (!prev) next.profile.missionsCleared += 1;

  const newlyUnlocked: string[] = [];
  const rewards = mission.rewards;

  for (const id of rewards.unlockMissions ?? []) {
    if (!next.unlockedMissions.includes(id)) {
      next.unlockedMissions.push(id);
      newlyUnlocked.push(id);
    }
  }

  // Also unlock any mission whose requires are now fully satisfied
  for (const m of CAMPAIGN.missions) {
    if (next.unlockedMissions.includes(m.id)) continue;
    if (m.requires.length && m.requires.every((r) => !!next.cleared[r])) {
      next.unlockedMissions.push(m.id);
      newlyUnlocked.push(m.id);
    }
  }

  for (const h of rewards.unlockHeroes ?? []) {
    if (!next.unlockedHeroes.includes(h)) next.unlockedHeroes.push(h);
  }

  // Advance marker to first uncleared unlocked mission
  const nextMission =
    newlyUnlocked[0] ??
    next.unlockedMissions.find((id) => !next.cleared[id]) ??
    mission.id;
  next.currentMissionId = nextMission;

  const allDone = CAMPAIGN.missions.every((m) => !!next.cleared[m.id]);
  next.profile.campaignComplete = allDone;

  return { progress: next, rewards, newlyUnlocked };
}

export function recommendedMission(progress: CampaignProgressData): MissionDef {
  const cur = getMission(progress.currentMissionId);
  if (cur && isMissionUnlocked(progress, cur.id) && !progress.cleared[cur.id]) return cur;
  for (const id of progress.unlockedMissions) {
    if (!progress.cleared[id]) {
      const m = getMission(id);
      if (m) return m;
    }
  }
  return getMission(CAMPAIGN.startingMissionId)!;
}
