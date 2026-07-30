import { SAVE_KEY } from '../config/constants';
import { AchievementId } from '../config/achievements';
import { ArtStyleId, DEFAULT_ART_STYLE } from '../config/artThemes';
import { PathThemeId, TowerSkinId } from '../config/cosmetics';
import { DifficultyId } from '../config/difficulty';
import { ModifierId } from '../config/modifiers';
import { TargetingMode, TowerType } from '../config/towers';
import { defaultUnlockedTowers, TOWER_UNLOCK_RULES } from '../config/unlocks';
import { DEFAULT_KEYBINDINGS, KeyBindings } from '../engine/input';
import { ReplayData } from '../systems/replay';

export const SAVE_SLOT_COUNT = 3;

export interface SettingsData {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  graphicsQuality: 'low' | 'medium' | 'high';
  language: 'en' | 'es' | 'fr' | 'de' | 'pt';
  colorblind: boolean;
  reduceMotion: boolean;
  showFps: boolean;
  showDamageNumbers: boolean;
  keyBindings: KeyBindings;
  tutorialDone: boolean;
  targetingPresets: Partial<Record<TowerType, TargetingMode>>;
  confirmSell: boolean;
  confirmUpgrade: boolean;
  uiScale: number;
  showKillFeed: boolean;
  showWavePreview: boolean;
  pathTheme: PathThemeId;
  towerSkin: TowerSkinId;
  /** World / sprite art style (cozy forest default; premium styles gated later). */
  artStyle: ArtStyleId;
  showProfiler: boolean;
  autoQuality: boolean;
}

export interface StatisticsData {
  gamesPlayed: number;
  wins: number;
  losses: number;
  enemiesKilled: number;
  towersBuilt: number;
  moneyEarned: number;
  bossesDefeated: number;
  highestWave: number;
  damageDealt: number;
  abilitiesUsed: number;
  playTimeSeconds: number;
}

export interface DailyEntry {
  date: string;
  score: number;
  wave: number;
  seed: string;
}

export interface GameProgressSnapshot {
  mapId: string;
  mapIndex: number;
  wave: number;
  gold: number;
  lives: number;
  score: number;
  endless: boolean;
  towers: {
    type: string;
    x: number;
    y: number;
    level: number;
    targeting: string;
    invested: number;
  }[];
  seed: string;
  difficulty: DifficultyId;
  modifiers: ModifierId[];
  isDaily: boolean;
}

export interface SaveSlot {
  id: number;
  name: string;
  updatedAt: number;
  snapshot: GameProgressSnapshot | null;
}

export interface SaveData {
  version: number;
  settings: SettingsData;
  statistics: StatisticsData;
  achievements: AchievementId[];
  unlockedMaps: string[];
  unlockedTowers: TowerType[];
  unlockedCosmetics: string[];
  researchPoints: number;
  skillTree: Record<string, number>;
  prestigeLevel: number;
  /** Gold granted once on the next new run from achievement rewards. */
  bankedGold: number;
  /** Active quick-continue (mirrors the active slot). */
  continueGame: GameProgressSnapshot | null;
  /** Named mid-run save slots. */
  saveSlots: SaveSlot[];
  activeSlot: number;
  lastReplay: ReplayData | null;
  dailyChallengeDate: string;
  dailyChallengeBest: number;
  dailyHistory: DailyEntry[];
  lastDifficulty: DifficultyId;
}

export function defaultSaveSlots(): SaveSlot[] {
  return Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => ({
    id: i,
    name: `Slot ${i + 1}`,
    updatedAt: 0,
    snapshot: null,
  }));
}

