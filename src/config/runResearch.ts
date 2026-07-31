/** In-run Field Research — one active node per run until more systems unlock. */

export type RunResearchId =
  | 'tower_range'
  | 'attack_speed'
  | 'gold_income'
  | 'gate_health'
  | 'tower_cost'
  | 'crit_chance';

export interface RunResearchDef {
  id: RunResearchId;
  name: string;
  description: string;
  /** Research points to activate / switch. */
  cost: number;
}

export const RUN_RESEARCH_DEFS: Record<RunResearchId, RunResearchDef> = {
  tower_range: {
    id: 'tower_range',
    name: 'Optics',
    description: '+10% Tower Range',
    cost: 1,
  },
  attack_speed: {
    id: 'attack_speed',
    name: 'Servo Tuning',
    description: '+10% Attack Speed',
    cost: 1,
  },
  gold_income: {
    id: 'gold_income',
    name: 'Logistics',
    description: '+15% Gold Income',
    cost: 1,
  },
  gate_health: {
    id: 'gate_health',
    name: 'Reinforced Gate',
    description: '+10% Gate Health',
    cost: 1,
  },
  tower_cost: {
    id: 'tower_cost',
    name: 'Bulk Contracts',
    description: '-10% Tower Cost',
    cost: 1,
  },
  crit_chance: {
    id: 'crit_chance',
    name: 'Precision Drills',
    description: '+5% Critical Chance',
    cost: 1,
  },
};

export const RUN_RESEARCH_ORDER: RunResearchId[] = [
  'tower_range',
  'attack_speed',
  'gold_income',
  'gate_health',
  'tower_cost',
  'crit_chance',
];

/** RP granted every N completed waves. */
export const RUN_RESEARCH_RP_INTERVAL = 5;
export const RUN_RESEARCH_RP_PER_INTERVAL = 1;
