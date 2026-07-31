/**
 * Campaign mission-type runtime — real objectives, not labels only.
 */

import { MissionDef, MissionType } from '../config/campaign';

export interface MissionRuntime {
  type: MissionType;
  /** Village integrity for Protect Villagers (0 = fail). */
  villageHp: number;
  villageMax: number;
  /** Escort caravan HP. */
  caravanHp: number;
  caravanMax: number;
  /** 0–1 caravan road progress. */
  caravanProgress: number;
  /** Multi-gate: fronts still holding (display). */
  frontsHolding: number;
  failed: boolean;
  failReason: string;
}

export function createMissionRuntime(mission: MissionDef | null): MissionRuntime | null {
  if (!mission) return null;
  switch (mission.type) {
    case 'protectVillagers':
      return {
        type: mission.type,
        villageHp: 12,
        villageMax: 12,
        caravanHp: 0,
        caravanMax: 0,
        caravanProgress: 0,
        frontsHolding: 1,
        failed: false,
        failReason: '',
      };
    case 'escort':
      return {
        type: mission.type,
        villageHp: 0,
        villageMax: 0,
        caravanHp: 10,
        caravanMax: 10,
        caravanProgress: 0,
        frontsHolding: 1,
        failed: false,
        failReason: '',
      };
    case 'multiGate':
      return {
        type: mission.type,
        villageHp: 0,
        villageMax: 0,
        caravanHp: 0,
        caravanMax: 0,
        caravanProgress: 0,
        frontsHolding: 2,
        failed: false,
        failReason: '',
      };
    default:
      return {
        type: mission.type,
        villageHp: 0,
        villageMax: 0,
        caravanHp: 0,
        caravanMax: 0,
        caravanProgress: 0,
        frontsHolding: 1,
        failed: false,
        failReason: '',
      };
  }
}

/** Extra life damage multiplier / side effects on leak. */
export function applyMissionLeak(
  rt: MissionRuntime,
  baseLeakDmg: number,
): { lifeDamage: number; toast?: string } {
  if (rt.failed) return { lifeDamage: baseLeakDmg };

  switch (rt.type) {
    case 'protectVillagers': {
      const hit = Math.max(1, baseLeakDmg);
      rt.villageHp = Math.max(0, rt.villageHp - hit);
      if (rt.villageHp <= 0) {
        rt.failed = true;
        rt.failReason = 'The village was overrun.';
      }
      return {
        lifeDamage: Math.max(1, Math.ceil(baseLeakDmg * 0.5)),
        toast:
          rt.villageHp > 0
            ? `Village integrity ${rt.villageHp}/${rt.villageMax}`
            : 'Village fallen!',
      };
    }
    case 'escort': {
      const hit = Math.max(1, baseLeakDmg);
      rt.caravanHp = Math.max(0, rt.caravanHp - hit);
      if (rt.caravanHp <= 0) {
        rt.failed = true;
        rt.failReason = 'The caravan was destroyed.';
      }
      return {
        lifeDamage: baseLeakDmg,
        toast:
          rt.caravanHp > 0
            ? `Caravan ${rt.caravanHp}/${rt.caravanMax} · Road ${Math.round(rt.caravanProgress * 100)}%`
            : 'Caravan lost!',
      };
    }
    case 'multiGate':
      // Holding two fronts — leaks hurt more
      return {
        lifeDamage: Math.max(1, Math.round(baseLeakDmg * 1.5)),
        toast: 'Breach on a secondary gate!',
      };
    default:
      return { lifeDamage: baseLeakDmg };
  }
}

export function onMissionWaveCleared(rt: MissionRuntime, waveGoal: number): void {
  if (rt.type === 'escort' && !rt.failed) {
    const step = 1 / Math.max(1, waveGoal);
    rt.caravanProgress = Math.min(1, rt.caravanProgress + step);
  }
}

export function missionObjectiveMet(
  rt: MissionRuntime | null,
  mission: MissionDef,
  wave: number,
  bossKilled: boolean,
): boolean {
  if (!rt || rt.failed) return false;
  if (wave < mission.waveGoal) return false;
  if (mission.requireBossKill || mission.type === 'bossHunt') return bossKilled;

  switch (rt.type) {
    case 'protectVillagers':
      return rt.villageHp > 0;
    case 'escort':
      return rt.caravanProgress >= 0.999 && rt.caravanHp > 0;
    case 'multiGate':
      return true;
    default:
      return true;
  }
}

export function missionHudLine(rt: MissionRuntime | null): string {
  if (!rt) return '';
  switch (rt.type) {
    case 'protectVillagers':
      return `Village ${rt.villageHp}/${rt.villageMax}`;
    case 'escort':
      return `Caravan ${rt.caravanHp}/${rt.caravanMax} · ${Math.round(rt.caravanProgress * 100)}%`;
    case 'multiGate':
      return `Fronts ×${rt.frontsHolding}`;
    default:
      return '';
  }
}