export function defaultSettings(): SettingsData {
  return {
    masterVolume: 0.7,
    musicVolume: 0.35,
    sfxVolume: 0.7,
    musicEnabled: true,
    sfxEnabled: true,
    graphicsQuality: 'high',
    language: 'en',
    colorblind: false,
    reduceMotion: false,
    showFps: true,
    showDamageNumbers: true,
    keyBindings: { ...DEFAULT_KEYBINDINGS },
    tutorialDone: false,
    targetingPresets: {},
    confirmSell: true,
    confirmUpgrade: false,
    uiScale: 1,
    showKillFeed: true,
    showWavePreview: true,
    pathTheme: 'ironwood',
    towerSkin: 'default',
    artStyle: DEFAULT_ART_STYLE,
    showProfiler: false,
    autoQuality: true,
  };
}

export function defaultStats(): StatisticsData {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    enemiesKilled: 0,
    towersBuilt: 0,
    moneyEarned: 0,
    bossesDefeated: 0,
    highestWave: 0,
    damageDealt: 0,
    abilitiesUsed: 0,
    playTimeSeconds: 0,
  };
}

export function defaultSave(): SaveData {
  return {
    version: 4,
    settings: defaultSettings(),
    statistics: defaultStats(),
    achievements: [],
    unlockedMaps: ['emerald-pass'],
    unlockedTowers: defaultUnlockedTowers(),
    unlockedCosmetics: ['ironwood', 'default'],
    researchPoints: 0,
    skillTree: {},
    prestigeLevel: 0,
    bankedGold: 0,
    continueGame: null,
    saveSlots: defaultSaveSlots(),
    activeSlot: 0,
    lastReplay: null,
    dailyChallengeDate: '',
    dailyChallengeBest: 0,
    dailyHistory: [],
    lastDifficulty: 'normal',
  };
}

export class SaveManager {
  data: SaveData = defaultSave();

