import {
  CAMERA_DEFAULT_ZOOM,
  FIXED_DT,
  FLAWLESS_BONUS,
  GAME_SPEEDS,
  INTEREST_CAP,
  INTEREST_RATE,
  MAX_FRAME_DT,
  MAX_WAVES_CAMPAIGN,
  MAX_WAVES_VERTICAL_SLICE,
  PREPARE_BETWEEN_SECONDS,
  PREPARE_SECONDS,
  STARTING_GOLD,
  STARTING_LIVES,
  TILE_SIZE,
  WAVE_CLEAR_BONUS_BASE,
  GameSpeed,
} from './config/constants';
import { DIFFICULTIES, DifficultyId } from './config/difficulty';
import { dailyModifiers, ModifierId } from './config/modifiers';
import {
  computeBonuses,
  prestigeBonuses,
  ResearchBonuses,
  SkillId,
  tryPurchaseSkill,
} from './systems/research';
import { ABILITY_DEFS, AbilityType } from './config/abilities';
import { ENEMY_DEFS } from './config/enemies';
import {
  isWallType,
  TARGETING_LABELS,
  TargetingMode,
  TowerType,
  TOWER_DEFS,
  UpgradePath,
} from './config/towers';
import { AudioManager } from './audio/audioManager';
import { Camera } from './engine/camera';
import { InputManager } from './engine/input';
import { Renderer } from './engine/renderer';
import { Enemy } from './entities/enemy';
import { Tower } from './entities/tower';
import { SaveManager, GameProgressSnapshot } from './save/saveManager';
import { AbilitySystem } from './systems/abilities';
import { AchievementTracker, createSessionCounters } from './systems/achievements';
import { CombatSystem } from './systems/combat';
import { computeEnvironment } from './systems/environment';
import {
  BUILD_REJECT_LABELS,
  BuildRejectReason,
  canPlaceWallAt,
  damageDestructible,
  generateMap,
  generateRandomMap,
  getPathCount,
  getTowerBuildRejectReason,
  hasBridgeAt,
  isGapTile,
  isInBounds,
  MapData,
  rebuildPathsWithWalls,
  snapToTileCenter,
  tileKey,
  tryBuildBridge,
  worldToTile,
  MAP_PRESETS,
} from './systems/map';
import { ParticleSystem } from './systems/particles';
import { ReplayRecorder } from './systems/replay';
import {
  buildBastionApproachWave,
  buildWave,
  summarizeWave,
  tutorialTipForWave,
  WaveDef,
} from './systems/waves';
import { EventBus, GameEvents } from './utils/events';
import { hashString, randomRange } from './utils/math';
import { HUD_INSETS, nextTargeting, UIManager } from './ui/uiManager';
import { TOWER_UNLOCK_RULES } from './config/unlocks';
import { Profiler, qualityParticleScale } from './engine/profiler';

const BRIDGE_COST = 40;

type Phase = 'menu' | 'playing' | 'paused' | 'victory' | 'defeat';

export class Game {
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private input: InputManager;
  private renderer: Renderer;
  private audio = new AudioManager();
  private save = new SaveManager();
  private bus = new EventBus();
  private ui: UIManager;
  private achievements: AchievementTracker;

  private map!: MapData;
  private towers: Tower[] = [];
  private enemies: Enemy[] = [];
  private combat = new CombatSystem();
  private particles = new ParticleSystem();
  private abilities = new AbilitySystem();

  private phase: Phase = 'menu';
  private gold = STARTING_GOLD;
  private lives = STARTING_LIVES;
  private maxLives = STARTING_LIVES;
  private score = 0;
  private wave = 0;
  private speed: GameSpeed = 1;
  private pausedByPlayer = false;

  private buildType: TowerType | null = null;
  private selectedTower: Tower | null = null;
  private selectedEnemy: Enemy | null = null;
  private abilityAim: AbilityType | null = null;

  private waveDef: WaveDef | null = null;
  private waveTime = 0;
  private spawnIndex = 0;
  private waveActive = false;
  private waveReady = true;
  private livesAtWaveStart = STARTING_LIVES;
  private pendingSpawns = 0;
  private endless = false;
  private autoWaves = false;
  private blitzActive = false;
  private showAllRanges = false;
  private mapIndex = 0;
  private seed = 'bastion';
  private session = createSessionCounters();
  /** Cinematic fade + camera fly after Enter the Bastion. */
  private levelIntro = false;
  private introFade = 0;
  private introElapsed = 0;
  /** Smoothed ghost world position (avoids per-frame allocations). */
  private ghostDrawX = 0;
  private ghostDrawY = 0;
  private ghostHasPos = false;
  private goldPulse = 0;
  private gateFlash = 0;

  private lastTs = 0;
  private acc = 0;
  private fps = 60;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private dayNight = 0;
  private weather = 0;
  private occupied = new Set<string>();
  private bonuses: ResearchBonuses = computeBonuses({});

  private difficulty: DifficultyId = 'normal';
  private modifiers: ModifierId[] = [];
  private isDaily = false;
  private prepareTimer = 0;
  private reinforcePause = 0;
  private reinforcedThisWave = false;
  private envLabel = 'Day';
  private runTime = 0;
  private bridgeMode = false;
  private killFeed: { text: string; t: number }[] = [];
  private wavePreviewLabel = '';
  private rangeMult = 1;
  private killGoldMult = 1;
  private replay = new ReplayRecorder();
  private profiler = new Profiler();
  private runStartedAt = 0;
  private photoMode = false;
  private sessionDamage = 0;
  /** Road tiles blocked by barricades (`c,r`). */
  private wallTiles = new Set<string>();
  private sellArmedId = 0;
  private upgradeArmedId = 0;
  private targetingClipboard: TargetingMode | null = null;
  private undo:
    | {
        kind: 'build';
        towerId: number;
        cost: number;
        expires: number;
      }
    | {
        kind: 'sell';
        type: TowerType;
        x: number;
        y: number;
        level: number;
        targeting: TargetingMode;
        invested: number;
        path?: UpgradePath | null;
        refund: number;
        expires: number;
      }
    | {
        kind: 'upgrade';
        towerId: number;
        cost: number;
        expires: number;
      }
    | null = null;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.canvas = canvas;
    this.save.load();
    this.camera = new Camera();
    this.renderer = new Renderer(canvas);
    this.input = new InputManager(canvas, (x, y) => this.camera.screenToWorld(x, y));
    this.achievements = new AchievementTracker(this.save, this.bus);

    this.ui = new UIManager(uiRoot, this.save, {
      onNewGame: (mapIndex, daily, difficulty, modifiers) =>
        this.startNewGame(mapIndex, daily, difficulty, modifiers),
      onContinue: () => this.continueGame(),
      onResume: () => this.resume(),
      onRestart: () => {
        if (this.map?.id === 'bastion-approach' || this.mapIndex === 0) {
          this.enterBastionCampaign();
        } else {
          this.startNewGame(this.mapIndex, false, this.difficulty, this.modifiers);
        }
      },
      onQuit: () => this.toMenu(),
      onPause: () => this.pause(),
      onSpeed: (s) => this.setSpeed(s as GameSpeed),
      onSelectTowerType: (t) => {
        this.buildType = t;
        this.selectedTower = null;
        this.selectedEnemy = null;
        this.abilityAim = null;
        this.ghostHasPos = false;
        if (t) {
          this.ui.showToast(`Click a green tile to place ${TOWER_DEFS[t].name}`);
        } else {
          this.setBuildCursor(null);
        }
      },
      onUpgrade: (path) => this.upgradeSelected(path),
      onSell: () => this.sellSelected(),
      onCycleTargeting: () => this.cycleTargeting(),
      onApplyTargetingToType: () => this.applyTargetingToType(),
      onCopyTargeting: () => this.copyTargeting(),
      onPasteTargeting: () => this.pasteTargeting(),
      onUndo: () => this.undoLastAction(),
      onOpenEncyclopedia: (focus) => {
        this.pause();
        this.ui.show('encyclopedia', { focus, from: 'pause' });
      },
      onAbility: (id) => this.beginAbility(id),
      onSettingsChange: (s) => this.applySettings(s),
      onFullscreen: () => this.toggleFullscreen(),
      onStartNextWave: () => this.startWave(),
      onEnterEndless: () => this.enterEndless(),
      onToggleAutoWaves: () => {
        this.autoWaves = !this.autoWaves;
        this.ui.showToast(this.autoWaves ? 'Auto waves ON' : 'Auto waves OFF');
      },
      onBlitzWave: () => this.startBlitz(),
      onToggleShowRanges: () => {
        this.showAllRanges = !this.showAllRanges;
      },
      onScreenshot: () => this.downloadScreenshot(),
      onPhotoMode: () => this.enterPhotoMode(),
      onExportSave: () => this.exportSaveFile(),
      onImportSave: (json) => this.save.importJson(json),
      onSelectSlot: (id) => this.save.setActiveSlot(id),
      onRenameSlot: (id, name) => this.save.renameSlot(id, name),
      titleAudio: {
        unlock: () => this.audio.unlock(),
        play: (id, vol) => this.audio.play(id, vol),
        startAmbient: () => this.audio.startTitleAmbient(),
        stopAmbient: () => this.audio.stopTitleAmbient(),
        startMusic: () => this.audio.startMusic(),
        stopMusic: () => this.audio.stopMusic(),
      },
      onEnterBastion: () => this.enterBastionCampaign(),
      onResearchPurchase: (id: SkillId) => {
        const result = tryPurchaseSkill(
          this.save.data.skillTree,
          this.save.data.researchPoints,
          id,
        );
        if (!result.ok) return false;
        this.save.data.skillTree = result.tree;
        this.save.data.researchPoints = result.points;
        this.save.save();
        return true;
      },
    });

