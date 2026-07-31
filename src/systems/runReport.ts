/**
 * End-of-run cinematic report data.
 */

import { DIFFICULTIES, DifficultyId } from '../config/difficulty';
import { ENEMY_DEFS, EnemyType } from '../config/enemies';
import { envModifierLabels, EnvModifierId } from '../config/envModifiers';
import { FACTION_DEFS, FactionId } from '../config/factions';
import { relicLabels, RelicId } from '../config/relics';
import { TOWER_DEFS, TowerType } from '../config/towers';
import { researchLabel } from './runMeta';
import { RunResearchId } from '../config/runResearch';
import { formatSeedExport, RunIdentity } from './runIdentity';

export interface RunReportInput {
  victory: boolean;
  seed: string;
  factionId: FactionId;
  envModifiers: EnvModifierId[];
  relics: RelicId[];
  research: RunResearchId | null;
  difficulty: DifficultyId;
  mapName: string;
  wave: number;
  score: number;
  kills: number;
  towersBuilt: number;
  towersSold: number;
  towersUpgraded: number;
  goldEarned: number;
  goldSpent: number;
  bossesKilled: number;
  damageDealt: number;
  timeSurvived: number;
  /** Damage dealt by tower type. */
  damageByTower: Partial<Record<TowerType, number>>;
  /** Damage taken / threat by enemy type (damage to gate + hp). */
  threatByEnemy: Partial<Record<EnemyType, number>>;
  unlocks?: string[];
  directorNote?: string;
}

export interface RunReport {
  title: string;
  subtitle: string;
  factionName: string;
  factionEpithet: string;
  envLabels: string[];
  relicLabels: string[];
  research: string;
  mvpTower: string;
  mostDangerous: string;
  difficultyName: string;
  difficultyRating: string;
  seed: string;
  exportText: string;
  stats: {
    wave: number;
    score: number;
    kills: number;
    towersBuilt: number;
    towersSold: number;
    towersUpgraded: number;
    goldEarned: number;
    goldSpent: number;
    bossesKilled: number;
    damageDealt: number;
    timeSurvived: number;
    mapName: string;
  };
  unlocks: string[];
  directorNote: string;
}

export function buildRunReport(input: RunReportInput): RunReport {
  const faction = FACTION_DEFS[input.factionId];
  const mvp = pickMaxLabel(input.damageByTower, (t) => TOWER_DEFS[t]?.name ?? t, 'None');
  const danger = pickMaxLabel(
    input.threatByEnemy,
    (t) => ENEMY_DEFS[t]?.name ?? t,
    'Unknown',
  );
  const rating = rateDifficulty(input);

  const identity: RunIdentity = {
    seed: input.seed,
    factionId: input.factionId,
    envModifiers: input.envModifiers,
  };

  const exportText = formatSeedExport(identity, {
    Difficulty: DIFFICULTIES[input.difficulty].name,
    Map: input.mapName,
    Wave: String(input.wave),
    Score: String(input.score),
    Result: input.victory ? 'Victory' : 'Defeat',
    MVP: mvp,
    Relics: relicLabels(input.relics).join(', ') || 'None',
  });

  return {
    title: input.victory ? 'Bastion Holds' : 'Gate Broken',
    subtitle: input.victory
      ? `${faction.name} driven back from ${input.mapName}`
      : `${faction.name} breached ${input.mapName}`,
    factionName: faction.name,
    factionEpithet: faction.epithet,
    envLabels: envModifierLabels(input.envModifiers),
    relicLabels: relicLabels(input.relics),
    research: researchLabel(input.research),
    mvpTower: mvp,
    mostDangerous: danger,
    difficultyName: DIFFICULTIES[input.difficulty].name,
    difficultyRating: rating,
    seed: input.seed,
    exportText,
    stats: {
      wave: input.wave,
      score: input.score,
      kills: input.kills,
      towersBuilt: input.towersBuilt,
      towersSold: input.towersSold,
      towersUpgraded: input.towersUpgraded,
      goldEarned: input.goldEarned,
      goldSpent: input.goldSpent,
      bossesKilled: input.bossesKilled,
      damageDealt: Math.round(input.damageDealt),
      timeSurvived: input.timeSurvived,
      mapName: input.mapName,
    },
    unlocks: input.unlocks ?? [],
    directorNote: input.directorNote ?? '',
  };
}

function pickMaxLabel<T extends string>(
  map: Partial<Record<T, number>>,
  label: (k: T) => string,
  fallback: string,
): string {
  let best: T | null = null;
  let bestV = 0;
  for (const [k, v] of Object.entries(map) as [T, number][]) {
    if (v > bestV) {
      bestV = v;
      best = k;
    }
  }
  return best ? label(best) : fallback;
}

function rateDifficulty(input: RunReportInput): string {
  const base = DIFFICULTIES[input.difficulty].scoreMult;
  const envWeight = 1 + input.envModifiers.length * 0.08;
  const relicEase = 1 - Math.min(0.2, input.relics.length * 0.03);
  const waveFactor = 1 + input.wave * 0.01;
  const score = base * envWeight * relicEase * waveFactor * (input.victory ? 1.1 : 0.9);
  if (score < 0.85) return 'Skirmish';
  if (score < 1.1) return 'Standard Siege';
  if (score < 1.4) return 'Hard Campaign';
  if (score < 1.75) return 'Brutal Front';
  return 'Legendary Ordeal';
}

export function reportToPayload(report: RunReport): Record<string, unknown> {
  return {
    ...report.stats,
    victory: report.title.includes('Holds'),
    highestWave: report.stats.wave,
    durationSec: report.stats.timeSurvived,
    difficulty: report.difficultyName,
    seed: report.seed,
    researchSelected: report.research,
    eliteRewards: report.relicLabels.join(', ') || 'None',
    relics: report.relicLabels.join(', ') || 'None',
    faction: report.factionName,
    factionEpithet: report.factionEpithet,
    envModifiers: report.envLabels.join(' · ') || 'None',
    mvpTower: report.mvpTower,
    mostDangerous: report.mostDangerous,
    difficultyRating: report.difficultyRating,
    unlocks: report.unlocks.join(', ') || '—',
    directorNote: report.directorNote,
    exportText: report.exportText,
    reportTitle: report.title,
    reportSubtitle: report.subtitle,
  };
}
