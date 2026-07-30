/** Lightweight action replay recorder for the last completed / abandoned run. */

import { DifficultyId } from '../config/difficulty';
import { ModifierId } from '../config/modifiers';
import { AbilityType } from '../config/abilities';
import { TargetingMode, TowerType } from '../config/towers';

export type ReplayActionKind =
  | 'build'
  | 'sell'
  | 'upgrade'
  | 'wave'
  | 'ability'
  | 'bridge'
  | 'end';

export interface ReplayAction {
  t: number;
  kind: ReplayActionKind;
  type?: TowerType | AbilityType | string;
  x?: number;
  y?: number;
  targeting?: TargetingMode;
  level?: number;
  victory?: boolean;
  wave?: number;
  score?: number;
}

export interface ReplayHeader {
  version: 1;
  seed: string;
  mapIndex: number;
  mapId: string;
  mapName: string;
  difficulty: DifficultyId;
  modifiers: ModifierId[];
  isDaily: boolean;
  recordedAt: string;
}

export interface ReplayData extends ReplayHeader {
  actions: ReplayAction[];
  summary?: {
    wave: number;
    score: number;
    kills: number;
    towersBuilt: number;
    goldEarned: number;
    durationSec: number;
    victory: boolean;
  };
}

export class ReplayRecorder {
  private header: ReplayHeader | null = null;
  private actions: ReplayAction[] = [];
  private startMs = 0;
  private active = false;

  begin(header: Omit<ReplayHeader, 'version' | 'recordedAt'>): void {
    this.header = {
      ...header,
      version: 1,
      recordedAt: new Date().toISOString(),
    };
    this.actions = [];
    this.startMs = performance.now();
    this.active = true;
  }

  private now(): number {
    return (performance.now() - this.startMs) / 1000;
  }

  record(action: Omit<ReplayAction, 't'>): void {
    if (!this.active) return;
    this.actions.push({ ...action, t: this.now() });
    if (this.actions.length > 4000) this.actions.shift();
  }

  finish(summary: NonNullable<ReplayData['summary']>): ReplayData | null {
    if (!this.header) return null;
    this.record({
      kind: 'end',
      victory: summary.victory,
      wave: summary.wave,
      score: summary.score,
    });
    this.active = false;
    return {
      ...this.header,
      actions: [...this.actions],
      summary,
    };
  }

  snapshot(): ReplayData | null {
    if (!this.header) return null;
    return {
      ...this.header,
      actions: [...this.actions],
    };
  }

  clear(): void {
    this.active = false;
    this.header = null;
    this.actions = [];
  }
}

export function formatReplayAction(a: ReplayAction): string {
  switch (a.kind) {
    case 'build':
      return `t+${a.t.toFixed(1)}s  Built ${a.type} @ (${Math.round(a.x ?? 0)}, ${Math.round(a.y ?? 0)})`;
    case 'sell':
      return `t+${a.t.toFixed(1)}s  Sold ${a.type}`;
    case 'upgrade':
      return `t+${a.t.toFixed(1)}s  Upgraded ${a.type} → Lv${a.level ?? '?'}`;
    case 'wave':
      return `t+${a.t.toFixed(1)}s  Started wave ${a.wave}`;
    case 'ability':
      return `t+${a.t.toFixed(1)}s  Ability ${a.type}`;
    case 'bridge':
      return `t+${a.t.toFixed(1)}s  Bridge @ (${Math.round(a.x ?? 0)}, ${Math.round(a.y ?? 0)})`;
    case 'end':
      return `t+${a.t.toFixed(1)}s  ${a.victory ? 'Victory' : 'Defeat'} · W${a.wave} · ${a.score}`;
    default:
      return `t+${a.t.toFixed(1)}s  ${a.kind}`;
  }
}