    this.bus.on(
      GameEvents.ACHIEVEMENT_UNLOCKED,
      (def: { name: string; icon: string; rewardText?: string } | undefined) => {
        if (!def) return;
        this.ui.showAchievement(def.name, def.icon, def.rewardText);
        this.audio.play('achievement');
        if (def.rewardText) this.ui.showToast(def.rewardText);
      },
    );

    this.applySettings(this.save.data.settings);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.ui.show('main');
    requestAnimationFrame((t) => this.frame(t));
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, this.save.data.settings.graphicsQuality === 'low' ? 1 : 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.resize(w, h, dpr);
    this.camera.resize(w, h);
    // Keep playfield clear of chrome while in-game HUD is up
    if (this.ui.getScreen() === 'hud' || this.phase === 'playing' || this.phase === 'paused') {
      this.camera.setInsets({ ...HUD_INSETS });
    } else {
      this.camera.setInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    }
  }

  private applySettings(s: typeof this.save.data.settings): void {
    this.save.data.settings = s;
    this.save.save();
    this.audio.setMaster(s.masterVolume);
    this.audio.setMusic(s.musicVolume);
    this.audio.setSfx(s.sfxVolume);
    this.audio.setMusicEnabled(s.musicEnabled);
    this.audio.setSfxEnabled(s.sfxEnabled);
    this.renderer.graphicsQuality = s.graphicsQuality;
    this.renderer.colorblind = s.colorblind;
    this.renderer.reduceMotion = s.reduceMotion;
    this.renderer.pathTheme = s.pathTheme;
    this.renderer.towerSkin = s.towerSkin;
    this.renderer.artStyle = s.artStyle ?? 'cozyForest';
    this.combat.showDamageNumbers = s.showDamageNumbers;
    this.particles.qualityScale = qualityParticleScale(s.graphicsQuality);
    this.profiler.enabled = s.showProfiler;
    this.ui.setLang(s.language);
    this.input.setBindings(s.keyBindings);
    document.documentElement.style.setProperty('--ui-scale', String(s.uiScale || 1));
    document.documentElement.dataset.colorblind = s.colorblind ? '1' : '0';
    document.documentElement.dataset.reduceMotion = s.reduceMotion ? '1' : '0';
    document.documentElement.dataset.theme = s.pathTheme;
    this.resize();
  }

  private downloadScreenshot(): void {
    try {
      const url = this.renderer.capturePng();
      const a = document.createElement('a');
      a.href = url;
      a.download = `bastion-${this.map?.id ?? 'shot'}-w${this.wave}-${Date.now()}.png`;
      a.click();
      this.ui.showToast('Screenshot saved');
    } catch {
      this.ui.showToast('Screenshot failed');
    }
  }

  private enterPhotoMode(): void {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    this.photoMode = true;
    this.phase = 'paused';
    this.pausedByPlayer = true;
    this.ui.show('hidden');
    this.camera.setInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    this.ui.showPhotoChrome(() => {
      this.photoMode = false;
      this.resume();
    });
  }

  private exportSaveFile(): void {
    const blob = new Blob([this.save.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bastion-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.ui.showToast('Save exported');
  }

  private endPayload(victory: boolean): Record<string, unknown> {
    return {
      score: this.score,
      wave: this.wave,
      kills: this.session.kills,
      towersBuilt: this.session.towersBuilt,
      goldEarned: this.session.goldEarned,
      goldSpent: this.session.goldSpent,
      bossesKilled: this.session.bossesKilled,
      flawlessWaves: this.session.flawlessWaves,
      damageDealt: this.sessionDamage,
      durationSec: this.runStartedAt ? (performance.now() - this.runStartedAt) / 1000 : 0,
      mapName: this.map?.name ?? '',
      difficulty: DIFFICULTIES[this.difficulty].name,
      seed: this.seed,
      victory,
      verticalSlice: this.map?.id === 'bastion-approach' && !this.endless,
    };
  }

  private finishReplay(victory: boolean): void {
    const data = this.replay.finish({
      wave: this.wave,
      score: this.score,
      kills: this.session.kills,
      towersBuilt: this.session.towersBuilt,
      goldEarned: this.session.goldEarned,
      durationSec: this.runStartedAt ? (performance.now() - this.runStartedAt) / 1000 : 0,
      victory,
    });
    if (data) this.save.setLastReplay(data);
    this.runStartedAt = 0;
  }

  private async ensureAudio(): Promise<void> {
    await this.audio.unlock();
  }

  private hasModifier(id: ModifierId): boolean {
    return this.modifiers.includes(id);
  }

  private povertyMult(): number {
    return this.hasModifier('poverty') ? 0.65 : 1;
  }

  private createMapForRun(): MapData {
    return this.mapIndex < 0 ? generateRandomMap(this.seed) : generateMap(this.mapIndex, this.seed);
  }

  private bindCombatWorldHooks(): void {
    this.combat.onSplashWorld = (x, y, radius, damage, damageType) => {
      if (damageType !== 'explosive' && damageType !== 'physical') return;
      for (const rock of [...this.map.destructibles]) {
        const cx = rock.c * TILE_SIZE + TILE_SIZE / 2;
        const cy = rock.r * TILE_SIZE + TILE_SIZE / 2;
        if (Math.hypot(cx - x, cy - y) <= radius) {
          damageDestructible(this.map, cx, cy, damage);
        }
      }
      for (const slot of this.map.bridgeSlots) {
        if (!slot.built) continue;
        const cx = slot.c * TILE_SIZE + TILE_SIZE / 2;
        const cy = slot.r * TILE_SIZE + TILE_SIZE / 2;
        if (Math.hypot(cx - x, cy - y) <= radius) {
          slot.hp -= damage;
          if (slot.hp <= 0) {
            slot.built = false;
            slot.hp = slot.maxHp;
            this.map.tiles[slot.r]![slot.c] = 'gap';
          }
        }
      }
    };
  }

  private recordDailyIfNeeded(): void {
    if (!this.isDaily) return;
    const date =
      this.save.data.dailyChallengeDate ||
      (this.seed.startsWith('daily-') ? this.seed.slice(6) : new Date().toISOString().slice(0, 10));
    this.save.recordDaily({ date, score: this.score, wave: this.wave, seed: this.seed });
  }

  /** Title "Enter the Bastion" — fade through black into the first handcrafted level. */
  private enterBastionCampaign(): void {
    this.ui.setFade(1);
    this.startNewGame(0, false, this.save.data.lastDifficulty ?? 'normal', [], {
      cinematic: true,
    });
  }

  private startNewGame(
    mapIndex: number,
    daily: boolean,
    difficulty: DifficultyId = 'normal',
    modifiers: ModifierId[] = [],
    opts?: { cinematic?: boolean },
  ): void {
    void this.ensureAudio().then(() => {
      this.audio.stopTitleAmbient();
      this.audio.startGameplayAmbient();
      this.audio.startMusic();
    });
    this.isDaily = daily;
    if (daily) {
      const day = new Date().toISOString().slice(0, 10);
      this.seed = `daily-${day}`;
      this.mapIndex = hashString(day) % MAP_PRESETS.length;
      this.modifiers = dailyModifiers(day);
      this.difficulty = 'hard';
      this.save.data.dailyChallengeDate = day;
    } else {
      this.mapIndex = mapIndex;
      this.seed = `run-${Date.now()}`;
      this.difficulty = difficulty;
      this.modifiers = [...modifiers];
    }
    this.save.data.lastDifficulty = this.difficulty;
    this.resetRunState();
    this.map = this.createMapForRun();
    this.phase = 'playing';
    this.ui.show('hud');
    this.camera.setInsets({ ...HUD_INSETS });
    const mini = this.ui.getMinimapCanvas();
    if (mini) this.renderer.attachMinimap(mini);
    this.save.data.statistics.gamesPlayed++;
    this.save.save();
    this.audio.play('ui_click');
    this.runStartedAt = performance.now();
    this.sessionDamage = 0;
    this.replay.begin({
      seed: this.seed,
      mapIndex: this.mapIndex,
      mapId: this.map.id,
      mapName: this.map.name,
      difficulty: this.difficulty,
      modifiers: [...this.modifiers],
      isDaily: this.isDaily,
    });
    this.refreshWavePreview();

    if (opts?.cinematic && this.map.id === 'bastion-approach') {
      this.beginLevelIntro();
    } else {
      this.levelIntro = false;
      this.introFade = 0;
      this.ui.clearFade();
      this.camera.centerOn(this.map.spawn.x + 200, this.map.spawn.y);
      this.camera.setZoom(CAMERA_DEFAULT_ZOOM);
      if (this.map.id === 'bastion-approach') {
        this.beginPreparePhase(PREPARE_SECONDS);
      } else if (!this.save.data.settings.tutorialDone) {
        this.ui.showToast('Welcome! Build towers along the path, then start the first wave.');
      }
    }
  }

  private beginLevelIntro(): void {
    this.levelIntro = true;
    this.waveReady = false;
    this.prepareTimer = 0;
    this.introFade = 1;
    this.introElapsed = 0;
    this.ui.setFade(1);
    // Start at the forest entrance, then pull back to see the Bastion
    this.camera.centerOn(this.map.spawn.x + 60, this.map.spawn.y);
    this.camera.zoom = 1.2;
    this.camera.setZoom(1.2);
    const overviewX = this.map.spawn.x * 0.35 + this.map.base.x * 0.65;
    const overviewY = this.map.spawn.y * 0.4 + this.map.base.y * 0.6;
    this.camera.flyTo(overviewX, overviewY, 0.7);
  }

  private updateLevelIntro(dt: number): void {
    if (!this.levelIntro) return;
    this.introElapsed += dt;
    this.introFade = Math.max(0, this.introFade - dt * 0.65);
    this.ui.setFade(this.introFade);
    // Failsafe: never leave the player stuck unable to build
    if (this.introElapsed > 3.5 && this.camera.isFlying) {
      this.camera.stopFlying();
    }
    if (this.introFade <= 0 && (!this.camera.isFlying || this.introElapsed > 4)) {
      if (this.camera.isFlying) this.camera.stopFlying();
      this.levelIntro = false;
      this.ui.clearFade();
      this.beginPreparePhase(PREPARE_SECONDS);
    }
  }

  private cancelBuildPlacement(): void {
    if (!this.buildType && !this.abilityAim) return;
    this.buildType = null;
    this.abilityAim = null;
    this.ghostHasPos = false;
    this.ui.clearBuildSelection();
    this.setBuildCursor(null);
  }

  private setBuildCursor(mode: 'valid' | 'invalid' | null): void {
    if (mode === 'valid') this.canvas.style.cursor = 'copy';
    else if (mode === 'invalid') this.canvas.style.cursor = 'not-allowed';
    else this.canvas.style.cursor = 'crosshair';
  }

  /** Timed build window before the next wave auto-starts. */
  private beginPreparePhase(seconds: number): void {
    this.prepareTimer = Math.max(0.5, seconds * this.bonuses.prepareMult);
    this.waveReady = true;
    this.waveActive = false;
    this.refreshWavePreview();
    this.ui.showToast(`Prepare your defenses — ${Math.ceil(this.prepareTimer)}s`);
  }

  /** Wave cap for the current run (Bastion Approach = 1-wave vertical slice). */
  private campaignWaveCap(): number {
    if (this.endless) return Number.POSITIVE_INFINITY;
    if (this.map?.id === 'bastion-approach') return MAX_WAVES_VERTICAL_SLICE;
    return MAX_WAVES_CAMPAIGN;
  }

  private continueGame(): void {
    const snap = this.save.data.continueGame;
    if (!snap) return;
    void this.ensureAudio().then(() => {
      this.audio.stopTitleAmbient();
      this.audio.startGameplayAmbient();
      this.audio.startMusic();
    });
    this.difficulty = snap.difficulty ?? 'normal';
    this.modifiers = snap.modifiers ?? [];
    this.isDaily = snap.isDaily ?? false;
    this.resetRunState();
    this.mapIndex = snap.mapIndex;
    this.seed = snap.seed;
    this.map = this.createMapForRun();
    this.gold = snap.gold;
    this.lives = snap.lives;
    this.maxLives = Math.max(snap.lives, STARTING_LIVES);
    this.score = snap.score;
    this.wave = snap.wave;
    this.endless = snap.endless;
    this.occupied.clear();
    this.wallTiles.clear();
    this.towers = [];
    for (const t of snap.towers) {
      const tower = new Tower();
      tower.place(t.type as TowerType, t.x, t.y, t.targeting as TargetingMode);
      tower.level = t.level;
      tower.path = (t.path as UpgradePath | null | undefined) ?? null;
      tower.targeting = t.targeting as TargetingMode;
      tower.totalInvested = t.invested;
      tower.refreshStats();
      this.towers.push(tower);
      this.occupied.add(this.tileKey(t.x, t.y));
      if (isWallType(tower.type)) {
        const { c, r } = worldToTile(tower.x, tower.y);
        this.wallTiles.add(tileKey(c, r));
      }
    }
    if (this.wallTiles.size > 0) {
      rebuildPathsWithWalls(this.map, this.wallTiles);
    }
    this.camera.centerOn(this.map.base.x - 100, this.map.base.y);
    this.phase = 'playing';
    this.waveReady = true;
    this.refreshWavePreview();
    this.ui.show('hud');
    this.camera.setInsets({ ...HUD_INSETS });
    const mini = this.ui.getMinimapCanvas();
    if (mini) this.renderer.attachMinimap(mini);
  }

  private resetRunState(): void {
    const diff = DIFFICULTIES[this.difficulty];
    this.bonuses = computeBonuses(this.save.data.skillTree);
    const prest = prestigeBonuses(this.save.data.prestigeLevel);
    this.rangeMult = this.bonuses.rangeMult;
    this.killGoldMult = this.bonuses.killGoldMult;
    const bank = this.save.data.bankedGold;
    this.save.data.bankedGold = 0;
    this.gold = Math.max(
      1,
      Math.floor(
        (STARTING_GOLD +
          prest.startingGold +
          this.bonuses.startingGold +
          bank) *
          diff.startingGoldMult,
      ),
    );
    if (bank > 0) this.ui.showToast(`Banked gold applied: +${bank}g`);
    this.lives = STARTING_LIVES + this.bonuses.startingLives + diff.startingLivesDelta;
    if (this.hasModifier('glassCannon')) this.lives = 10;
    this.maxLives = this.lives;
    this.score = 0;
    this.wave = 0;
    this.speed = 1;
    this.endless = false;
    this.towers = [];
    this.enemies = [];
    this.combat.clear();
    this.particles.clear();
    this.abilities.reset();
    this.abilities.setCooldownReduction(this.bonuses.abilityCdr);
    this.combat.globalCritBonus = this.bonuses.critBonus;
    this.combat.globalDamageMult =
      this.bonuses.damageMult *
      prest.damageMult *
      (this.hasModifier('glassCannon') ? 1.25 : 1);
    this.combat.globalRangeMult = this.rangeMult;
    this.killFeed = [];
    this.wavePreviewLabel = '';
    this.combat.envDamageMult = 1;
    this.combat.envCritMult = 1;
    this.combat.envProjectileSpeedMult = 1;
    this.bindCombatWorldHooks();
    this.occupied.clear();
    this.buildType = null;
    this.selectedTower = null;
    this.selectedEnemy = null;
    this.abilityAim = null;
    this.waveDef = null;
    this.waveActive = false;
    this.waveReady = true;
    this.autoWaves = false;
    this.blitzActive = false;
    this.showAllRanges = false;
    this.session = createSessionCounters();
    this.pausedByPlayer = false;
    this.prepareTimer = 0;
    this.reinforcePause = 0;
    this.reinforcedThisWave = false;
    this.runTime = 0;
    this.envLabel = 'Day';
    this.bridgeMode = false;
    this.wallTiles.clear();
    this.sellArmedId = 0;
    this.upgradeArmedId = 0;
    this.targetingClipboard = null;
    this.undo = null;
    if (this.hasModifier('ironman')) this.save.clearContinue();
  }

  private toMenu(): void {
    this.recordDailyIfNeeded();
    this.persistContinue();
    if (this.runStartedAt > 0 && this.phase !== 'victory' && this.phase !== 'defeat') {
      this.finishReplay(false);
    }
    this.phase = 'menu';
    this.levelIntro = false;
    this.introFade = 0;
    this.audio.stopGameplayAmbient();
    this.audio.stopMusic();
    this.camera.setInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    this.ui.clearFade();
    this.ui.show('main');
  }

  private pause(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.pausedByPlayer = true;
    this.persistContinue();
    this.ui.show('pause');
  }

  private resume(): void {
    if (this.phase !== 'paused' && this.ui.getScreen() !== 'pause') return;
    this.phase = 'playing';
    this.pausedByPlayer = false;
    this.ui.show('hud');
    this.camera.setInsets({ ...HUD_INSETS });
    const mini = this.ui.getMinimapCanvas();
    if (mini) this.renderer.attachMinimap(mini);
  }

  private setSpeed(s: GameSpeed): void {
    if (!(GAME_SPEEDS as readonly number[]).includes(s)) return;
    this.blitzActive = false;
    this.speed = s;
    if (s === 0) this.pausedByPlayer = true;
    else this.pausedByPlayer = false;
  }

  /** Resolve the current (or next) wave at extreme simulation speed. */
  private startBlitz(): void {
    if (this.phase !== 'playing') return;
    if (this.waveReady && !this.waveActive) {
      this.startWave();
    }
    if (!this.waveActive) {
      this.ui.showToast('No wave to blitz');
      return;
    }
    this.blitzActive = true;
    this.pausedByPlayer = false;
    if (this.speed === 0) this.speed = 1;
    this.ui.showToast('Blitz — resolving wave…');
  }

  private tileKey(x: number, y: number): string {
    const snap = snapToTileCenter(x, y);
    return `${snap.x},${snap.y}`;
  }

  private makeWave(wave: number): WaveDef {
    if (this.map?.id === 'bastion-approach' && !this.endless) {
      return buildBastionApproachWave(wave);
    }
    return buildWave(
      wave,
      this.seed,
      DIFFICULTIES[this.difficulty],
      getPathCount(this.map),
    );
  }

  private startWave(): void {
    if (!this.waveReady || this.waveActive || this.levelIntro) return;
    this.prepareTimer = 0;
    this.wave++;
    this.session.highestWave = Math.max(this.session.highestWave, this.wave);
    this.waveDef = this.makeWave(this.wave);
    this.waveTime = 0;
    this.spawnIndex = 0;
    this.pendingSpawns = this.waveDef.spawns.length;
    this.waveActive = true;
    this.waveReady = false;
    this.livesAtWaveStart = this.lives;
    this.reinforcedThisWave = false;
    this.reinforcePause = 0;
    this.audio.play('wave');
    this.audio.duck(0.4, 1.1);
    this.ui.showCinematicBanner(`WAVE ${this.wave}`, 1.6);
    this.bus.emit(GameEvents.WAVE_STARTED, { wave: this.wave });
    this.replay.record({ kind: 'wave', wave: this.wave });
    if (!this.save.data.settings.tutorialDone) {
      const tip = tutorialTipForWave(this.wave);
      if (tip) this.ui.showToast(tip);
      if (this.wave >= 3) {
        this.save.data.settings.tutorialDone = true;
        this.save.save();
      }
    }
  }

  private enterEndless(): void {
    this.endless = true;
    this.phase = 'playing';
    this.waveReady = true;
    this.waveActive = false;
    this.ui.show('hud');
    this.camera.setInsets({ ...HUD_INSETS });
    const mini = this.ui.getMinimapCanvas();
    if (mini) this.renderer.attachMinimap(mini);
    this.session.highestWave = Math.max(this.session.highestWave, this.wave);
    this.achievements.check(this.session, this.lives, STARTING_LIVES, false);
  }

  private beginAbility(id: AbilityType): void {
    if (!this.abilities.isReady(id)) {
      this.ui.showToast('Ability on cooldown');
      return;
    }
    if (this.gold < ABILITY_DEFS[id].cost) {
      this.ui.showToast('Not enough gold');
      return;
    }
    if (this.abilities.needsTarget(id)) {
      this.abilityAim = id;
      this.buildType = null;
      this.ui.clearBuildSelection();
      this.ui.showToast(`Click to aim ${ABILITY_DEFS[id].name}`);
      return;
    }
    this.castAbility(id, this.camera.x, this.camera.y);
  }

  private castAbility(id: AbilityType, x: number, y: number): void {
    const result = this.abilities.tryActivate(id, this.gold, x, y, this.enemies, this.particles);
    if (!result.ok) {
      this.ui.showToast(result.reason ?? 'Failed');
      return;
    }
    this.gold -= result.cost;
    this.session.goldSpent += result.cost;
    this.session.abilitiesUsed.add(id);
    this.save.data.statistics.abilitiesUsed++;
    this.audio.play('ability');
    this.replay.record({ kind: 'ability', type: id, x, y });
    this.camera.shake(id === 'nuke' ? 18 : 8);
    // Collect kills from ability
    for (const e of this.enemies) {
      if (!e.active && e.hp <= 0) {
        this.registerKill(e, null);
      }
    }
    this.enemies = this.enemies.filter((e) => e.active);
    this.abilityAim = null;
    this.achievements.check(this.session, this.lives, STARTING_LIVES, false);
  }

  private tryBuildBridgeAt(wx: number, wy: number): boolean {
    if (!isInBounds(wx, wy)) return false;
    const { c, r } = worldToTile(wx, wy);
    if (!isGapTile(this.map, wx, wy) || hasBridgeAt(this.map, c, r)) return false;
    if (this.gold < BRIDGE_COST) {
      this.ui.showToast(`Need ${BRIDGE_COST}g for a bridge`);
      return true;
    }
    if (!tryBuildBridge(this.map, c, r)) {
      this.ui.showToast('Cannot build bridge here');
      return true;
    }
    this.gold -= BRIDGE_COST;
    this.session.goldSpent += BRIDGE_COST;
    this.audio.play('build');
    this.replay.record({ kind: 'bridge', x: wx, y: wy });
    this.ui.showToast('Bridge built');
    return true;
  }

  private tryBuild(wx: number, wy: number): void {
    if (!isInBounds(wx, wy)) {
      this.ui.showToast('Outside the map');
      return;
    }
    if (isGapTile(this.map, wx, wy)) {
      this.tryBuildBridgeAt(wx, wy);
      return;
    }
    if (!this.buildType) return;
    if (!this.save.isTowerUnlocked(this.buildType)) {
      this.ui.showToast('Tower locked — progress the campaign to unlock');
      return;
    }

    const snap = snapToTileCenter(wx, wy);
    const key = `${snap.x},${snap.y}`;
    const discount =
      this.bonuses.towerDiscount + (isWallType(this.buildType) ? this.bonuses.wallDiscount : 0);
    const cost = Math.max(
      1,
      Math.floor(TOWER_DEFS[this.buildType].cost * (1 - Math.min(0.5, discount))),
    );

    if (isWallType(this.buildType)) {
      const reason = canPlaceWallAt(this.map, snap.x, snap.y, this.wallTiles, this.occupied);
      if (reason) {
        this.ui.showToast(BUILD_REJECT_LABELS[reason]);
        return;
      }
      if (this.gold < cost) {
        this.ui.showToast(BUILD_REJECT_LABELS['need-gold']);
        return;
      }
      const { c, r } = worldToTile(snap.x, snap.y);
      const nextWalls = new Set(this.wallTiles);
      nextWalls.add(tileKey(c, r));
      if (!rebuildPathsWithWalls(this.map, nextWalls)) {
        this.ui.showToast(BUILD_REJECT_LABELS['blocks-path']);
        return;
      }
      this.wallTiles = nextWalls;
      this.repathGroundEnemies();
    } else {
      const reason = getTowerBuildRejectReason(
        this.map,
        snap.x,
        snap.y,
        this.occupied,
        this.gold,
        cost,
      );
      if (reason) {
        this.ui.showToast(BUILD_REJECT_LABELS[reason]);
        return;
      }
    }

    const presets = this.save.data.settings.targetingPresets;
    const targeting =
      presets[this.buildType] ?? TOWER_DEFS[this.buildType].defaultTargeting ?? 'first';
    const tower = new Tower();
    tower.place(this.buildType, snap.x, snap.y, targeting);
    tower.totalInvested = cost;
    this.towers.push(tower);
    this.occupied.add(key);
    this.gold -= cost;
    this.session.goldSpent += cost;
    this.session.towersBuilt++;
    this.session.towerTypesBuilt.add(this.buildType);
    this.save.data.statistics.towersBuilt++;
    this.audio.play('hammer', 0.4);
    this.audio.play('build', 0.55);
    this.particles.burst(snap.x, snap.y + 6, 16, '#c4a35a', 80, {
      gravity: 45,
      life: 0.4,
      size: 2.5,
    });
    this.particles.burst(snap.x, snap.y, 8, '#e8e5d8', 45, {
      gravity: -12,
      life: 0.3,
      size: 2,
      glow: true,
    });
    this.selectedTower = null;
    this.undo = { kind: 'build', towerId: tower.id, cost, expires: performance.now() + 6000 };
    this.replay.record({
      kind: 'build',
      type: this.buildType,
      x: snap.x,
      y: snap.y,
      targeting: tower.targeting,
    });
    this.bus.emit(GameEvents.TOWER_BUILT, { tower });
    this.achievements.check(this.session, this.lives, STARTING_LIVES, false);
  }

  private repathGroundEnemies(): void {
    for (const e of this.enemies) {
      if (!e.active || e.flying) continue;
      const lane = e.pathIndex;
      const path = this.map.paths[lane] ?? this.map.path;
      e.repath(path);
    }
  }

  private selectAt(wx: number, wy: number): void {
    let bestTower: Tower | null = null;
    let bestTowerD = 28 * 28;
    for (const t of this.towers) {
      if (!t.active) continue;
      const d = (t.x - wx) * (t.x - wx) + (t.y - wy) * (t.y - wy);
      if (d < bestTowerD) {
        bestTowerD = d;
        bestTower = t;
      }
    }
    let bestEnemy: Enemy | null = null;
    let bestEnemyD = 22 * 22;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const r = e.radius + 6;
      const d = (e.x - wx) * (e.x - wx) + (e.y - wy) * (e.y - wy);
      if (d < r * r && d < bestEnemyD) {
        bestEnemyD = d;
        bestEnemy = e;
      }
    }

    this.buildType = null;
    this.sellArmedId = 0;
    this.upgradeArmedId = 0;
    this.ui.clearBuildSelection();

    // Prefer towers when both are near the click
    if (bestTower && bestTowerD <= bestEnemyD) {
      this.selectedTower = bestTower;
      this.selectedEnemy = null;
    } else if (bestEnemy) {
      this.selectedEnemy = bestEnemy;
      this.selectedTower = null;
    } else {
      this.selectedTower = null;
      this.selectedEnemy = null;
    }
  }

  private upgradeSelected(path?: UpgradePath): void {
    const t = this.selectedTower;
    if (!t || t.isWall) return;
    const choices = t.upgradeChoices();
    if (choices.length === 0) return;

    // Tier 1 → must pick a branch
    if (t.level === 1 && !path) {
      this.ui.showToast('Choose an upgrade path');
      return;
    }

    const choice = path
      ? choices.find((c) => c.path === path)
      : choices[0];
    if (!choice) return;
    if (this.gold < choice.cost) {
      this.ui.showToast('Not enough gold');
      return;
    }

    this.gold -= choice.cost;
    this.session.goldSpent += choice.cost;
    if (!t.upgrade(choice.path)) {
      this.gold += choice.cost;
      this.session.goldSpent -= choice.cost;
      return;
    }
    if (t.level >= TOWER_DEFS[t.type].maxLevel) this.session.maxedTower = true;
    this.audio.play('upgrade');
    this.particles.burst(t.x, t.y, 10, TOWER_DEFS[t.type].accent, 60, {
      glow: true,
      life: 0.3,
    });
    this.undo = { kind: 'upgrade', towerId: t.id, cost: choice.cost, expires: performance.now() + 6000 };
    this.replay.record({ kind: 'upgrade', type: t.type, x: t.x, y: t.y, level: t.level });
    this.bus.emit(GameEvents.TOWER_UPGRADED, { tower: t });
    this.ui.showToast(`${choice.name} — Undo (Z)`);
    this.achievements.check(this.session, this.lives, STARTING_LIVES, false);
  }

  private sellSelected(): void {
    if (this.hasModifier('noSell')) {
      this.ui.showToast('No Refunds — selling disabled');
      return;
    }
    const t = this.selectedTower;
    if (!t) return;
    if (this.save.data.settings.confirmSell && this.sellArmedId !== t.id) {
      this.sellArmedId = t.id;
      this.ui.showToast('Click Sell again to confirm');
      return;
    }
    this.sellArmedId = 0;
    const value = t.sellValue();
    const snap = {
      type: t.type,
      x: t.x,
      y: t.y,
      level: t.level,
      targeting: t.targeting,
      invested: t.totalInvested,
      path: t.path,
    };
    this.gold += value;
    this.occupied.delete(`${t.x},${t.y}`);
    if (t.isWall) {
      const { c, r } = worldToTile(t.x, t.y);
      this.wallTiles.delete(tileKey(c, r));
      rebuildPathsWithWalls(this.map, this.wallTiles);
      this.repathGroundEnemies();
    }
    this.particles.burst(t.x, t.y, 12, '#c4b89a', 70, { gravity: 40, life: 0.35 });
    this.audio.play('sell');
    t.active = false;
    this.towers = this.towers.filter((x) => x !== t);
    this.selectedTower = null;
    this.replay.record({ kind: 'sell', type: snap.type, x: snap.x, y: snap.y });
    this.bus.emit(GameEvents.TOWER_SOLD, { type: snap.type });
    this.undo = {
      kind: 'sell',
      ...snap,
      refund: value,
      expires: performance.now() + 6000,
    };
    this.ui.showToast(`Sold (+${value}g)`);
  }

  private cycleTargeting(): void {
    if (!this.selectedTower || this.selectedTower.isWall) return;
    this.selectedTower.targeting = nextTargeting(this.selectedTower.targeting);
    this.save.data.settings.targetingPresets[this.selectedTower.type] = this.selectedTower.targeting;
    this.save.save();
    this.ui.showToast(
      `${TOWER_DEFS[this.selectedTower.type].name}: ${TARGETING_LABELS[this.selectedTower.targeting]}`,
    );
  }

  private applyTargetingToType(): void {
    const t = this.selectedTower;
    if (!t || t.isWall) return;
    let n = 0;
    for (const other of this.towers) {
      if (!other.active || other.type !== t.type) continue;
      other.targeting = t.targeting;
      n++;
    }
    this.save.data.settings.targetingPresets[t.type] = t.targeting;
    this.save.save();
    this.ui.showToast(`Applied ${t.targeting} to ${n} ${TOWER_DEFS[t.type].name}(s)`);
  }

  private copyTargeting(): void {
    if (!this.selectedTower || this.selectedTower.isWall) return;
    this.targetingClipboard = this.selectedTower.targeting;
    this.ui.showToast(`Copied targeting: ${this.targetingClipboard}`);
  }

  private pasteTargeting(): void {
    if (!this.selectedTower || this.selectedTower.isWall || !this.targetingClipboard) {
      this.ui.showToast(this.targetingClipboard ? 'Select a tower first' : 'Copy a targeting mode first');
      return;
    }
    this.selectedTower.targeting = this.targetingClipboard;
    this.save.data.settings.targetingPresets[this.selectedTower.type] = this.targetingClipboard;
    this.save.save();
    this.ui.showToast(`Pasted targeting: ${this.targetingClipboard}`);
  }

  private undoLastAction(): void {
    if (!this.undo || performance.now() > this.undo.expires) {
      this.ui.showToast('Nothing to undo');
      this.undo = null;
      return;
    }
    const action = this.undo;
    this.undo = null;

    if (action.kind === 'build') {
      const t = this.towers.find((x) => x.id === action.towerId);
      if (!t) return;
      this.occupied.delete(`${t.x},${t.y}`);
      if (t.isWall) {
        const { c, r } = worldToTile(t.x, t.y);
        this.wallTiles.delete(tileKey(c, r));
        rebuildPathsWithWalls(this.map, this.wallTiles);
        this.repathGroundEnemies();
      }
      t.active = false;
      this.towers = this.towers.filter((x) => x !== t);
      if (this.selectedTower?.id === t.id) this.selectedTower = null;
      this.gold += action.cost;
      this.ui.showToast('Build undone');
      this.audio.play('sell');
      return;
    }

    if (action.kind === 'upgrade') {
      const t = this.towers.find((x) => x.id === action.towerId);
      if (!t || t.level <= 1) return;
      t.level -= 1;
      t.totalInvested -= action.cost;
      if (t.level <= 1) t.path = null;
      t.refreshStats();
      this.gold += action.cost;
      this.ui.showToast('Upgrade undone');
      return;
    }

    if (action.kind === 'sell') {
      if (this.gold < action.refund) {
        this.ui.showToast('Not enough gold to undo sell');
        return;
      }
      const key = `${action.x},${action.y}`;
      if (this.occupied.has(key)) {
        this.ui.showToast('Tile occupied — cannot undo sell');
        return;
      }
      if (isWallType(action.type)) {
        const { c, r } = worldToTile(action.x, action.y);
        const next = new Set(this.wallTiles);
        next.add(tileKey(c, r));
        if (!rebuildPathsWithWalls(this.map, next)) {
          this.ui.showToast('Cannot restore barricade — path sealed');
          return;
        }
        this.wallTiles = next;
        this.repathGroundEnemies();
      }
      this.gold -= action.refund;
      const tower = new Tower();
      tower.place(action.type, action.x, action.y, action.targeting);
      tower.level = action.level;
      tower.path = action.path ?? null;
      tower.totalInvested = action.invested;
      tower.refreshStats();
      this.towers.push(tower);
      this.occupied.add(key);
      this.selectedTower = tower;
      this.ui.showToast('Sell undone');
      this.audio.play('build');
    }
  }

  private ghostRejectReason(): BuildRejectReason | null {
    if (!this.buildType || !isInBounds(this.input.worldX, this.input.worldY)) {
      return this.buildType ? 'out-of-bounds' : null;
    }
    if (!this.save.isTowerUnlocked(this.buildType)) return 'not-buildable';
    const snap = snapToTileCenter(this.input.worldX, this.input.worldY);
    const discount =
      this.bonuses.towerDiscount + (isWallType(this.buildType) ? this.bonuses.wallDiscount : 0);
    const cost = Math.max(
      1,
      Math.floor(TOWER_DEFS[this.buildType].cost * (1 - Math.min(0.5, discount))),
    );
    if (isWallType(this.buildType)) {
      return canPlaceWallAt(this.map, snap.x, snap.y, this.wallTiles, this.occupied)
        ?? (this.gold < cost ? 'need-gold' : null);
    }
    return getTowerBuildRejectReason(this.map, snap.x, snap.y, this.occupied, this.gold, cost);
  }

  private registerKill(
    enemy: Enemy,
    tower: Tower | null,
    sourceLabel?: string,
  ): void {
    const reward = Math.round(
      enemy.reward * this.abilities.goldMultiplier() * this.killGoldMult,
    );
    this.gold += reward;
    const scoreGain = Math.round(
      (reward * 10 + (enemy.isBoss ? 500 : 0)) * DIFFICULTIES[this.difficulty].scoreMult,
    );
    this.score += scoreGain;
    this.session.kills++;
    this.session.goldEarned += reward;
    this.save.data.statistics.enemiesKilled++;
    this.save.data.statistics.moneyEarned += reward;
    if (enemy.isBoss) {
      this.session.bossesKilled++;
      this.save.data.statistics.bossesDefeated++;
    }
    if (tower?.type === 'rocket') this.session.rocketKills++;
    const name = ENEMY_DEFS[enemy.type]?.name ?? enemy.type;
    const by = tower ? TOWER_DEFS[tower.type].name : (sourceLabel ?? 'Ability');
    this.pushKillFeed(`${by} → ${name} (+${reward}g)`);
    if (reward > 0) {
      this.particles.showGold(enemy.x, enemy.y - enemy.radius, reward);
      this.audio.play('gold', 0.35);
      this.goldPulse = 0.35;
    }
    this.bus.emit(GameEvents.ENEMY_KILLED, { enemy, tower });
    this.achievements.check(this.session, this.lives, STARTING_LIVES, false);
  }

  private pushKillFeed(text: string): void {
    if (!this.save.data.settings.showKillFeed) return;
    this.killFeed.unshift({ text, t: performance.now() });
    if (this.killFeed.length > 8) this.killFeed.length = 8;
  }

  private refreshWavePreview(): void {
    if (!this.save.data.settings.showWavePreview) {
      this.wavePreviewLabel = '';
      return;
    }
    const next = this.wave + 1;
    const def = this.makeWave(next);
    const sum = summarizeWave(def);
    this.wavePreviewLabel = `Next W${next}: ${sum.total} foes${sum.boss ? ' · BOSS' : ''} — ${sum.label}`;
  }

  private onWaveCleared(): void {
    this.waveActive = false;
    this.waveReady = true;
    this.blitzActive = false;
    const diff = DIFFICULTIES[this.difficulty];
    const poverty = this.povertyMult();
    const flawless = this.lives >= this.livesAtWaveStart;
    let bonus = Math.round((WAVE_CLEAR_BONUS_BASE + this.wave * 5) * poverty);
    if (flawless) {
      bonus += Math.round(FLAWLESS_BONUS * poverty);
      this.session.flawlessWaves++;
      this.session.consecutiveFlawless++;
    } else {
      this.session.consecutiveFlawless = 0;
    }
    const prestInterest = prestigeBonuses(this.save.data.prestigeLevel).interestBonus;
    const interest = Math.min(
      INTEREST_CAP,
      Math.floor(
        this.gold *
          (INTEREST_RATE + this.bonuses.interestBonus + prestInterest) *
          diff.interestMult *
          poverty,
      ),
    );
    bonus = Math.round(bonus * this.killGoldMult);
    this.gold += bonus + interest;
    this.session.goldEarned += bonus + interest;
    this.save.data.statistics.moneyEarned += bonus + interest;
    this.score += Math.round(bonus * 5 * diff.scoreMult);
    this.ui.showCinematicBanner('Wave Cleared', 1.35, `+${bonus + interest}g`);
    this.audio.play('wave_clear', 0.55);
    this.audio.duck(0.35, 0.9);
    this.camera.shake(3);
    this.goldPulse = 0.5;

    this.save.data.statistics.highestWave = Math.max(this.save.data.statistics.highestWave, this.wave);
    const beforeTowers = new Set(this.save.data.unlockedTowers);
    this.save.syncProgressUnlocks();
    for (const rule of TOWER_UNLOCK_RULES) {
      if (!beforeTowers.has(rule.type) && this.save.isTowerUnlocked(rule.type)) {
        this.ui.showToast(`Unlocked ${TOWER_DEFS[rule.type].name}!`);
      }
    }
    this.persistContinue();
    this.achievements.check(this.session, this.lives, STARTING_LIVES, false);

    // Unlock next map periodically
    if (this.wave >= 8) this.save.unlockMap('serpent-marsh');
    if (this.wave >= 12) this.save.unlockMap('hollow-grove');
    if (this.wave >= 18) this.save.unlockMap('iron-causeway');
    if (this.wave >= 22) this.save.unlockMap('crimson-ridge');
    if (this.wave >= 30) this.save.unlockMap('twin-forks');

    const cap = this.campaignWaveCap();
    if (!this.endless && this.wave >= cap) {
      this.phase = 'victory';
      this.autoWaves = false;
      this.save.data.statistics.wins++;
      const prest = prestigeBonuses(this.save.data.prestigeLevel);
      this.save.data.researchPoints += 5 + prest.researchPointBonus;
      this.save.data.prestigeLevel = Math.max(this.save.data.prestigeLevel, 1);
      this.save.unlockCosmetic('crimson');
      this.recordDailyIfNeeded();
      this.save.clearContinue();
      this.save.save();
      this.audio.play('victory');
      this.finishReplay(true);
      this.achievements.check(this.session, this.lives, STARTING_LIVES, true);
      this.bus.emit(GameEvents.VICTORY, { wave: this.wave, score: this.score });
      this.ui.show('victory', this.endPayload(true));
      return;
    }

    const between =
      this.map?.id === 'bastion-approach' && !this.endless
        ? PREPARE_BETWEEN_SECONDS
        : this.autoWaves
          ? 1.2
          : 4;
    this.beginPreparePhase(between);
  }

  private gameOver(): void {
    this.phase = 'defeat';
    this.blitzActive = false;
    this.autoWaves = false;
    this.save.data.statistics.losses++;
    this.recordDailyIfNeeded();
    this.save.clearContinue();
    this.save.save();
    this.audio.play('defeat');
    this.finishReplay(false);
    this.achievements.check(this.session, this.lives, STARTING_LIVES, false);
    this.bus.emit(GameEvents.GAME_OVER, { wave: this.wave, score: this.score });
    this.ui.show('gameOver', this.endPayload(false));
  }

  private persistContinue(): void {
    if (this.hasModifier('ironman')) {
      this.save.clearContinue();
      return;
    }
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    const snapshot: GameProgressSnapshot = {
      mapId: this.map.id,
      mapIndex: this.mapIndex,
      wave: this.wave,
      gold: this.gold,
      lives: this.lives,
      score: this.score,
      endless: this.endless,
      seed: this.seed,
      difficulty: this.difficulty,
      modifiers: [...this.modifiers],
      isDaily: this.isDaily,
      towers: this.towers.filter((t) => t.active).map((t) => ({
        type: t.type,
        x: t.x,
        y: t.y,
        level: t.level,
        targeting: t.targeting,
        invested: t.totalInvested,
        path: t.path,
      })),
    };
    this.save.setContinue(snapshot);
  }

  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  }

  private handleInput(dt: number): void {
    // Camera
    if (this.input.wheelDelta) {
      this.camera.zoomBy(this.input.wheelDelta, this.input.mouseX, this.input.mouseY);
    }
    const pinch = this.input.getPinchZoomDelta();
    if (pinch) this.camera.zoomBy(pinch);

    const drag = this.input.consumeDragPan();
    if (drag.dx || drag.dy) {
      this.camera.pan(-drag.dx, -drag.dy);
    }

    this.camera.update(
      dt,
      this.levelIntro
        ? { left: false, right: false, up: false, down: false }
        : this.input.getPanKeys(),
    );
    this.updateLevelIntro(dt);

    // Refresh world coords
    const w = this.camera.screenToWorld(this.input.mouseX, this.input.mouseY);
    this.input.worldX = w.x;
    this.input.worldY = w.y;

    if (this.input.consumeKey(this.input.bindings.pause)) {
      if (this.phase === 'playing') this.pause();
      else if (this.phase === 'paused') this.resume();
    }
    if (this.input.consumeKey(this.input.bindings.speed1)) this.setSpeed(1);
    if (this.input.consumeKey(this.input.bindings.speed2)) this.setSpeed(2);
    if (this.input.consumeKey(this.input.bindings.speed4)) this.setSpeed(4);
    if (this.input.consumeKey(this.input.bindings.cancel)) {
      this.cancelBuildPlacement();
      this.selectedTower = null;
    }
    if (this.input.justRightClicked) {
      this.cancelBuildPlacement();
    }
    if (this.input.consumeKey(this.input.bindings.sell)) this.sellSelected();
    if (this.input.consumeKey(this.input.bindings.undo)) this.undoLastAction();

    const abilityKeys: AbilityType[] = ['meteor', 'freeze', 'airstrike', 'emp', 'nuke', 'goldboost'];
    const codes = [
      this.input.bindings.ability1,
      this.input.bindings.ability2,
      this.input.bindings.ability3,
      this.input.bindings.ability4,
      this.input.bindings.ability5,
      this.input.bindings.ability6,
    ];
    for (let i = 0; i < codes.length; i++) {
      if (this.input.consumeKey(codes[i]!)) this.beginAbility(abilityKeys[i]!);
    }

    // Placement is available as soon as the fade clears (intro camera may still settle)
    const canInteractMap =
      this.phase === 'playing' && !this.photoMode && this.introFade < 0.05;
    if (canInteractMap && this.input.justClicked) {
      void this.ensureAudio();
      if (this.abilityAim) {
        this.castAbility(this.abilityAim, this.input.worldX, this.input.worldY);
      } else if (this.buildType) {
        this.tryBuild(this.input.worldX, this.input.worldY);
      } else if (this.tryBuildBridgeAt(this.input.worldX, this.input.worldY)) {
        // bridge placed or gap click handled
      } else {
        this.selectAt(this.input.worldX, this.input.worldY);
      }
    }

    // Bridge ghost when hovering an unbuilt gap with no tower selected
    if (this.map && (this.phase === 'playing' || this.phase === 'paused')) {
      const wx = this.input.worldX;
      const wy = this.input.worldY;
      const { c, r } = worldToTile(wx, wy);
      this.bridgeMode =
        !this.buildType &&
        !this.abilityAim &&
        isInBounds(wx, wy) &&
        isGapTile(this.map, wx, wy) &&
        !hasBridgeAt(this.map, c, r);
    } else {
      this.bridgeMode = false;
    }

    // Touch two-finger pan
    if (this.input.touches.length === 2) {
      const a = this.input.touches[0]!;
      const b = this.input.touches[1]!;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      // slight recentering feel — skip heavy logic
      void cx;
      void cy;
    }
  }

  private updateGameplay(dt: number): void {
    this.runTime += dt;
    const env = computeEnvironment(this.runTime, this.map.id, this.modifiers);
    this.dayNight = env.dayNight;
    this.weather = env.weather;
    this.envLabel = env.label;
    this.combat.envDamageMult = env.damageMult;
    this.combat.envCritMult = env.critMult;
    this.combat.envProjectileSpeedMult = env.projectileSpeedMult;

    this.abilities.update(dt);
    if (this.speed === 4) this.session.timeAt4x += dt;

    if (this.prepareTimer > 0 && !this.levelIntro) {
      this.prepareTimer -= dt;
      if (this.prepareTimer <= 0) {
        this.prepareTimer = 0;
        if (this.waveReady && !this.waveActive && this.phase === 'playing') {
          this.startWave();
        }
      }
    }

    if (this.reinforcePause > 0) {
      this.reinforcePause -= dt;
      if (this.reinforcePause < 0) this.reinforcePause = 0;
    }

    const diff = DIFFICULTIES[this.difficulty];

    // Spawns (paused during mid-wave reinforce window)
    if (this.waveActive && this.waveDef && this.reinforcePause <= 0) {
      this.waveTime += dt;
      while (
        this.spawnIndex < this.waveDef.spawns.length &&
        this.waveTime >= this.waveDef.spawns[this.spawnIndex]!.time
      ) {
        const ev = this.waveDef.spawns[this.spawnIndex]!;
        const lane = ev.pathIndex ?? 0;
        const isFlying = !!ENEMY_DEFS[ev.type]?.flying;
        const path = isFlying
          ? (this.map.basePaths[lane] ?? this.map.basePaths[0] ?? this.map.path)
          : (this.map.paths[lane] ?? this.map.path);
        const enemy = new Enemy();
        enemy.spawn(ev.type, this.wave, path, {
          hpMult: diff.hpMult,
          rewardMult: diff.rewardMult * this.povertyMult(),
          speedMult: diff.speedMult,
          pathIndex: lane,
        });
        enemy.onBossPhase = (e, phase) => {
          this.ui.showToast(`Boss phase ${phase + 1}!`);
          this.camera.shake(10);
          for (let i = 0; i < 2; i++) {
            const add = new Enemy();
            add.spawn('basic', this.wave, e.path, {
              hpMult: diff.hpMult * 0.5,
              pathIndex: e.pathIndex,
            });
            this.enemies.push(add);
          }
        };
        this.enemies.push(enemy);
        this.spawnIndex++;
        this.pendingSpawns--;

        if (
          this.waveDef.reinforceAfter != null &&
          !this.reinforcedThisWave &&
          this.spawnIndex >= this.waveDef.reinforceAfter
        ) {
          this.reinforcedThisWave = true;
          this.reinforcePause = 2.5 * this.bonuses.prepareMult;
          this.ui.showToast('Reinforcements delayed — rebuild!');
          break;
        }
      }
    }

    // Enemies — movement, leaks, and status deaths (poison DoT, etc.)
    for (const e of this.enemies) {
      if (!e.active) {
        if (e.deathFade > 0) {
          e.updateFeel(dt);
          e.deathFade -= dt;
        }
        continue;
      }
      const tile = worldToTile(e.x, e.y);
      const onGap =
        !e.flying && isGapTile(this.map, e.x, e.y) && !hasBridgeAt(this.map, tile.c, tile.r);
      const saved = e.baseSpeed;
      if (onGap) e.baseSpeed *= 0.4;
      const hadPoison = e.status.poisonTimer > 0 || e.status.poisonDps > 0;
      const result = e.update(dt, e.path, e.pathLen);
      e.baseSpeed = saved;
      if (result === 'leaked') {
        const leakDmg = Math.max(
          1,
          Math.round(
            e.damageToBase *
              this.bonuses.leakDamageMult *
              (this.hasModifier('suddenDeath') ? 3 : 1),
          ),
        );
        this.lives -= leakDmg;
        this.audio.play('gate_hit', 0.55);
        this.audio.duck(0.35, 0.45);
        this.camera.shake(7);
        this.gateFlash = 0.45;
        const gx = this.map.base.x;
        const gy = this.map.base.y;
        this.particles.burst(gx, gy, 16, '#e07060', 130, { glow: true, life: 0.4 });
        this.particles.burst(gx, gy - 6, 10, '#c4a070', 70, { gravity: 50, life: 0.5, size: 2.5 });
        this.particles.burst(gx, gy - 10, 6, '#fff0e0', 50, { glow: true, life: 0.22 });
        if (this.lives <= 0) {
          this.lives = 0;
          this.gameOver();
          return;
        }
      } else if (result === 'dead' && e.hp <= 0 && e.deathFade <= 0) {
        e.beginDeath(randomRange(-30, 30), -45);
        this.registerKill(e, null, hadPoison ? 'Poison' : 'Bastion');
        this.particles.burst(e.x, e.y, e.isBoss ? 40 : 16, e.accent, 160, { glow: true });
        this.audio.play('death', 0.32);
        this.camera.shake(e.isBoss ? 8 : 2.5);
      }
    }

    // Combat
    this.combat.update(dt, this.towers, this.enemies, this.particles, {
      onDamage: (enemy, amount, crit, towerType) => {
        this.save.data.statistics.damageDealt += amount;
        this.sessionDamage += amount;
        this.session.laserDamage += towerType === 'laser' ? amount : 0;
        if (crit && towerType === 'sniper') this.session.sniperCrits++;
        if (amount >= 500) this.session.overkillHit = true;
        if (towerType === 'freeze' && enemy.status.slowTimer > 0) this.session.freezeSlows++;
        if (towerType === 'poison' && enemy.status.poisonTimer > 0) this.session.poisonApps++;
        // Subtle shake only on heavy impacts
        if (crit) this.camera.shake(2);
        else if (towerType === 'cannon' || towerType === 'rocket') this.camera.shake(2.5);
        else if (amount >= 80) this.camera.shake(1.2);
      },
      onKill: (enemy, tower) => {
        this.registerKill(enemy, tower);
        if (enemy.isBoss) this.camera.shake(10);
        else if (tower?.type === 'cannon' || tower?.type === 'rocket') this.camera.shake(4);
        else this.camera.shake(1.8);
      },
      onChainHit: () => {
        this.session.chain5 = true;
      },
      playSound: (id, vol) => this.audio.play(id, vol),
    });

    // Fog: shades lose reveal faster (harder to keep visible)
    if (this.hasModifier('fog')) {
      for (const e of this.enemies) {
        if (e.active && e.invisible && e.status.revealTimer > 0) {
          e.status.revealTimer -= dt * 0.5;
        }
      }
    }

    this.enemies = this.enemies.filter((e) => e.active || e.deathFade > 0);
    if (this.selectedEnemy && !this.selectedEnemy.active && this.selectedEnemy.deathFade <= 0) {
      this.selectedEnemy = null;
    }
    if (this.goldPulse > 0) this.goldPulse = Math.max(0, this.goldPulse - dt);
    if (this.gateFlash > 0) this.gateFlash = Math.max(0, this.gateFlash - dt);

    this.particles.update(dt);
    if (
      this.map.id === 'bastion-approach' &&
      this.save.data.settings.graphicsQuality !== 'low'
    ) {
      this.particles.ambientBastion(this.map.path, dt);
    }

    if (
      this.waveActive &&
      this.pendingSpawns <= 0 &&
      this.spawnIndex >= (this.waveDef?.spawns.length ?? 0) &&
      this.enemies.length === 0
    ) {
      this.onWaveCleared();
    }

    this.save.data.statistics.playTimeSeconds += dt;
  }

  private frame(ts: number): void {
    if (!this.lastTs) this.lastTs = ts;
    let frameDt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT;

    this.fpsAcc += frameDt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }

    const baseSpeed =
      this.phase === 'playing' && !this.pausedByPlayer && !this.photoMode
        ? this.speed === 0
          ? 0
          : this.speed
        : 0;
    const simSpeed = this.blitzActive && baseSpeed > 0 ? 48 : baseSpeed;
    if (!this.photoMode) this.handleInput(frameDt);

    const u0 = this.profiler.beginUpdate();
    if (simSpeed > 0) {
      this.acc += frameDt * simSpeed;
      let steps = 0;
      const maxSteps = this.blitzActive ? 240 : 8;
      while (this.acc >= FIXED_DT && steps < maxSteps) {
        this.updateGameplay(FIXED_DT);
        this.acc -= FIXED_DT;
        steps++;
        if (this.phase !== 'playing') break;
      }
      if (this.blitzActive && this.acc > FIXED_DT * 4) this.acc = 0;
    } else {
      this.acc = 0;
    }
    this.profiler.endUpdate(u0);

    if (this.phase === 'playing' || this.phase === 'paused' || this.photoMode) {
      this.renderer.setEnvironment(this.dayNight, this.weather);
      const snap = this.buildType
        ? snapToTileCenter(this.input.worldX, this.input.worldY)
        : null;
      if (snap) {
        if (!this.ghostHasPos) {
          this.ghostDrawX = snap.x;
          this.ghostDrawY = snap.y;
          this.ghostHasPos = true;
        } else {
          // Smooth follow without allocating — snappy enough to feel locked to grid
          const k = 1 - Math.exp(-frameDt * 22);
          this.ghostDrawX += (snap.x - this.ghostDrawX) * k;
          this.ghostDrawY += (snap.y - this.ghostDrawY) * k;
          if (Math.abs(snap.x - this.ghostDrawX) < 0.5) this.ghostDrawX = snap.x;
          if (Math.abs(snap.y - this.ghostDrawY) < 0.5) this.ghostDrawY = snap.y;
        }
      } else {
        this.ghostHasPos = false;
      }
      const ghostX = snap ? this.ghostDrawX : this.input.worldX;
      const ghostY = snap ? this.ghostDrawY : this.input.worldY;
      const ghostInBounds = !!(snap && isInBounds(snap.x, snap.y));
      const reject = this.buildType ? this.ghostRejectReason() : null;
      const ghostValid = !!(this.buildType && ghostInBounds && !reject);
      if (this.buildType && !this.photoMode) {
        this.setBuildCursor(ghostValid ? 'valid' : 'invalid');
      } else if (!this.buildType) {
        this.setBuildCursor(null);
      }

      const r0 = this.profiler.beginRender();
      this.renderer.render({
        camera: this.camera,
        map: this.map,
        towers: this.towers,
        enemies: this.enemies,
        projectiles: this.combat.projectiles.getActive(),
        particles: this.particles,
        selectedTower: this.photoMode ? null : this.selectedTower,
        ghostType: this.photoMode ? null : this.buildType,
        ghostX,
        ghostY,
        ghostValid,
        ghostReason: reject ? BUILD_REJECT_LABELS[reject] : null,
        abilityTargeting: !this.photoMode && !!this.abilityAim,
        showAllRanges: this.photoMode ? false : this.showAllRanges,
        ghostInBounds,
        dt: frameDt,
      });
      this.profiler.endRender(r0);

      const sample = this.profiler.frame(frameDt, {
        enemies: this.enemies.length,
        towers: this.towers.length,
        particles: this.particles.particles.activeCount,
      });
      if (
        this.save.data.settings.autoQuality &&
        this.profiler.shouldAutoLowerQuality() &&
        this.save.data.settings.graphicsQuality !== 'low'
      ) {
        const next =
          this.save.data.settings.graphicsQuality === 'high' ? 'medium' : 'low';
        this.applySettings({ ...this.save.data.settings, graphicsQuality: next });
        this.ui.showToast(`Auto graphics → ${next}`);
      }

      if (!this.photoMode && this.ui.getScreen() === 'hud') {
        const now = performance.now();
        this.killFeed = this.killFeed.filter((k) => now - k.t < 5000);
        const bindings = this.save.data.settings.keyBindings;
        this.ui.updateHud({
          gold: this.gold,
          lives: this.lives,
          maxLives: this.maxLives,
          gateLabel: this.map?.id === 'bastion-approach',
          goldPulse: this.goldPulse > 0,
          gateFlash: this.gateFlash > 0,
          wave: this.wave,
          maxWaves: Number.isFinite(this.campaignWaveCap())
            ? this.campaignWaveCap()
            : MAX_WAVES_CAMPAIGN,
          endless: this.endless,
          enemies:
            this.enemies.filter((e) => e.active).length + Math.max(0, this.pendingSpawns),
          score: this.score,
          fps: this.fps,
          showFps: this.save.data.settings.showFps,
          waveReady: this.waveReady,
          waveActive: this.waveActive,
          prepareTimer: this.prepareTimer,
          autoWaves: this.autoWaves,
          blitzActive: this.blitzActive,
          showAllRanges: this.showAllRanges,
          selected: this.selectedTower,
          currentTargetName: (() => {
            if (!this.selectedTower || this.selectedTower.isWall) return '';
            const tgt = this.selectedTower.selectTarget(this.enemies);
            return tgt ? (ENEMY_DEFS[tgt.type]?.name ?? tgt.type) : '';
          })(),
          selectedEnemy: (() => {
            if (!this.selectedEnemy?.active) return null;
            const e = this.selectedEnemy;
            let aimed = '';
            for (const t of this.towers) {
              if (!t.active || t.isWall) continue;
              if (t.selectTarget(this.enemies)?.id === e.id) {
                aimed = TOWER_DEFS[t.type].name;
                break;
              }
            }
            return {
              name: ENEMY_DEFS[e.type]?.name ?? e.type,
              hp: e.hp,
              maxHp: e.maxHp,
              speed: e.baseSpeed,
              armor: e.armor,
              reward: e.reward,
              targetedBy: aimed,
            };
          })(),
          abilities: this.abilities,
          envLabel: this.envLabel,
          difficulty: DIFFICULTIES[this.difficulty].name,
          wavePreview: this.waveReady ? this.wavePreviewLabel : '',
          killFeed: this.killFeed.map((k) => k.text),
          keyHints: {
            pause: bindings.pause,
            sell: bindings.sell,
            undo: bindings.undo,
            speed1: bindings.speed1,
            speed2: bindings.speed2,
            speed4: bindings.speed4,
          },
          seed: this.seed,
          mapName: this.map?.name ?? '',
          profiler: this.save.data.settings.showProfiler ? sample : undefined,
        });
      }
    } else if (this.phase === 'menu') {
      const ctx = this.canvas.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const g = ctx.createLinearGradient(0, 0, this.canvas.width * 0.3, this.canvas.height);
      g.addColorStop(0, '#151c16');
      g.addColorStop(0.5, '#0f1410');
      g.addColorStop(1, '#182018');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    this.input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }
}