  load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        this.data = defaultSave();
        return this.data;
      }
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      this.data = {
        ...defaultSave(),
        ...parsed,
        settings: {
          ...defaultSettings(),
          ...parsed.settings,
          keyBindings: { ...DEFAULT_KEYBINDINGS, ...parsed.settings?.keyBindings },
          targetingPresets: {
            ...defaultSettings().targetingPresets,
            ...(parsed.settings?.targetingPresets ?? {}),
          },
        },
        statistics: { ...defaultStats(), ...parsed.statistics },
        achievements: parsed.achievements ?? [],
        unlockedMaps: parsed.unlockedMaps ?? ['emerald-pass'],
        unlockedTowers: parsed.unlockedTowers?.length
          ? parsed.unlockedTowers
          : defaultUnlockedTowers(),
        unlockedCosmetics: parsed.unlockedCosmetics?.length
          ? parsed.unlockedCosmetics
          : ['ironwood', 'default'],
        skillTree: parsed.skillTree ?? {},
        dailyHistory: parsed.dailyHistory ?? [],
        lastDifficulty: parsed.lastDifficulty ?? 'normal',
        bankedGold: parsed.bankedGold ?? 0,
        saveSlots: parsed.saveSlots?.length ? parsed.saveSlots : defaultSaveSlots(),
        activeSlot: parsed.activeSlot ?? 0,
        lastReplay: parsed.lastReplay ?? null,
      };
      // Migrate legacy continue into slot 0
      if (this.data.continueGame && !this.data.saveSlots.some((s) => s.snapshot)) {
        const slot = this.data.saveSlots[this.data.activeSlot] ?? this.data.saveSlots[0]!;
        slot.snapshot = this.data.continueGame;
        slot.updatedAt = Date.now();
      }
      this.syncProgressUnlocks();
    } catch {
      this.data = defaultSave();
    }
    return this.data;
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  clearContinue(): void {
    this.data.continueGame = null;
    const slot = this.data.saveSlots[this.data.activeSlot];
    if (slot) {
      slot.snapshot = null;
      slot.updatedAt = Date.now();
    }
    this.save();
  }

  setContinue(snapshot: GameProgressSnapshot | null): void {
    this.data.continueGame = snapshot;
    const slot = this.data.saveSlots[this.data.activeSlot] ?? this.data.saveSlots[0]!;
    slot.snapshot = snapshot;
    slot.updatedAt = Date.now();
    this.save();
  }

  setActiveSlot(id: number): void {
    if (id < 0 || id >= this.data.saveSlots.length) return;
    this.data.activeSlot = id;
    this.data.continueGame = this.data.saveSlots[id]?.snapshot ?? null;
    this.save();
  }

  renameSlot(id: number, name: string): void {
    const slot = this.data.saveSlots[id];
    if (!slot) return;
    slot.name = name.slice(0, 24) || slot.name;
    this.save();
  }

  setLastReplay(replay: ReplayData | null): void {
    this.data.lastReplay = replay;
    this.save();
  }

  exportJson(): string {
    return JSON.stringify(this.data, null, 2);
  }

  importJson(raw: string): { ok: boolean; error?: string } {
    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: 'Invalid save file' };
      }
      this.data = {
        ...defaultSave(),
        ...parsed,
        settings: {
          ...defaultSettings(),
          ...parsed.settings,
          keyBindings: { ...DEFAULT_KEYBINDINGS, ...parsed.settings?.keyBindings },
          targetingPresets: {
            ...defaultSettings().targetingPresets,
            ...(parsed.settings?.targetingPresets ?? {}),
          },
        },
        statistics: { ...defaultStats(), ...parsed.statistics },
        saveSlots: parsed.saveSlots?.length ? parsed.saveSlots : defaultSaveSlots(),
      };
      this.syncProgressUnlocks();
      this.save();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Parse failed' };
    }
  }

  unlockAchievement(id: AchievementId): boolean {
    if (this.data.achievements.includes(id)) return false;
    this.data.achievements.push(id);
    this.save();
    return true;
  }

  unlockMap(id: string): void {
    if (!this.data.unlockedMaps.includes(id)) {
      this.data.unlockedMaps.push(id);
      this.save();
    }
  }

  unlockTower(type: TowerType, persist = true): boolean {
    if (this.data.unlockedTowers.includes(type)) return false;
    this.data.unlockedTowers.push(type);
    if (persist) this.save();
    return true;
  }

  unlockCosmetic(id: string, persist = true): boolean {
    if (this.data.unlockedCosmetics.includes(id)) return false;
    this.data.unlockedCosmetics.push(id);
    if (persist) this.save();
    return true;
  }

  isTowerUnlocked(type: TowerType): boolean {
    return this.data.unlockedTowers.includes(type);
  }

  /** Grant towers unlocked by lifetime highest wave / prestige. */
  syncProgressUnlocks(): void {
    const wave = this.data.statistics.highestWave;
    const prestige = this.data.prestigeLevel;
    for (const rule of TOWER_UNLOCK_RULES) {
      if (rule.wave && wave >= rule.wave) this.unlockTower(rule.type, false);
      if (rule.prestige && prestige >= rule.prestige) this.unlockTower(rule.type, false);
    }
    if (prestige >= 1) this.unlockCosmetic('crimson', false);
    if (prestige >= 2) this.unlockCosmetic('bronze', false);
    if (prestige >= 3) this.unlockCosmetic('ash', false);
    this.save();
  }

  recordDaily(entry: DailyEntry): void {
    if (entry.score > this.data.dailyChallengeBest || entry.date !== this.data.dailyChallengeDate) {
      if (entry.date === this.data.dailyChallengeDate) {
        this.data.dailyChallengeBest = Math.max(this.data.dailyChallengeBest, entry.score);
      } else {
        this.data.dailyChallengeDate = entry.date;
        this.data.dailyChallengeBest = entry.score;
      }
    } else {
      this.data.dailyChallengeBest = Math.max(this.data.dailyChallengeBest, entry.score);
    }
    const hist = this.data.dailyHistory.filter((h) => h.date !== entry.date);
    hist.push(entry);
    hist.sort((a, b) => b.score - a.score);
    this.data.dailyHistory = hist.slice(0, 20);
    this.save();
  }
}
