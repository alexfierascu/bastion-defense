/**
 * Loads optional real audio files from /assets/sounds/.
 * Falls back silently so the game always runs with procedural SFX.
 */

export const SOUND_IDS = [
  'attack_arrow',
  'attack_cannon',
  'attack_magic',
  'attack_sniper',
  'attack_poison',
  'attack_freeze',
  'attack_tesla',
  'attack_laser',
  'attack_rocket',
  'explosion',
  'build',
  'sell',
  'upgrade',
  'wave',
  'leak',
  'ui_click',
  'ui_hover',
  'victory',
  'defeat',
  'achievement',
  'ability',
  'music_loop',
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

const EXTS = ['ogg', 'mp3', 'wav'] as const;

async function tryFetchBuffer(ctx: AudioContext, base: string): Promise<AudioBuffer | null> {
  for (const ext of EXTS) {
    try {
      const res = await fetch(`/assets/sounds/${base}.${ext}`, { cache: 'force-cache' });
      if (!res.ok) continue;
      const arr = await res.arrayBuffer();
      return await ctx.decodeAudioData(arr.slice(0));
    } catch {
      /* try next ext */
    }
  }
  return null;
}

/** Attempt to load every known sound. Missing files are omitted. */
export async function loadSoundPack(ctx: AudioContext): Promise<Map<string, AudioBuffer>> {
  const map = new Map<string, AudioBuffer>();
  await Promise.all(
    SOUND_IDS.map(async (id) => {
      const buf = await tryFetchBuffer(ctx, id);
      if (buf) map.set(id, buf);
    }),
  );
  return map;
}
