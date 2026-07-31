/**
 * Rolls per-run identity: seed, faction, environmental modifiers.
 */

import {
  ENV_MODIFIER_DEFS,
  ENV_MODIFIER_ORDER,
  EnvModifierId,
} from '../config/envModifiers';
import { FACTION_ORDER, FactionId } from '../config/factions';
import { createRng, hashString } from '../utils/math';

export interface RunIdentity {
  seed: string;
  factionId: FactionId;
  envModifiers: EnvModifierId[];
}

export function makeShareableSeed(opts?: { daily?: string; raw?: string }): string {
  if (opts?.daily) return `daily-${opts.daily}`;
  if (opts?.raw) return opts.raw.startsWith('bd-') ? opts.raw : `bd-${opts.raw}`;
  const a = Date.now().toString(36);
  const b = Math.floor(Math.random() * 1e9).toString(36);
  return `bd-${a}-${b}`;
}

export function rollRunIdentity(seed: string, opts?: { envCount?: number }): RunIdentity {
  const rng = createRng(hashString(`${seed}:identity`));
  const factionId = FACTION_ORDER[Math.floor(rng() * FACTION_ORDER.length)]!;

  const want = opts?.envCount ?? 1 + Math.floor(rng() * 3); // 1–3
  const envModifiers = pickEnvModifiers(seed, want);

  return { seed, factionId, envModifiers };
}

function pickEnvModifiers(seed: string, count: number): EnvModifierId[] {
  const rng = createRng(hashString(`${seed}:env`));
  const pool = [...ENV_MODIFIER_ORDER];
  const picks: EnvModifierId[] = [];
  const n = Math.max(1, Math.min(3, count));
  for (let i = 0; i < n && pool.length > 0; i++) {
    let total = 0;
    for (const id of pool) total += ENV_MODIFIER_DEFS[id].weight;
    let r = rng() * total;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= ENV_MODIFIER_DEFS[pool[j]!].weight;
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    picks.push(pool.splice(idx, 1)[0]!);
  }
  return picks;
}

export function formatSeedExport(identity: RunIdentity, extra?: Record<string, string>): string {
  const lines = [
    `Bastion Defense Run`,
    `Seed: ${identity.seed}`,
    `Faction: ${identity.factionId}`,
    `Environment: ${identity.envModifiers.join(', ') || 'none'}`,
  ];
  if (extra) {
    for (const [k, v] of Object.entries(extra)) lines.push(`${k}: ${v}`);
  }
  return lines.join('\n');
}
