import {
  CAMERA_DEFAULT_ZOOM,
  FIXED_DT,
  FLAWLESS_BONUS,
  GAME_SPEEDS,
  INTEREST_CAP,
  INTEREST_RATE,
  MAX_FRAME_DT,
  MAX_WAVES_CAMPAIGN,
  POOL_SIZES,
  PREPARE_SECONDS,
  STARTING_GOLD,
  STARTING_LIVES,
  TILE_SIZE,
  WAVE_CLEAR_BONUS_BASE,
  GameSpeed,
} from './config/constants';
import { BiomeId, BIOME_DEFS, biomeForMap } from './config/biomes';
import { getMission, MissionDef, missionTypeLabel } from './config/campaign';
import { cosmeticDisplayName } from './config/cosmetics';
import { DIFFICULTIES, DifficultyId, migrateDifficultyId } from './config/difficulty';
import {
  applyMissionVictory,
  recommendedMission,
} from './systems/campaignProgress';
import { dailyModifiers, ModifierId } from './config/modifiers';
import {
  computeBonuses,
  prestigeBonuses,
  ResearchBonuses,
  SkillId,
  tryPurchaseSkill,
} from './systems/research';
import { ABILITY_DEFS, AbilityType } from './config/abilities';
import { ENEMY_DEFS, EnemyType } from './config/enemies';
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
import { Hero } from './entities/hero';
import { Tower } from './entities/tower';
import {
  HERO_DEFS,
  HERO_TALENTS,
  HERO_XP_PER_BOSS,
  HERO_XP_PER_KILL,
  HERO_XP_PER_WAVE,
  HeroAbilityId,
  HeroId,
  HeroTalentId,
} from './config/heroes';
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
import { buildWave, summarizeWave, tutorialTipForWave, WaveDef } from './systems/waves';
import {
  combineModifierStats,
  pickEnemyModifiers,
} from './systems/enemyModifiers';
import {
  attachAbilities,
  collectEnemyAbilities,
  notifyAbilityDamaged,
  notifyAbilityDeath,
  tickEnemyAbilities,
  type AbilityHooks,
} from './systems/enemyAbilities';
import { BossController } from './systems/bossController';
import { BOSS_DEFS } from './config/bosses';
import { ENEMY_ABILITY_DEFS } from './config/enemyAbilities';
import {
  addRelic,
  canAddRelic,
  computeRunCombatBonuses,
  createRunMeta,
  eliteRewardLabels,
  getRunRelics,
  grantResearchPointsForWave,
  pickEliteRewardChoices,
  researchLabel,
  RunCombatBonuses,
  RunMetaSnapshot,
  tryActivateRunResearch,
} from './systems/runMeta';
import { eliteRewardEffects, EliteRewardId, MAX_RELICS } from './config/eliteRewards';
import { FACTION_DEFS, FactionId } from './config/factions';
import { envModifierLabels } from './config/envModifiers';
import { RUN_RESEARCH_DEFS, RUN_RESEARCH_ORDER, RunResearchId } from './config/runResearch';
import { rollWorldEvent, tickWorldEvent } from './systems/worldEvents';
import { RunDirector } from './systems/director';
import { makeShareableSeed, rollRunIdentity } from './systems/runIdentity';
import { buildRunReport, reportToPayload } from './systems/runReport';
import {
  applyMissionLeak,
  createMissionRuntime,
  missionHudLine,
  missionObjectiveMet,
  MissionRuntime,
  onMissionWaveCleared,
} from './systems/missionObjectives';
import type { PlaytestController } from './dev/playtest';
import { ObjectPool } from './utils/pool';
import { Projectile } from './entities/projectile';
import { EventBus, GameEvents } from './utils/events';
import { dist2, hashString, randomRange } from './utils/math';
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
  private enemyPool = new ObjectPool(() => new Enemy(), 80, POOL_SIZES.enemies);
  private combat = new CombatSystem();
  private particles = new ParticleSystem();
  private abilities = new AbilitySystem();
  /** Reused each frame — never allocate projectile lists in the render path. */
  private projectileScratch: Projectile[] = [];
  /** DEV-only — loaded via dynamic import so release builds never include tools. */
  private playtest: PlaytestController | null = null;
  /** Achievement popups held back while a boss intro is playing. */
  private pendingAchievements: { name: string; icon: string; rewardText?: string }[] = [];
  private missionRuntime: MissionRuntime | null = null;

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
  private selectedHero = false;
  private hero: Hero | null = null;
  private selectedHeroId: HeroId = 'warden';
  private abilityAim: AbilityType | null = null;

  private waveDef: WaveDef | null = null;
  private waveTime = 0;
  private spawnIndex = 0;
  private waveActive = false;
  private waveReady = true;
  private livesAtWaveStart = STARTING_LIVES;
  private pendingSpawns = 0;
  private endless = false;
  private activeMission: MissionDef | null = null;
  private waveGoal = 0;
  private biomeId: BiomeId = 'forest';
  private missionBossKilled = false;
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
  private wavePulse = 0;
  private hitFlash = 0;
  private critFlash = 0;
  private bossFlash = 0;
  private bossControllers: BossController[] = [];
  /** Enemy ids that already granted BossDef spoils this wave. */
  private bossRewardsGranted = new Set<number>();
  private factionId: FactionId = 'hollowLegion';
  private director = new RunDirector();
  private damageByTower: Partial<Record<TowerType, number>> = {};
  private threatByEnemy: Partial<Record<EnemyType, number>> = {};
  private leaksThisWave = 0;
  private waveStartedAt = 0;
  private killsAtWaveStart = 0;
  /** Throttled HUD combat inspect (avoids per-frame selectTarget scans). */
  private hudInspectAcc = 0;
  private hudCurrentTargetName = '';
  private hudAimedBy = '';
  private activeEnemyCount = 0;

  private lastTs = 0;
  private acc = 0;
  private fps = 60;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private dayNight = 0;
  private weather = 0;
  private occupied = new Set<string>();
  private bonuses: ResearchBonuses = computeBonuses({});

  private difficulty: DifficultyId = 'veteran';
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
  /** Elapsed unpaused gameplay seconds after the first prep ends. */
  private survivalElapsed = 0;
  private survivalTiming = false;
  private photoMode = false;
  private sessionDamage = 0;
  private runMeta: RunMetaSnapshot = createRunMeta();
  private runBonuses: RunCombatBonuses = computeRunCombatBonuses(this.runMeta);
  /** Blocks wave start / prep while a meta choice is open. */
  private metaBlocked = false;
  private raidSpawnTimer = 0;
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
        this.startNewGame(mapIndex, daily, difficulty, modifiers, { endless: true }),
      onContinue: () => this.continueGame(),
      onResume: () => this.resume(),
      onRestart: () => {
        if (this.activeMission) {
          this.startCampaignMission(this.activeMission.id, this.difficulty);
        } else {
          this.startNewGame(this.mapIndex, false, this.difficulty, this.modifiers, {
            endless: true,
          });
        }
      },
      onRematchSeed: (seed, mapIndex, difficulty, modifiers) => {
        this.startNewGame(mapIndex, false, difficulty, modifiers, {
          endless: true,
          seed,
        });
      },
      onQuit: () => this.toMenu(),
      onPause: () => this.pause(),
      onSpeed: (s) => this.setSpeed(s as GameSpeed),
      onSelectTowerType: (t) => {
        this.buildType = t;
        this.selectedTower = null;
        this.selectedEnemy = null;
        this.selectedHero = false;
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
      onEnterBastion: () => this.openWorldMap(),
      onOpenWorldMap: () => this.openWorldMap(),
      onStartMission: (missionId, difficulty) =>
        this.startCampaignMission(missionId, difficulty),
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
      onOpenFieldResearch: () => this.openFieldResearch(),
      onActivateRunResearch: (id) => this.activateRunResearch(id as RunResearchId),
      onPickEliteReward: (id) => this.pickEliteReward(id as EliteRewardId),
      onCloseMetaOverlay: () => this.closeFieldResearch(),
      onHeroSelectedForRun: (id) => {
        this.selectedHeroId = (id as HeroId) || 'warden';
      },
      onSelectHero: () => {
        if (!this.hero) return;
        this.selectedHero = true;
        this.selectedTower = null;
        this.selectedEnemy = null;
        this.buildType = null;
        this.ui.clearBuildSelection();
      },
      onHeroAbility: (id) => this.castHeroAbility(id as HeroAbilityId),
      onPickHeroTalent: (id) => this.pickHeroTalent(id as HeroTalentId),
    });

    this.bus.on(
      GameEvents.ACHIEVEMENT_UNLOCKED,
      (def: { name: string; icon: string; rewardText?: string } | undefined) => {
        if (!def) return;
        // Never let an achievement popup interrupt a boss intro — hold and replay after.
        if (this.bossControllers.some((b) => b.state === 'intro')) {
          this.pendingAchievements.push(def);
          return;
        }
        this.presentAchievement(def);
      },
    );

    this.applySettings(this.save.data.settings);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (import.meta.env.DEV) {
      void import('./dev/playtest').then(({ PlaytestController }) => {
        this.playtest = new PlaytestController();
        this.bindPlaytest();
        window.addEventListener('keydown', (e) => {
          if (e.code === 'F8') {
            e.preventDefault();
            this.playtest?.toggle();
          }
        });
      });
    }
    this.ui.show('main');
    requestAnimationFrame((t) => this.frame(t));
  }

  private bindPlaytest(): void {
    if (!import.meta.env.DEV || !this.playtest) return;
    const pt = this.playtest;
    pt.bind({
      addGold: (n) => {
        this.gold += n;
        this.goldPulse = 0.4;
        this.ui.showToast(`+${n}g (dev)`);
      },
      setGodMode: (on) => {
        pt.godMode = on;
        this.ui.showToast(on ? 'God mode ON' : 'God mode off');
      },
      spawnEnemy: (type) => this.devSpawn(type),
      spawnBoss: () => this.devSpawn('siegeGolem'),
      skipWave: () => {
        if (this.phase !== 'playing') return;
        if (this.waveActive) {
          for (const e of this.enemies) {
            if (e.active) e.beginDeath(0, -20);
          }
          this.pendingSpawns = 0;
          this.spawnIndex = this.waveDef?.spawns.length ?? 0;
        } else {
          this.startWave();
        }
      },
      clearEnemies: () => {
        for (const e of this.enemies) {
          if (e.active) e.beginDeath(0, -30);
        }
        this.pendingSpawns = 0;
      },
      toggleDamageViz: () => {
        this.combat.showDamageNumbers = !this.combat.showDamageNumbers;
        pt.damageViz = this.combat.showDamageNumbers;
      },
      toggleProfiler: () => {
        const s = this.save.data.settings;
        s.showProfiler = !s.showProfiler;
        s.showFps = s.showProfiler || s.showFps;
        this.profiler.enabled = s.showProfiler;
        this.save.save();
        this.ui.showToast(s.showProfiler ? 'Profiler ON' : 'Profiler off');
      },
      stressSpawn: (count) => {
        for (let i = 0; i < count; i++) this.devSpawn('raider');
      },
      getState: () => ({
        gold: this.gold,
        wave: this.wave,
        enemies: this.enemies.filter((e) => e.active).length,
        towers: this.towers.filter((t) => t.active).length,
        fps: this.fps,
        godMode: pt.godMode,
        damageViz: this.combat.showDamageNumbers,
        profiler: this.save.data.settings.showProfiler,
      }),
    });
  }

  private devSpawn(type: EnemyType): void {
    if (!import.meta.env.DEV || this.phase !== 'playing' || !this.map) return;
    const enemy = this.acquireEnemy();
    const path = this.map.paths[0] ?? this.map.path;
    const diff = DIFFICULTIES[this.difficulty];
    enemy.spawn(type, Math.max(1, this.wave), path, {
      hpMult: diff.hpMult,
      speedMult: diff.speedMult,
      rewardMult: diff.rewardMult,
      pathIndex: 0,
    });
    this.prepareSpawnedEnemy(enemy);
    this.enemies.push(enemy);
    this.ui.showToast(`Spawned ${ENEMY_DEFS[type]?.name ?? type}`);
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
    const report = buildRunReport({
      victory,
      seed: this.seed,
      factionId: this.factionId,
      envModifiers: this.runMeta.envModifiers ?? [],
      relics: getRunRelics(this.runMeta),
      research: this.runMeta.activeResearch,
      difficulty: this.difficulty,
      mapName: this.map?.name ?? '',
      wave: this.wave,
      score: this.score,
      kills: this.session.kills,
      towersBuilt: this.session.towersBuilt,
      towersSold: this.runMeta.towersSold,
      towersUpgraded: this.session.towersUpgraded,
      goldEarned: this.session.goldEarned,
      goldSpent: this.session.goldSpent,
      bossesKilled: this.session.bossesKilled,
      damageDealt: this.sessionDamage,
      timeSurvived: this.survivalElapsed,
      damageByTower: this.damageByTower,
      threatByEnemy: this.threatByEnemy,
      directorNote: this.director.getHints().note,
    });
    return reportToPayload(report);
  }

  private recordProfileEnd(victory: boolean): void {
    const st = this.save.data.statistics;
    st.runsFinished++;
    st.survivalTimeTotal += this.survivalElapsed;
    st.factionGames[this.factionId] = (st.factionGames[this.factionId] ?? 0) + 1;
    if (victory) {
      st.factionWins[this.factionId] = (st.factionWins[this.factionId] ?? 0) + 1;
    }
    const hero = this.selectedHeroId ?? 'warden';
    st.heroRuns[hero] = (st.heroRuns[hero] ?? 0) + 1;
    for (const [t, n] of Object.entries(this.damageByTower)) {
      // Favor kill credit approximation from damage share
      void n;
      st.towerKills[t] = (st.towerKills[t] ?? 0) + Math.max(1, Math.round((n ?? 0) / 500));
    }
  }

  private syncRunBonuses(): void {
    this.runBonuses = computeRunCombatBonuses(this.runMeta);
    this.combat.globalRangeMult =
      this.rangeMult * this.runBonuses.rangeMult * this.runBonuses.fogRangeMult;
    this.combat.globalFireRateMult = this.runBonuses.fireRateMult;
    this.combat.globalPierceBonus = this.runBonuses.pierceBonus;
    this.combat.typeDamageMult = { ...this.runBonuses.typeDamage };
    this.combat.freezeSlowBonus = this.runBonuses.freezeSlowBonus;
    this.combat.sniperCritBonus = this.runBonuses.sniperCritBonus;
    this.combat.teslaChainBonus = this.runBonuses.teslaChainBonus;
    this.combat.rainFireMult = this.runBonuses.rainFireMult;
    this.combat.rainTeslaMult = this.runBonuses.rainTeslaMult;
    this.combat.bossEliteDamageMult = this.runBonuses.bossEliteDamageMult;
    this.combat.splashDamageMult = this.runBonuses.splashDamageMult;
    this.combat.envProjectileSpeedMult = this.runBonuses.projectileSpeedMult;
    this.combat.globalCritBonus = this.bonuses.critBonus + this.runBonuses.critBonus;
  }

  private openFieldResearch(): void {
    if (this.phase !== 'playing' || this.metaBlocked || this.levelIntro) return;
    if (this.waveActive) {
      this.ui.showToast('Research between waves');
      return;
    }
    this.metaBlocked = true;
    this.ui.showChoiceOverlay({
      title: 'Field Research',
      subtitle: `Research Points: ${this.runMeta.researchPoints} · One active node per run`,
      choices: RUN_RESEARCH_ORDER.map((id) => {
        const def = RUN_RESEARCH_DEFS[id];
        const active = this.runMeta.activeResearch === id;
        return {
          id,
          name: def.name,
          description: def.description,
          meta: active ? 'Active' : `Cost ${def.cost} RP`,
          disabled: active || this.runMeta.researchPoints < def.cost,
        };
      }),
      dismissLabel: 'Close',
      onDismiss: () => this.closeFieldResearch(),
      onPick: (id) => {
        this.activateRunResearch(id as RunResearchId);
      },
    });
  }

  private closeFieldResearch(): void {
    this.metaBlocked = false;
    this.ui.clearMetaOverlay();
  }

  private activateRunResearch(id: RunResearchId): boolean {
    const prev = this.runMeta.activeResearch;
    const result = tryActivateRunResearch(this.runMeta, id);
    if (!result.ok) {
      this.ui.showToast(result.reason ?? 'Cannot research');
      return false;
    }
    if (id === 'gate_health' && prev !== 'gate_health') {
      const before = this.maxLives;
      this.maxLives = Math.max(1, Math.round(this.maxLives * 1.1));
      this.lives = Math.min(this.maxLives, this.lives + (this.maxLives - before));
    }
    this.syncRunBonuses();
    this.ui.showToast(`${RUN_RESEARCH_DEFS[id].name} active`);
    this.closeFieldResearch();
    this.persistContinue();
    return true;
  }

  private openEliteReward(): void {
    if (!canAddRelic(this.runMeta)) {
      this.ui.showToast(`Relic limit reached (${MAX_RELICS})`);
      this.beginPreparePhase(this.autoWaves ? 1.5 : PREPARE_SECONDS);
      return;
    }
    const owned = getRunRelics(this.runMeta);
    const choices = pickEliteRewardChoices(this.seed, this.wave, owned, 3);
    this.metaBlocked = true;
    const bossEpic =
      this.bossRewardsGranted.size > 0 &&
      !!(this.waveDef?.isBossWave || this.waveDef?.isMinibossWave);
    this.ui.showChoiceOverlay({
      title: bossEpic ? 'Boss Relic' : 'Relic Found',
      subtitle: bossEpic
        ? `Choose one relic (${owned.length}/${MAX_RELICS}) — permanent this run`
        : `Wave ${this.wave} — choose a relic (${owned.length}/${MAX_RELICS})`,
      choices: choices.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
      onPick: (id) => this.pickEliteReward(id as EliteRewardId),
      dismissLabel: 'Skip',
      onDismiss: () => {
        this.metaBlocked = false;
        this.ui.clearMetaOverlay();
        this.ui.showToast('Relic skipped');
        this.beginPreparePhase(this.autoWaves ? 1.5 : PREPARE_SECONDS);
        this.persistContinue();
      },
    });
  }

  private pickEliteReward(id: EliteRewardId): void {
    if (!this.metaBlocked) return;
    if (!addRelic(this.runMeta, id)) {
      this.ui.showToast('Cannot claim relic');
      this.metaBlocked = false;
      this.ui.clearMetaOverlay();
      this.beginPreparePhase(this.autoWaves ? 1.5 : PREPARE_SECONDS);
      return;
    }
    const fx = eliteRewardEffects(id);
    if (fx.instant?.kind === 'gold') {
      this.gold += fx.instant.amount;
      this.session.goldEarned += fx.instant.amount;
      this.goldPulse = 0.5;
    } else if (fx.instant?.kind === 'gateHeal') {
      const heal = Math.max(1, Math.round(this.maxLives * fx.instant.fraction));
      this.lives = Math.min(this.maxLives, this.lives + heal);
      this.gateFlash = 0.35;
    }
    if (fx.gateHealthMult && fx.gateHealthMult !== 1) {
      const before = this.maxLives;
      this.maxLives = Math.max(1, Math.round(this.maxLives * fx.gateHealthMult));
      this.lives = Math.min(this.maxLives, this.lives + (this.maxLives - before));
    }
    this.syncRunBonuses();
    this.metaBlocked = false;
    this.ui.clearMetaOverlay();
    this.ui.showToast(`Relic: ${eliteRewardLabels([id])[0]}`);
    this.beginPreparePhase(this.autoWaves ? 1.5 : PREPARE_SECONDS);
    this.persistContinue();
  }

  private finishReplay(victory: boolean): void {
    const data = this.replay.finish({
      wave: this.wave,
      score: this.score,
      kills: this.session.kills,
      towersBuilt: this.session.towersBuilt,
      goldEarned: this.session.goldEarned,
      durationSec: this.survivalElapsed,
      victory,
    });
    if (data) this.save.setLastReplay(data);
    this.runStartedAt = 0;
    this.survivalTiming = false;
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
      const rocks = this.map.destructibles;
      for (let i = 0; i < rocks.length; i++) {
        const rock = rocks[i]!;
        const cx = rock.c * TILE_SIZE + TILE_SIZE / 2;
        const cy = rock.r * TILE_SIZE + TILE_SIZE / 2;
        if (Math.hypot(cx - x, cy - y) <= radius) {
          damageDestructible(this.map, cx, cy, damage);
        }
      }
      let bridgeBroke = false;
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
            bridgeBroke = true;
          }
        }
      }
      if (bridgeBroke) {
        rebuildPathsWithWalls(this.map, this.wallTiles);
        this.repathGroundEnemies();
        this.ui.showToast('Bridge destroyed!');
        this.camera.shake(5);
      }
    };
  }

  /** Restore bridge slots after Continue (map regen resets them). */
  private applyBridgeSnapshot(
    bridges: { c: number; r: number; built: boolean; hp: number }[] | undefined,
  ): void {
    if (!bridges?.length) return;
    for (const saved of bridges) {
      const slot = this.map.bridgeSlots.find((s) => s.c === saved.c && s.r === saved.r);
      if (!slot) continue;
      slot.hp = Math.max(1, saved.hp);
      if (saved.built) {
        if (!slot.built) tryBuildBridge(this.map, slot.c, slot.r);
        slot.hp = Math.max(1, saved.hp);
      } else {
        slot.built = false;
        slot.hp = slot.maxHp;
        this.map.tiles[slot.r]![slot.c] = 'gap';
      }
    }
  }

  private recordDailyIfNeeded(): void {
    if (!this.isDaily) return;
    const date =
      this.save.data.dailyChallengeDate ||
      (this.seed.startsWith('daily-') ? this.seed.slice(6) : new Date().toISOString().slice(0, 10));
    this.save.recordDaily({ date, score: this.score, wave: this.wave, seed: this.seed });
  }

  private openWorldMap(): void {
    this.phase = 'menu';
    this.ui.show('worldMap');
  }

  /** Title "Enter the Bastion" — first campaign mission with cinematic. */
  private enterBastionCampaign(): void {
    const m = recommendedMission(this.save.data.campaignProgress);
    this.startCampaignMission(m.id, this.save.data.lastDifficulty ?? m.difficulty, {
      cinematic: m.mapId === 'bastion-approach',
    });
  }

  private startCampaignMission(
    missionId: string,
    difficulty: DifficultyId,
    opts?: { cinematic?: boolean },
  ): void {
    const mission = getMission(missionId);
    if (!mission) {
      this.ui.showToast('Mission not found');
      return;
    }
    const mapIndex = MAP_PRESETS.findIndex((p) => p.id === mission.mapId);
    this.activeMission = mission;
    this.waveGoal = mission.waveGoal;
    this.biomeId = mission.biomeId;
    this.missionBossKilled = false;
    this.ui.setFade(opts?.cinematic ? 1 : 0.4);
    this.startNewGame(
      mapIndex >= 0 ? mapIndex : 0,
      false,
      difficulty,
      [],
      {
        cinematic: !!opts?.cinematic && mission.mapId === 'bastion-approach',
        mission,
        endless: false,
      },
    );
  }

  private startNewGame(
    mapIndex: number,
    daily: boolean,
    difficulty: DifficultyId = 'veteran',
    modifiers: ModifierId[] = [],
    opts?: {
      cinematic?: boolean;
      mission?: MissionDef | null;
      endless?: boolean;
      /** Force a shareable seed (War Room rematch). */
      seed?: string;
    },
  ): void {
    void this.ensureAudio().then(() => {
      this.audio.stopTitleAmbient();
      this.audio.startGameplayAmbient();
      this.audio.startMusic();
    });
    this.isDaily = daily;
    if (daily) {
      const day = new Date().toISOString().slice(0, 10);
      this.seed = makeShareableSeed({ daily: day });
      this.mapIndex = hashString(day) % MAP_PRESETS.length;
      this.modifiers = dailyModifiers(day);
      this.difficulty = 'commander';
      this.save.data.dailyChallengeDate = day;
      this.activeMission = null;
      this.waveGoal = 0;
      this.biomeId = 'forest';
    } else {
      this.mapIndex = mapIndex;
      this.seed = opts?.seed ?? makeShareableSeed();
      this.difficulty = migrateDifficultyId(difficulty);
      this.modifiers = [...modifiers];
      if (opts?.mission) {
        this.activeMission = opts.mission;
        this.waveGoal = opts.mission.waveGoal;
        this.biomeId = opts.mission.biomeId;
      } else if (!opts?.mission) {
        // Skirmish / endless ops
        this.activeMission = null;
        this.waveGoal = 0;
        this.biomeId = biomeForMap(MAP_PRESETS[mapIndex]?.id ?? 'bastion-approach');
      }
    }
    this.save.data.lastDifficulty = this.difficulty;
    this.resetRunState(opts?.endless ?? !this.activeMission);

    // Roll run identity (faction + 1–3 environmental modifiers)
    const identity = rollRunIdentity(this.seed);
    this.factionId = identity.factionId;
    this.runMeta.factionId = identity.factionId;
    this.runMeta.envModifiers = identity.envModifiers;
    this.director.reset();
    this.syncRunBonuses();
    this.missionRuntime = createMissionRuntime(this.activeMission);

    this.map = this.createMapForRun();
    this.biomeId = this.activeMission?.biomeId ?? biomeForMap(this.map.id);
    // Sacred Land / Broken Crown style gate integrity
    if (this.runBonuses.gateHealthMult !== 1) {
      this.maxLives = Math.max(1, Math.round(this.maxLives * this.runBonuses.gateHealthMult));
      this.lives = this.maxLives;
    }
    this.spawnHeroAtGate();
    this.phase = 'playing';
    this.ui.show('hud');
    this.camera.setInsets({ ...HUD_INSETS });
    const mini = this.ui.getMinimapCanvas();
    if (mini) this.renderer.attachMinimap(mini);
    this.save.data.statistics.gamesPlayed++;
    this.save.save();
    this.audio.play('ui_click');
    this.runStartedAt = performance.now();
    this.survivalElapsed = 0;
    this.survivalTiming = false;
    this.sessionDamage = 0;
    this.missionBossKilled = false;
    this.damageByTower = {};
    this.threatByEnemy = {};
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

    const fac = FACTION_DEFS[this.factionId];
    const envNames = envModifierLabels(this.runMeta.envModifiers ?? []);
    this.ui.showToast(`${fac.name} · ${envNames.join(' · ')}`);
    this.audio.play(fac.soundTag, 0.35);

    if (this.activeMission) {
      this.ui.showCinematicBanner(
        this.activeMission.name,
        1.8,
        `${missionTypeLabel(this.activeMission.type)} · ${fac.epithet}`,
      );
      this.audio.play(BIOME_DEFS[this.biomeId].ambientCue, 0.25);
    } else {
      this.ui.showCinematicBanner(fac.name, 1.6, envNames[0] ?? fac.epithet);
    }

    if (opts?.cinematic && this.map.id === 'bastion-approach') {
      this.beginLevelIntro();
    } else {
      this.levelIntro = false;
      this.introFade = 0;
      this.ui.clearFade();
      this.camera.centerOn(this.map.spawn.x + 200, this.map.spawn.y);
      this.camera.setZoom(CAMERA_DEFAULT_ZOOM);
      this.beginPreparePhase(PREPARE_SECONDS);
      if (!this.save.data.settings.tutorialDone && !this.activeMission) {
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

  /** Campaign soft-cap only — endless runs never end by wave count. */
  private campaignWaveCap(): number {
    if (this.activeMission && this.waveGoal > 0) return this.waveGoal;
    if (this.endless) return Number.POSITIVE_INFINITY;
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
    this.difficulty = migrateDifficultyId(snap.difficulty);
    this.modifiers = snap.modifiers ?? [];
    this.isDaily = snap.isDaily ?? false;
    this.activeMission = snap.missionId ? getMission(snap.missionId) ?? null : null;
    this.waveGoal = snap.waveGoal ?? this.activeMission?.waveGoal ?? 0;
    this.biomeId = (snap.biomeId as BiomeId) ?? this.activeMission?.biomeId ?? 'forest';
    this.resetRunState(snap.endless ?? !this.activeMission, { consumeBank: false });
    this.mapIndex = snap.mapIndex;
    this.seed = snap.seed;
    this.map = this.createMapForRun();
    this.applyBridgeSnapshot(snap.bridges);
    this.gold = snap.gold;
    this.lives = snap.lives;
    this.maxLives = Math.max(snap.maxLives ?? snap.lives, snap.lives, STARTING_LIVES);
    this.score = snap.score;
    // Mid-wave: keep wave number (abandon remainder) — never replay for double rewards
    this.wave = snap.wave;
    this.endless = snap.endless ?? !this.activeMission;
    this.runMeta = snap.runMeta
      ? {
          ...createRunMeta(),
          ...snap.runMeta,
          eliteRewards: [...(snap.runMeta.eliteRewards ?? snap.runMeta.relics ?? [])],
          relics: [...(snap.runMeta.relics ?? snap.runMeta.eliteRewards ?? [])],
          envModifiers: [...(snap.runMeta.envModifiers ?? [])],
        }
      : createRunMeta();
    if (snap.runMeta?.activeEvent) {
      this.runMeta.activeEvent = { ...snap.runMeta.activeEvent };
    }
    this.factionId = this.runMeta.factionId ?? rollRunIdentity(snap.seed).factionId;
    this.runMeta.factionId = this.factionId;
    this.director.reset();
    this.sessionDamage = snap.sessionDamage ?? 0;
    this.survivalElapsed = snap.runStartedAtOffsetSec ?? 0;
    this.survivalTiming = this.wave > 0 || !!snap.waveWasActive;
    this.runStartedAt = performance.now() - this.survivalElapsed * 1000;
    this.syncRunBonuses();
    if (snap.missionRuntime) {
      this.missionRuntime = { ...snap.missionRuntime, type: snap.missionRuntime.type as MissionRuntime['type'] };
    } else {
      this.missionRuntime = createMissionRuntime(this.activeMission);
    }
    this.missionBossKilled = !!snap.missionBossKilled;
    if (snap.sessionLite) {
      this.session.kills = snap.sessionLite.kills;
      this.session.goldEarned = snap.sessionLite.goldEarned;
      this.session.goldSpent = snap.sessionLite.goldSpent;
      this.session.towersBuilt = snap.sessionLite.towersBuilt;
      this.session.towersUpgraded = snap.sessionLite.towersUpgraded;
      this.session.bossesKilled = snap.sessionLite.bossesKilled;
      this.session.highestWave = snap.sessionLite.highestWave;
    }
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
    this.selectedHeroId = snap.selectedHeroId ?? snap.hero?.heroId ?? 'warden';
    if (snap.hero) {
      this.hero = new Hero();
      this.hero.fromSnapshot({
        ...snap.hero,
        abilityCd: {
          shieldWall: snap.hero.abilityCd.shieldWall ?? 0,
          rally: snap.hero.abilityCd.rally ?? 0,
          lastStand: snap.hero.abilityCd.lastStand ?? 0,
        },
        pendingTalentLevel: snap.hero.pendingTalentLevel ?? 0,
      });
    } else {
      this.spawnHeroAtGate();
    }
    if (snap.abilityCds) {
      for (const id of Object.keys(snap.abilityCds)) {
        const key = id as keyof typeof this.abilities.cooldowns;
        if (key in this.abilities.cooldowns) {
          this.abilities.cooldowns[key] = snap.abilityCds[id] ?? 0;
        }
      }
    }
    if (typeof snap.goldBoostTimer === 'number') {
      this.abilities.goldBoostTimer = snap.goldBoostTimer;
    }
    this.runTime = snap.runTime ?? 0;
    this.autoWaves = !!snap.autoWaves;
    this.speed = ((GAME_SPEEDS as readonly number[]).includes(snap.speed as number)
      ? snap.speed
      : 1) as GameSpeed;
    this.prepareTimer = snap.prepareTimer ?? 0;
    this.camera.centerOn(this.map.base.x - 100, this.map.base.y);
    this.phase = 'playing';
    this.waveReady = true;
    this.waveActive = false;
    this.refreshWavePreview();
    this.ui.show('hud');
    this.camera.setInsets({ ...HUD_INSETS });
    const mini = this.ui.getMinimapCanvas();
    if (mini) this.renderer.attachMinimap(mini);
    if (snap.waveWasActive) {
      this.ui.showToast('Resumed — unfinished wave abandoned; prepare for the next');
    }
  }

  private resetRunState(endless = true, opts?: { consumeBank?: boolean }): void {
    const consumeBank = opts?.consumeBank !== false;
    const diff = DIFFICULTIES[this.difficulty];
    this.bonuses = computeBonuses(this.save.data.skillTree);
    const prest = prestigeBonuses(this.save.data.prestigeLevel);
    this.rangeMult = this.bonuses.rangeMult;
    this.killGoldMult = this.bonuses.killGoldMult;
    const bank = consumeBank ? this.save.data.bankedGold : 0;
    if (consumeBank) this.save.data.bankedGold = 0;
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
    this.endless = endless;
    this.runMeta = createRunMeta();
    this.metaBlocked = false;
    this.raidSpawnTimer = 0;
    this.survivalElapsed = 0;
    this.survivalTiming = false;
    this.ui.clearMetaOverlay();
    this.towers = [];
    for (const e of this.enemies) this.enemyPool.reclaim(e);
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
    this.selectedHero = false;
    this.hero = null;
    this.bossControllers = [];
    this.bossRewardsGranted.clear();
    this.abilityAim = null;
    this.audio.stopBossMusic();
    this.waveDef = null;
    this.waveActive = false;
    this.waveReady = true;
    this.autoWaves = false;
    this.blitzActive = false;
    this.showAllRanges = false;
    this.session = createSessionCounters();
    this.director.reset();
    this.damageByTower = {};
    this.threatByEnemy = {};
    this.leaksThisWave = 0;
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
    this.sessionDamage = 0;
    this.syncRunBonuses();
    if (this.hasModifier('ironman')) this.save.clearContinue();
  }

  private toMenu(): void {
    if (this.metaBlocked && (this.phase === 'playing' || this.phase === 'paused')) {
      this.ui.showToast('Finish your choice first');
      return;
    }
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

  private presentAchievement(def: { name: string; icon: string; rewardText?: string }): void {
    this.ui.showAchievement(def.name, def.icon, def.rewardText);
    this.audio.play('achievement');
    if (def.rewardText) this.ui.showToast(def.rewardText);
  }

  private pause(): void {
    if (this.phase !== 'playing') return;
    if (this.metaBlocked) {
      this.ui.showToast('Finish your choice before pausing');
      return;
    }
    this.phase = 'paused';
    this.pausedByPlayer = true;
    this.persistContinue();
    const livesShown = this.lives > 0 ? Math.max(1, Math.ceil(this.lives)) : 0;
    this.ui.show('pause', {
      mapName: this.map?.name ?? 'Mission',
      wave: this.wave,
      gold: Math.floor(this.gold),
      lives: livesShown,
      score: this.score,
      seed: this.seed,
    });
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
    // Optional setting — off by default so Blitz never feels like a cheat
    if (!this.save.data.settings.enableBlitz && !import.meta.env.DEV) {
      this.ui.showToast('Enable Blitz in Settings → Gameplay');
      return;
    }
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
    const mode = this.isDaily ? 'daily' : this.endless ? 'endless' : 'campaign';
    return buildWave(
      wave,
      this.seed,
      DIFFICULTIES[this.difficulty],
      getPathCount(this.map),
      mode,
      {
        factionId: this.factionId,
        director: this.director.getHints(),
        envSpawnMult: this.runBonuses.envSpawnMult,
      },
    );
  }

  private acquireEnemy(): Enemy {
    return this.enemyPool.acquire() ?? new Enemy();
  }

  private startWave(): void {
    if (!this.waveReady || this.waveActive || this.levelIntro || this.metaBlocked) return;
    this.prepareTimer = 0;
    this.wave++;
    // Survival clock starts when the first prep ends and Wave 1 begins.
    if (!this.survivalTiming) this.survivalTiming = true;
    this.session.highestWave = Math.max(this.session.highestWave, this.wave);
    this.waveDef = this.makeWave(this.wave);
    this.waveTime = 0;
    this.spawnIndex = 0;
    this.pendingSpawns = this.waveDef.spawns.length;
    this.waveActive = true;
    this.waveReady = false;
    this.livesAtWaveStart = this.lives;
    this.leaksThisWave = 0;
    this.killsAtWaveStart = this.session.kills;
    this.waveStartedAt = performance.now();
    this.reinforcedThisWave = false;
    this.reinforcePause = 0;
    this.raidSpawnTimer = 0.8;
    this.bossRewardsGranted.clear();
    this.tryRollWorldEvent();
    this.audio.play('wave');
    this.audio.duck(0.4, 1.1);
    this.wavePulse = 0.28;
    this.camera.impactZoom(this.waveDef.isBossWave ? 0.07 : 0.035);
    this.camera.shake(this.waveDef.isBossWave ? 3.5 : 1.8);
    let banner = `WAVE ${this.wave}`;
    if (this.waveDef.isBossWave) banner = `BOSS · WAVE ${this.wave}`;
    else if (this.waveDef.isMinibossWave) banner = `MINI-BOSS · WAVE ${this.wave}`;
    else if (this.waveDef.isEliteWave) banner = `ELITE · WAVE ${this.wave}`;
    this.ui.showCinematicBanner(banner, 1.6);
    this.bus.emit(GameEvents.WAVE_STARTED, { wave: this.wave });
    this.replay.record({ kind: 'wave', wave: this.wave });
    const tip = tutorialTipForWave(this.wave);
    if (tip) this.ui.showToast(tip);
    if (!this.save.data.settings.tutorialDone && this.wave >= 3) {
      this.save.data.settings.tutorialDone = true;
      this.save.save();
    }
  }

  private tryRollWorldEvent(): void {
    if (this.runMeta.activeEvent) return;
    // Mission types that lean on frontier chaos
    const bias = this.activeMission?.eventBias ?? (this.activeMission?.type === 'randomEvents' ? 1.5 : 1);
    if (bias > 1 && this.runMeta.eventCooldownWaves > 1) {
      this.runMeta.eventCooldownWaves = Math.max(0, this.runMeta.eventCooldownWaves - 1);
    }
    const roll = rollWorldEvent(
      this.wave,
      this.seed,
      this.runMeta.eventCooldownWaves,
      !!this.runMeta.activeEvent,
    );
    this.runMeta.eventCooldownWaves = roll.cooldownWaves;
    if (!roll.event) return;
    this.runMeta.activeEvent = roll.event;
    this.syncRunBonuses();
    this.ui.showToast(`${roll.event.name} — ${roll.event.description}`);
    this.ui.showCinematicBanner(roll.event.name, 1.2, roll.event.description);
  }

  private spawnRaidBandit(): void {
    const evt = this.runMeta.activeEvent;
    if (!evt || evt.raidSpawnsLeft <= 0) return;
    const diff = DIFFICULTIES[this.difficulty];
    const path = this.map.paths[0] ?? this.map.path;
    const enemy = this.acquireEnemy();
    enemy.spawn('scout', this.wave, path, {
      hpMult: diff.hpMult * 0.85,
      rewardMult: diff.rewardMult * this.povertyMult(),
      speedMult: diff.speedMult * 1.15,
      pathIndex: 0,
    });
    this.prepareSpawnedEnemy(enemy);
    this.enemies.push(enemy);
    evt.raidSpawnsLeft--;
    this.pendingSpawns = Math.max(0, this.pendingSpawns); // keep wave-clear logic on live enemies
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
    const cost = this.towerCostFor(this.buildType);

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
    this.camera.shake(1.4);
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
    this.particles.dust(snap.x, snap.y + 4, 4);
    this.goldPulse = 0.2;
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
    this.buildType = null;
    this.sellArmedId = 0;
    this.upgradeArmedId = 0;
    this.ui.clearBuildSelection();

    const h = this.hero;
    if (h?.active && (h.alive || h.deathFade > 0)) {
      const hr = h.radius + 10;
      const hd = dist2(h.x, h.y, wx, wy);
      if (hd <= hr * hr) {
        this.selectedHero = true;
        this.selectedTower = null;
        this.selectedEnemy = null;
        return;
      }
    }

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

    this.selectedHero = false;

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

  private heroGatePos(): { x: number; y: number } {
    return {
      x: this.map.base.x - TILE_SIZE * 1.25,
      y: this.map.base.y,
    };
  }

  private spawnHeroAtGate(): void {
    const id = HERO_DEFS[this.selectedHeroId] ? this.selectedHeroId : 'warden';
    const pos = this.heroGatePos();
    if (!this.hero) this.hero = new Hero();
    this.hero.spawn(id, pos.x, pos.y);
    this.selectedHero = false;
    this.particles.burst(pos.x, pos.y, 18, this.hero.accent, 70, { glow: true, life: 0.35 });
  }

  private grantHeroXp(amount: number): void {
    if (!this.hero || amount <= 0) return;
    const { leveled, talentReady } = this.hero.gainXp(amount);
    if (leveled) {
      this.audio.play('upgrade', 0.35);
      this.ui.showToast(
        `${HERO_DEFS[this.hero.heroId].name} reached level ${this.hero.level}!`,
      );
    }
    if (talentReady) {
      this.selectedHero = true;
      this.selectedTower = null;
      this.selectedEnemy = null;
      this.ui.showToast('Talent choice available!');
    }
  }

  private castHeroAbility(id: HeroAbilityId): void {
    const h = this.hero;
    if (!h?.active) return;
    if (h.pendingTalentLevel) {
      this.ui.showToast('Choose a talent first');
      return;
    }
    if (!h.canCast(id)) {
      this.ui.showToast('Ability not ready');
      return;
    }
    const def = HERO_DEFS[h.heroId].abilities.find((a) => a.id === id);
    if (!def) return;
    const durMult = h.abilityDurationMult();

    if (id === 'shieldWall') {
      const dur = (def.duration ?? 8) * durMult;
      h.shieldWallTimer = dur;
      h.startAbilityCd(id, def.cooldown);
      this.combat.setShieldWallAura(h.x, h.y, 150, dur);
      this.particles.burst(h.x, h.y, 30, '#8ec8ff', 100, { glow: true, life: 0.4 });
      this.audio.play('hero_ability', 0.5);
      this.ui.showToast('Shield Wall!');
    } else if (id === 'rally') {
      h.startAbilityCd(id, def.cooldown);
      const n = this.combat.rallyTowers(this.towers, h.x, h.y, 160);
      this.particles.burst(h.x, h.y, 36, '#ffd070', 120, { glow: true, life: 0.45 });
      this.audio.play('hero_ability', 0.55);
      this.ui.showToast(n > 0 ? `Rally — ${n} towers empowered!` : 'Rally — no towers nearby');
    } else if (id === 'lastStand') {
      const dur = (def.duration ?? 10) * durMult;
      h.lastStandTimer = dur;
      h.refreshStats();
      h.startAbilityCd(id, def.cooldown);
      this.particles.burst(h.x, h.y, 42, '#ffaa40', 150, { glow: true, life: 0.5 });
      this.audio.play('hero_ability', 0.65);
      this.camera.shake(5);
      this.ui.showToast('Last Stand!');
    }
  }

  private pickHeroTalent(id: HeroTalentId): void {
    if (!this.hero?.pickTalent(id)) return;
    this.audio.play('upgrade', 0.4);
    this.ui.showToast(`Talent: ${HERO_TALENTS[id].name}`);
  }

  private updateHero(dt: number): void {
    const h = this.hero;
    if (!h?.active) return;

    const wasAlive = h.alive;
    h.update(dt);

    if (!h.alive && h.respawnTimer <= 0) {
      const pos = this.heroGatePos();
      h.respawnAt(pos.x, pos.y);
      this.audio.play('hero_respawn', 0.55);
      this.particles.burst(pos.x, pos.y, 32, '#c4a050', 110, { glow: true, life: 0.5 });
      this.ui.showToast(`${HERO_DEFS[h.heroId].name} returns!`);
    }

    if (h.alive && h.anim === 'walk' && h.footstepTimer <= 0) {
      this.audio.play('hero_footstep', 0.18);
      h.footstepTimer = 0.3;
    }

    if (h.alive && h.shieldWallTimer > 0) {
      this.combat.setShieldWallAura(h.x, h.y, 150, h.shieldWallTimer);
    }

    if (h.alive && h.cooldown <= 0) {
      const tgt = h.selectTarget(this.enemies);
      if (tgt) {
        h.cooldown = 1 / Math.max(0.2, h.attackSpeed);
        h.attackFlash = 0.22;
        h.angle = Math.atan2(tgt.y - h.y, tgt.x - h.x);
        this.combat.fireHeroShot({
          x: h.x,
          y: h.y,
          target: tgt,
          damage: h.damage,
          critChance: h.critChance,
          heroId: h.id,
          color: h.accent,
        });
        this.audio.play('hero_attack', 0.32);
      }
    }

    if (h.alive) {
      // Enemies in melee range attack the hero as the closest threat
      for (const e of this.enemies) {
        if (!e.active) continue;
        e.heroAttackCd = Math.max(0, e.heroAttackCd - dt);
        const engage = e.radius + h.radius + 20;
        if (dist2(e.x, e.y, h.x, h.y) > engage * engage) continue;
        if (e.heroAttackCd > 0) continue;
        e.heroAttackCd = e.isBoss ? 0.55 : 0.85;
        const dmg = Math.max(
          5,
          Math.round(8 + e.damageToBase * 7 + (e.isBoss ? 18 : 0) + this.wave * 0.35),
        );
        const dealt = h.applyDamage(dmg);
        if (dealt > 0) {
          this.particles.showDamage(h.x, h.y - h.radius, dealt, false);
          this.audio.play('hit', 0.2);
        }
        if (!h.alive) break;
      }
    }

    if (wasAlive && !h.alive) {
      this.audio.play('hero_death', 0.6);
      this.particles.burst(h.x, h.y, 26, h.accent, 130, { glow: true, life: 0.45 });
      this.combat.towerAura = null;
      this.ui.showToast(`${HERO_DEFS[h.heroId].name} has fallen — respawning...`);
    }
  }

  private heroHudState(): NonNullable<Parameters<UIManager['updateHud']>[0]['hero']> | null {
    const h = this.hero;
    if (!h?.active) return null;
    const def = HERO_DEFS[h.heroId];
    return {
      name: def.name,
      title: def.title,
      portrait: def.portrait,
      hp: h.hp,
      maxHp: h.maxHp,
      level: h.level,
      xp: h.xp,
      xpToNext: h.xpToNext,
      damage: h.damage,
      armor: h.armor,
      attackSpeed: h.attackSpeed,
      moveSpeed: h.moveSpeed,
      attackRange: h.attackRange,
      critChance: h.critChance,
      talents: h.talentLabel(),
      alive: h.alive,
      respawnTimer: h.respawnTimer,
      selected: this.selectedHero,
      abilities: def.abilities.map((a) => ({
        id: a.id,
        name: a.name,
        cd: h.abilityCd[a.id],
        maxCd: a.cooldown,
        ready: h.canCast(a.id),
      })),
      talentOptions: h.pendingTalentLevel
        ? h.talentOptions().map((id) => ({
            id,
            name: HERO_TALENTS[id].name,
            description: HERO_TALENTS[id].description,
          }))
        : undefined,
    };
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

    if (
      this.save.data.settings.confirmUpgrade &&
      !path &&
      this.upgradeArmedId !== t.id
    ) {
      this.upgradeArmedId = t.id;
      this.ui.showToast('Click Upgrade again to confirm');
      return;
    }
    this.upgradeArmedId = 0;

    this.gold -= choice.cost;
    this.session.goldSpent += choice.cost;
    if (!t.upgrade(choice.path)) {
      this.gold += choice.cost;
      this.session.goldSpent -= choice.cost;
      return;
    }
    this.session.towersUpgraded++;
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
    this.particles.dust(t.x, t.y + 4, 5);
    this.audio.play('sell');
    this.goldPulse = 0.28;
    this.camera.shake(1.1);
    t.active = false;
    this.towers = this.towers.filter((x) => x !== t);
    this.selectedTower = null;
    this.runMeta.towersSold++;
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
    // Presets only change via Apply All — cycling is local to this tower
    this.ui.showToast(
      `${TARGETING_LABELS[this.selectedTower.targeting]} · Apply All to set default`,
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
      this.session.goldSpent = Math.max(0, this.session.goldSpent - action.cost);
      this.session.towersBuilt = Math.max(0, this.session.towersBuilt - 1);
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
      this.session.goldSpent = Math.max(0, this.session.goldSpent - action.cost);
      this.session.towersUpgraded = Math.max(0, this.session.towersUpgraded - 1);
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
      this.runMeta.towersSold = Math.max(0, this.runMeta.towersSold - 1);
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
    const cost = this.towerCostFor(this.buildType);
    if (isWallType(this.buildType)) {
      return canPlaceWallAt(this.map, snap.x, snap.y, this.wallTiles, this.occupied)
        ?? (this.gold < cost ? 'need-gold' : null);
    }
    return getTowerBuildRejectReason(this.map, snap.x, snap.y, this.occupied, this.gold, cost);
  }

  private towerCostFor(type: TowerType): number {
    const discount =
      this.bonuses.towerDiscount +
      (isWallType(type) ? this.bonuses.wallDiscount : 0) +
      this.runBonuses.merchantDiscount;
    const mult = this.runBonuses.towerCostMult;
    return Math.max(
      1,
      Math.floor(TOWER_DEFS[type].cost * mult * (1 - Math.min(0.55, discount))),
    );
  }

  private abilityHooks(): AbilityHooks {
    return {
      playSound: (id, vol) => this.audio.play(id, vol),
      particles: this.particles,
      spawnMinion: (type, near, count) => this.spawnMinionsNear(type, near, count),
      damageGate: (amount) => this.chipGate(amount),
      slowTowersNear: (x, y, radius, mult, duration) => {
        this.combat.fireRateAuras.push({ x, y, radius, fireRateMult: mult, remaining: duration });
      },
    };
  }

  private chipGate(amount: number): void {
    if (amount <= 0 || this.phase !== 'playing') return;
    this.lives = Math.max(0, this.lives - amount);
    this.gateFlash = 0.25;
    if (this.lives <= 0) {
      this.lives = 0;
      this.gameOver();
    }
  }

  private spawnMinionsNear(type: string, near: Enemy, count: number): void {
    const diff = DIFFICULTIES[this.difficulty];
    for (let i = 0; i < count; i++) {
      const add = this.acquireEnemy();
      const enemyType = (type in ENEMY_DEFS ? type : 'scout') as keyof typeof ENEMY_DEFS;
      add.spawn(enemyType, this.wave, near.path, {
        hpMult: diff.hpMult * 0.5,
        speedMult: diff.speedMult * (0.95 + i * 0.02),
        pathIndex: near.pathIndex,
        rewardMult: diff.rewardMult * this.povertyMult() * 0.6,
      });
      add.pathDist = Math.max(0, near.pathDist - 20 - i * 12);
      attachAbilities(add, collectEnemyAbilities(add.type, add.modifiers));
      this.enemies.push(add);
    }
  }

  private prepareSpawnedEnemy(enemy: Enemy): void {
    const extra =
      enemy.type === 'siegeGolem'
        ? BOSS_DEFS.siegeGolem.enemyAbilities
        : enemy.type === 'miniboss'
          ? BOSS_DEFS.champion.enemyAbilities
          : enemy.type === 'boss'
            ? BOSS_DEFS.warlord.enemyAbilities
            : [];
    const factionExtra =
      this.wave >= 8 && this.factionId && Math.random() < 0.22
        ? [
            FACTION_DEFS[this.factionId].abilityBias[
              Math.floor(Math.random() * FACTION_DEFS[this.factionId].abilityBias.length)
            ]!,
          ]
        : [];
    attachAbilities(
      enemy,
      collectEnemyAbilities(enemy.type, enemy.modifiers, [...extra, ...factionExtra]),
    );

    if (enemy.isBoss) {
      const boss = BossController.tryCreate(enemy);
      if (boss) {
        boss.abilityCdMult = DIFFICULTIES[this.difficulty].bossAbilityCdMult;
        this.bossControllers.push(boss);
        boss.beginIntro({
          playSound: (id, vol) => this.audio.play(id, vol),
          particles: this.particles,
          spawnMinion: (type, near, count) => this.spawnMinionsNear(type, near, count),
          damageGate: (amount) => this.chipGate(amount),
          shake: (n) => this.camera.shake(n),
          toast: (msg) => this.ui.showToast(msg),
          banner: (title, sub) => this.ui.showCinematicBanner(title, 2.0, sub),
          onPhase: (_boss: BossController, phase: number) => {
            this.ui.showCinematicBanner(`Phase ${phase + 1}`, 1.4, 'The siege escalates');
            this.bossFlash = Math.max(this.bossFlash, 0.35);
            this.camera.impactZoom(0.05);
          },
          gateX: this.map.base.x,
          gateY: this.map.base.y,
        });
        this.bossFlash = 0.45;
        this.camera.flyTo(enemy.x, enemy.y, Math.min(1.35, this.camera.zoom * 1.14));
        this.camera.impactZoom(0.08);
        this.audio.startBossMusic(boss.def.musicIntensity);
        // Legacy add-spawns only when not boss-controlled
        enemy.onBossPhase = undefined;
      } else {
        enemy.onBossPhase = (e, phase) => {
          const mini = e.type === 'miniboss';
          this.ui.showToast(
            mini
              ? phase === 1
                ? 'Champion raises a barrier!'
                : 'Champion goes berserk!'
              : phase === 1
                ? 'Warlord shields — burst now!'
                : 'Final phase — Warlord unleashed!',
          );
          this.camera.shake(mini ? 7 : 10);
          this.spawnMinionsNear(phase >= 2 ? 'scout' : 'raider', e, mini ? 1 + phase : 2 + phase);
        };
      }
    }
  }

  private updateBosses(dt: number): void {
    const hooks = {
      playSound: (id: string, vol?: number) => this.audio.play(id, vol),
      particles: this.particles,
      spawnMinion: (type: string, near: Enemy, count: number) =>
        this.spawnMinionsNear(type, near, count),
      damageGate: (amount: number) => this.chipGate(amount),
      shake: (n: number) => this.camera.shake(n),
      toast: (msg: string) => this.ui.showToast(msg),
      banner: (title: string, sub?: string) => this.ui.showCinematicBanner(title, 1.8, sub),
      onPhase: (_boss: BossController, phase: number) => {
        this.ui.showCinematicBanner(`Phase ${phase + 1}`, 1.4);
        this.bossFlash = Math.max(this.bossFlash, 0.3);
      },
      gateX: this.map.base.x,
      gateY: this.map.base.y,
    };
    for (const b of this.bossControllers) {
      const wasFighting = b.state === 'fighting' || b.state === 'intro';
      b.update(dt, hooks);
      if (wasFighting && (b.state === 'dying' || b.state === 'dead')) {
        this.grantBossFrameworkRewards(b);
      }
    }
    this.bossControllers = this.bossControllers.filter((b) => b.state !== 'dead');
    if (!this.bossControllers.some((b) => b.state === 'intro' || b.state === 'fighting')) {
      this.audio.stopBossMusic();
    }
  }

  private grantBossFrameworkRewards(boss: BossController): void {
    this.missionBossKilled = true;
    if (this.bossRewardsGranted.has(boss.enemy.id)) return;
    this.bossRewardsGranted.add(boss.enemy.id);
    const r = boss.def.rewards;
    this.gold += r.gold;
    this.session.goldEarned += r.gold;
    this.save.data.statistics.moneyEarned += r.gold;
    this.score += Math.round(r.scoreBonus * DIFFICULTIES[this.difficulty].scoreMult);
    if (r.researchPoints > 0) {
      this.runMeta.researchPoints += r.researchPoints;
      this.ui.showToast(`+${r.researchPoints} Research Point from ${boss.def.name}`);
    }
    this.particles.showGold(boss.enemy.x, boss.enemy.y - 20, r.gold);
    this.audio.play('gold', 0.5);
    this.goldPulse = 0.6;
    this.ui.showToast(`Boss spoils: +${r.gold}g`);
    if (r.epicReward) {
      // Epic pick opens after the wave clears (existing spoil flow); toast now
      this.ui.showToast('Epic reward available after the wave!');
    }
  }

  private registerKill(
    enemy: Enemy,
    tower: Tower | null,
    sourceLabel?: string,
    chainDepth = 0,
  ): void {
    notifyAbilityDeath(enemy, this.abilityHooks());
    const reward = Math.round(
      enemy.reward *
        this.abilities.goldMultiplier() *
        this.killGoldMult *
        this.runBonuses.goldIncomeMult,
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
      this.grantHeroXp(HERO_XP_PER_BOSS);
    }
    if (tower?.type === 'rocket') this.session.rocketKills++;
    const name = ENEMY_DEFS[enemy.type]?.name ?? enemy.type;
    const by = tower ? TOWER_DEFS[tower.type].name : (sourceLabel ?? 'Ability');
    const abilityIcons = enemy.abilities
      .slice(0, 3)
      .map((a) => ENEMY_ABILITY_DEFS[a.id].icon)
      .join('');
    this.pushKillFeed(`${by} → ${abilityIcons}${name} (+${reward}g)`);
    if (reward > 0) {
      this.particles.showGold(enemy.x, enemy.y - enemy.radius, reward);
      this.audio.play('gold', 0.35);
      this.goldPulse = 0.35;
    }
    if (enemy.explosive && chainDepth < 6) {
      this.particles.burst(enemy.x, enemy.y, 22, '#ff8844', 160, { glow: true, life: 0.35 });
      const splash = Math.max(8, enemy.maxHp * 0.12);
      for (const other of this.enemies) {
        if (!other.active || other.id === enemy.id) continue;
        const dx = other.x - enemy.x;
        const dy = other.y - enemy.y;
        if (dx * dx + dy * dy <= 70 * 70) {
          other.applyDamage(splash, 0.1, 'explosive');
          if (other.hp <= 0 && other.active) {
            other.beginDeath(dx * 0.4, dy * 0.4 - 30);
            this.registerKill(other, null, 'Blast', chainDepth + 1);
          }
        }
      }
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
    const mark = def.isBossWave
      ? ' · BOSS'
      : def.isMinibossWave
        ? ' · MINI-BOSS'
        : def.isEliteWave
          ? ' · ELITE'
          : '';
    this.wavePreviewLabel = `Next W${next}: ${sum.total} foes${mark} — ${sum.label}`;
  }

  private onWaveCleared(): void {
    this.waveActive = false;
    this.waveReady = true;
    this.blitzActive = false;
    const clearSec =
      this.waveStartedAt > 0 ? (performance.now() - this.waveStartedAt) / 1000 : 0;
    this.director.observe({
      wave: this.wave,
      gold: this.gold,
      lives: this.lives,
      maxLives: this.maxLives,
      towers: this.towers,
      leaksThisWave: this.leaksThisWave,
      clearTimeSec: clearSec,
      killsLastWave: Math.max(0, this.session.kills - this.killsAtWaveStart),
    });
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
    bonus = Math.round(bonus * this.killGoldMult * this.runBonuses.goldIncomeMult);
    this.gold += bonus + interest;
    this.session.goldEarned += bonus + interest;
    this.save.data.statistics.moneyEarned += bonus + interest;
    this.score += Math.round(bonus * 5 * diff.scoreMult);
    this.ui.showCinematicBanner('Wave Cleared', 1.35, `+${bonus + interest}g`);
    this.audio.play('wave_clear', 0.55);
    this.audio.duck(0.35, 0.9);
    this.camera.shake(3);
    this.goldPulse = 0.5;
    this.grantHeroXp(HERO_XP_PER_WAVE);

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

    const rpGained = grantResearchPointsForWave(this.runMeta, this.wave);
    if (rpGained > 0) {
      this.ui.showToast(`+${rpGained} Research Point — open Research`);
    }

    if (this.missionRuntime && this.activeMission) {
      onMissionWaveCleared(this.missionRuntime, this.activeMission.waveGoal);
      const line = missionHudLine(this.missionRuntime);
      if (line) this.ui.showToast(line);
    }

    // Campaign / mission victory check
    if (this.activeMission && !this.endless && this.waveGoal > 0) {
      if (this.checkMissionVictory()) {
        this.victoryCampaign();
        return;
      }
    }

    const milestone =
      !!this.waveDef &&
      (this.waveDef.isEliteWave || this.waveDef.isMinibossWave || this.waveDef.isBossWave);
    if (milestone) {
      this.openEliteReward();
      return;
    }

    this.beginPreparePhase(this.autoWaves ? 1.5 : PREPARE_SECONDS);
  }

  private checkMissionVictory(): boolean {
    const m = this.activeMission;
    if (!m) return false;
    return missionObjectiveMet(this.missionRuntime, m, this.wave, this.missionBossKilled);
  }

  private victoryCampaign(): void {
    const mission = this.activeMission!;
    this.phase = 'victory';
    this.blitzActive = false;
    this.autoWaves = false;
    this.metaBlocked = false;
    this.survivalTiming = false;
    this.ui.clearMetaOverlay();
    this.audio.stopBossMusic();
    this.audio.play('victory');
    this.audio.duck(0.4, 1.2);

    const result = applyMissionVictory(
      this.save.data.campaignProgress,
      mission,
      this.difficulty,
      this.wave,
      this.score,
    );
    this.save.data.campaignProgress = result.progress;
    this.save.data.statistics.wins++;
    this.recordProfileEnd(true);
    this.save.data.researchPoints += result.rewards.researchPoints;
    this.save.data.bankedGold += Math.floor(result.rewards.gold * 0.25);
    this.gold += result.rewards.gold;
    this.session.goldEarned += result.rewards.gold;

    for (const mapId of result.rewards.unlockMaps ?? []) this.save.unlockMap(mapId);
    for (const t of result.rewards.unlockTowers ?? []) this.save.unlockTower(t, false);
    for (const c of result.rewards.unlockCosmetics ?? []) this.save.unlockCosmetic(c, false);
    this.save.clearContinue();
    this.save.syncProgressUnlocks();
    this.save.save();

    const unlockNames = [
      ...(result.newlyUnlocked.map((id) => getMission(id)?.name ?? id)),
      ...(result.rewards.unlockTowers ?? []).map((t) => TOWER_DEFS[t].name),
      ...(result.rewards.unlockMaps ?? []).map(
        (id) => MAP_PRESETS.find((m) => m.id === id)?.name ?? id,
      ),
      ...(result.rewards.unlockCosmetics ?? []).map((c) => cosmeticDisplayName(c)),
    ].filter(Boolean);

    this.ui.showCinematicBanner('Victory', 2.2, mission.name);
    this.finishReplay(true);
    this.achievements.check(this.session, this.lives, STARTING_LIVES, true);
    this.bus.emit(GameEvents.VICTORY, { wave: this.wave, score: this.score });

    // Let the Victory banner land before covering it with the summary screen.
    const summaryPayload = {
      missionName: mission.name,
      summary: mission.lore,
      wave: this.wave,
      score: this.score,
      goldReward: result.rewards.gold,
      rpReward: result.rewards.researchPoints,
      unlocks: unlockNames.length ? unlockNames.join(', ') : 'Progress saved',
    };
    window.setTimeout(() => {
      if (this.phase !== 'victory') return;
      this.ui.show('missionSummary', summaryPayload);
    }, 2400);
  }

  private gameOver(): void {
    this.phase = 'defeat';
    this.blitzActive = false;
    this.autoWaves = false;
    this.metaBlocked = false;
    this.survivalTiming = false;
    this.ui.clearMetaOverlay();
    const payload = this.endPayload(false);
    this.save.data.statistics.losses++;
    this.recordProfileEnd(false);
    this.recordDailyIfNeeded();
    this.save.clearContinue();
    this.save.save();
    this.audio.play('defeat');
    this.finishReplay(false);
    this.achievements.check(this.session, this.lives, STARTING_LIVES, false);
    this.bus.emit(GameEvents.GAME_OVER, { wave: this.wave, score: this.score });
    this.ui.showCinematicBanner('Defeat', 1.8, FACTION_DEFS[this.factionId].name);
    // Let the Defeat banner land before covering it with the report screen.
    window.setTimeout(() => {
      if (this.phase !== 'defeat') return;
      this.ui.show('gameOver', payload);
    }, 2000);
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
      maxLives: this.maxLives,
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
      runMeta: {
        researchPoints: this.runMeta.researchPoints,
        activeResearch: this.runMeta.activeResearch,
        eliteRewards: [...getRunRelics(this.runMeta)],
        relics: [...getRunRelics(this.runMeta)],
        factionId: this.factionId,
        envModifiers: [...(this.runMeta.envModifiers ?? [])],
        eventCooldownWaves: this.runMeta.eventCooldownWaves,
        activeEvent: this.runMeta.activeEvent
          ? { ...this.runMeta.activeEvent }
          : null,
        towersSold: this.runMeta.towersSold,
      },
      sessionDamage: this.sessionDamage,
      runStartedAtOffsetSec: this.survivalElapsed,
      selectedHeroId: this.selectedHeroId,
      hero: this.hero?.active
        ? {
            ...this.hero.toSnapshot(),
            abilityCd: { ...this.hero.abilityCd },
            pendingTalentLevel: this.hero.pendingTalentLevel,
          }
        : undefined,
      missionId: this.activeMission?.id ?? null,
      biomeId: this.biomeId,
      waveGoal: this.waveGoal,
      missionRuntime: this.missionRuntime ? { ...this.missionRuntime } : null,
      missionBossKilled: this.missionBossKilled,
      bridges: this.map.bridgeSlots.map((s) => ({
        c: s.c,
        r: s.r,
        built: s.built,
        hp: s.hp,
      })),
      waveWasActive: this.waveActive,
      sessionLite: {
        kills: this.session.kills,
        goldEarned: this.session.goldEarned,
        goldSpent: this.session.goldSpent,
        towersBuilt: this.session.towersBuilt,
        towersUpgraded: this.session.towersUpgraded,
        bossesKilled: this.session.bossesKilled,
        highestWave: this.session.highestWave,
      },
      abilityCds: { ...this.abilities.cooldowns },
      goldBoostTimer: this.abilities.goldBoostTimer,
      runTime: this.runTime,
      autoWaves: this.autoWaves,
      speed: this.speed,
      prepareTimer: this.prepareTimer,
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
      this.selectedHero = false;
    }
    if (this.input.justRightClicked) {
      if (this.buildType || this.abilityAim) {
        this.cancelBuildPlacement();
      } else if (this.selectedHero && this.hero?.alive && this.speed !== 0) {
        const mx = this.input.worldX;
        const my = this.input.worldY;
        if (isInBounds(mx, my)) this.hero.commandMove(mx, my);
      } else {
        this.cancelBuildPlacement();
      }
    }
    // Soft pause (speed 0): sim frozen and gameplay input disabled; the veil
    // blocks pointer input, these guards block the keyboard shortcuts.
    const softPaused = this.phase === 'playing' && this.speed === 0;
    if (this.input.consumeKey(this.input.bindings.sell) && !softPaused) this.sellSelected();
    if (this.input.consumeKey(this.input.bindings.undo) && !softPaused) this.undoLastAction();

    const abilityKeys: AbilityType[] = ['meteor', 'freeze', 'airstrike', 'emp', 'nuke', 'goldboost'];
    const heroAbilityKeys: HeroAbilityId[] = ['shieldWall', 'rally', 'lastStand'];
    const codes = [
      this.input.bindings.ability1,
      this.input.bindings.ability2,
      this.input.bindings.ability3,
      this.input.bindings.ability4,
      this.input.bindings.ability5,
      this.input.bindings.ability6,
    ];
    for (let i = 0; i < 3; i++) {
      if (this.input.consumeKey(codes[i]!) && !softPaused) this.beginAbility(abilityKeys[i]!);
    }
    for (let i = 0; i < 3; i++) {
      if (!this.input.consumeKey(codes[i + 3]!)) continue;
      if (softPaused) continue;
      if (this.hero?.active) this.castHeroAbility(heroAbilityKeys[i]!);
      else this.beginAbility(abilityKeys[i + 3]!);
    }

    // Placement is available as soon as the fade clears (intro camera may still settle)
    const canInteractMap =
      this.phase === 'playing' && !softPaused && !this.photoMode && this.introFade < 0.05;
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
    const env = computeEnvironment(
      this.runTime,
      this.map.id,
      this.modifiers,
      this.biomeId,
      {
        forceNight: !!this.activeMission?.forceNight,
        nightBias: this.runBonuses.nightBias,
        weatherBias: this.runBonuses.weatherBias,
      },
    );
    this.dayNight = env.dayNight;
    this.weather = env.weather;
    const facShort = FACTION_DEFS[this.factionId].epithet;
    this.envLabel = `${facShort} · ${env.label}`;
    this.combat.envDamageMult = env.damageMult;
    this.combat.envCritMult = env.critMult;
    this.combat.envProjectileSpeedMult =
      env.projectileSpeedMult * this.runBonuses.projectileSpeedMult;
    this.combat.globalRangeMult =
      this.rangeMult * env.towerRangeMult * this.runBonuses.rangeMult * this.runBonuses.fogRangeMult;
    this.killGoldMult =
      this.bonuses.killGoldMult * env.goldIncomeMult * this.runBonuses.goldIncomeMult;

    this.abilities.update(dt);
    if (this.speed === 4) this.session.timeAt4x += dt;

    if (this.runMeta.activeEvent) {
      const alive = tickWorldEvent(this.runMeta.activeEvent, dt);
      if (!alive) {
        this.ui.showToast(`${this.runMeta.activeEvent.name} ended`);
        this.runMeta.activeEvent = null;
        this.syncRunBonuses();
      } else if (this.runBonuses.gateRegenPerSec > 0 && this.lives < this.maxLives) {
        this.lives = Math.min(
          this.maxLives,
          this.lives + this.runBonuses.gateRegenPerSec * dt,
        );
      }
    }

    if (
      this.waveActive &&
      this.runMeta.activeEvent?.id === 'banditRaid' &&
      this.runMeta.activeEvent.raidSpawnsLeft > 0
    ) {
      this.raidSpawnTimer -= dt;
      if (this.raidSpawnTimer <= 0) {
        this.raidSpawnTimer = 0.55;
        this.spawnRaidBandit();
      }
    }

    if (this.prepareTimer > 0 && !this.levelIntro && !this.metaBlocked) {
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
        const enemy = this.acquireEnemy();
        const roleMult =
          ev.role === 'elite' ? { hp: 1.55, speed: 1.08, reward: 1.8 } : { hp: 1, speed: 1, reward: 1 };
        const isBossLike =
          ev.type === 'boss' ||
          ev.type === 'miniboss' ||
          ev.type === 'siegeGolem' ||
          ev.role === 'boss';
        const mods = pickEnemyModifiers(this.wave, this.seed, this.spawnIndex, isBossLike);
        const modStats = combineModifierStats(mods);
        const biome = BIOME_DEFS[this.biomeId];
        enemy.spawn(ev.type, this.wave, path, {
          hpMult: diff.hpMult * roleMult.hp * modStats.hpMult * biome.enemyHpMult,
          rewardMult:
            diff.rewardMult * this.povertyMult() * roleMult.reward * modStats.rewardMult,
          speedMult:
            diff.speedMult * roleMult.speed * modStats.speedMult * biome.enemySpeedMult,
          pathIndex: lane,
          armorFlat: modStats.armorFlat,
          shieldFlat: modStats.shieldFlat,
          radiusMult: modStats.radiusMult,
          leakBonus: modStats.leakBonus,
          forceRegen: modStats.forceRegen,
          explosive: modStats.explosive,
          modifierLabels: modStats.labels,
          stealthForce: this.runBonuses.stealthBonus && !isBossLike && this.spawnIndex % 3 === 0,
        });
        if (ev.role === 'elite') {
          enemy.damageToBase = Math.max(enemy.damageToBase, 2);
          if (!enemy.modifiers.includes('elite')) enemy.modifiers.push('elite');
        }
        // Environmental speed + faction tint
        const envSpd = this.runBonuses.enemySpeedMult;
        if (envSpd !== 1) {
          enemy.nativeSpeed *= envSpd;
          enemy.baseSpeed = enemy.nativeSpeed;
          enemy.speed = enemy.baseSpeed;
        }
        if (enemy.flying && this.runMeta.envModifiers?.includes('strongWinds')) {
          enemy.nativeSpeed *= 1.1;
          enemy.baseSpeed = enemy.nativeSpeed;
          enemy.speed = enemy.baseSpeed;
        }
        if (this.factionId) {
          enemy.accent = FACTION_DEFS[this.factionId].accent;
        }
        this.prepareSpawnedEnemy(enemy);
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
        let leakDmg = Math.max(
          1,
          Math.round(
            e.damageToBase *
              this.bonuses.leakDamageMult *
              (this.hasModifier('suddenDeath') ? 3 : 1),
          ),
        );
        if (this.missionRuntime) {
          const m = applyMissionLeak(this.missionRuntime, leakDmg);
          leakDmg = m.lifeDamage;
          if (m.toast) this.ui.showToast(m.toast);
          if (this.missionRuntime.failed) {
            this.ui.showToast(this.missionRuntime.failReason || 'Mission failed');
            this.gameOver();
            return;
          }
        }
        if (!this.playtest?.blocksLeakDamage()) {
          this.lives -= leakDmg;
        }
        this.leaksThisWave++;
        this.threatByEnemy[e.type] = (this.threatByEnemy[e.type] ?? 0) + leakDmg * 40;
        this.audio.play('gate_hit', 0.55);
        this.audio.duck(0.35, 0.45);
        this.camera.shake(7);
        this.gateFlash = 0.45;
        this.hitFlash = Math.max(this.hitFlash, 0.22);
        const gx = this.map.base.x;
        const gy = this.map.base.y;
        this.particles.burst(gx, gy, 16, '#e07060', 130, { glow: true, life: 0.4 });
        this.particles.burst(gx, gy - 6, 10, '#c4a070', 70, { gravity: 50, life: 0.5, size: 2.5 });
        this.particles.burst(gx, gy - 10, 6, '#fff0e0', 50, { glow: true, life: 0.22 });
        this.particles.dust(gx, gy + 4, 5);
        if (this.lives <= 0) {
          this.lives = 0;
          this.gameOver();
          return;
        }
      } else if (result === 'dead' && e.hp <= 0 && e.deathFade <= 0) {
        e.beginDeath(randomRange(-30, 30), -45);
        this.registerKill(e, null, hadPoison ? 'Poison' : 'Bastion');
        this.particles.deathBurst(e.x, e.y, e.type, e.accent, e.isBoss);
        this.audio.play('death', 0.32);
        this.camera.shake(e.isBoss ? 8 : 2.5);
      }
    }

    // Support AI — healers/banners pace behind tanks; auras pulse
    const abHooks = this.abilityHooks();
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.tickRoles(dt, this.enemies);
      tickEnemyAbilities(e, dt, this.enemies, abHooks);
    }

    this.updateBosses(dt);

    // Healing Banner gate regen
    if (this.combat.gateRegenPerSec > 0 && this.lives < this.maxLives) {
      this.lives = Math.min(
        this.maxLives,
        this.lives + this.combat.gateRegenPerSec * dt,
      );
    }

    // Combat
    this.combat.update(dt, this.towers, this.enemies, this.particles, {
      onDamage: (enemy, amount, crit, towerType) => {
        this.save.data.statistics.damageDealt += amount;
        this.sessionDamage += amount;
        if (towerType && towerType in TOWER_DEFS) {
          const tt = towerType as TowerType;
          this.damageByTower[tt] = (this.damageByTower[tt] ?? 0) + amount;
        }
        this.threatByEnemy[enemy.type] =
          (this.threatByEnemy[enemy.type] ?? 0) + amount * 0.15;
        this.session.laserDamage += towerType === 'laser' ? amount : 0;
        if (crit && towerType === 'sniper') this.session.sniperCrits++;
        if (amount >= 500) this.session.overkillHit = true;
        if (towerType === 'freeze' && enemy.status.slowTimer > 0) this.session.freezeSlows++;
        if (towerType === 'poison' && enemy.status.poisonTimer > 0) this.session.poisonApps++;
        notifyAbilityDamaged(enemy, amount, abHooks);
        // Subtle shake only on heavy impacts
        if (crit) this.camera.shake(2);
        else if (towerType === 'cannon' || towerType === 'rocket') this.camera.shake(2.5);
        else if (towerType === 'ballista') this.camera.shake(2.2);
        else if (amount >= 80) this.camera.shake(1.2);
      },
      onKill: (enemy, tower) => {
        this.registerKill(enemy, tower);
        if (tower) {
          this.save.data.statistics.towerKills[tower.type] =
            (this.save.data.statistics.towerKills[tower.type] ?? 0) + 1;
        }
        if (enemy.isBoss) this.camera.shake(10);
        else if (tower?.type === 'cannon' || tower?.type === 'rocket') this.camera.shake(4);
        else if (tower?.type === 'ballista') this.camera.shake(3.2);
        else this.camera.shake(1.8);
      },
      onHeroKill: (enemy) => {
        this.registerKill(enemy, null, HERO_DEFS[this.hero?.heroId ?? 'warden'].name);
        this.grantHeroXp(HERO_XP_PER_KILL);
        if (enemy.isBoss) this.camera.shake(10);
        else this.camera.shake(1.8);
      },
      onChainHit: () => {
        this.session.chain5 = true;
      },
      playSound: (id, vol) => this.audio.play(id, vol),
      screenFeedback: (kind) => {
        if (kind === 'crit') this.critFlash = Math.max(this.critFlash, 0.16);
        else if (kind === 'explosion') {
          this.hitFlash = Math.max(this.hitFlash, 0.12);
          this.camera.impactZoom(0.02);
        } else if (kind === 'boss') {
          this.bossFlash = Math.max(this.bossFlash, 0.35);
        } else if (kind === 'hit') {
          // Tiny sting — capped so dense fights stay readable
          this.hitFlash = Math.max(this.hitFlash, 0.05);
        }
      },
    });

    this.updateHero(dt);

    // Fog: shades lose reveal faster (harder to keep visible)
    if (this.hasModifier('fog')) {
      for (const e of this.enemies) {
        if (e.active && e.invisible && e.status.revealTimer > 0) {
          e.status.revealTimer -= dt * 0.5;
        }
      }
    }

    this.enemies = this.enemies.filter((e) => {
      if (e.active || e.deathFade > 0) return true;
      this.enemyPool.reclaim(e);
      return false;
    });
    if (this.selectedEnemy && !this.selectedEnemy.active && this.selectedEnemy.deathFade <= 0) {
      this.selectedEnemy = null;
    }
    if (this.goldPulse > 0) this.goldPulse = Math.max(0, this.goldPulse - dt);
    if (this.gateFlash > 0) this.gateFlash = Math.max(0, this.gateFlash - dt);
    if (this.wavePulse > 0) this.wavePulse = Math.max(0, this.wavePulse - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 3.2);
    if (this.critFlash > 0) this.critFlash = Math.max(0, this.critFlash - dt * 3.5);
    if (this.bossFlash > 0) this.bossFlash = Math.max(0, this.bossFlash - dt * 1.6);

    this.particles.update(dt);
    if (
      this.map.id === 'bastion-approach' &&
      this.save.data.settings.graphicsQuality !== 'low'
    ) {
      this.particles.ambientBastion(this.map.path, dt);
      if (Math.random() < dt * 2.2) {
        this.particles.embers(this.map.base.x - 70, this.map.base.y + 8, 2);
      }
    }

    const raidPending = (this.runMeta.activeEvent?.raidSpawnsLeft ?? 0) > 0;
    if (
      this.waveActive &&
      this.pendingSpawns <= 0 &&
      this.spawnIndex >= (this.waveDef?.spawns.length ?? 0) &&
      this.enemies.length === 0 &&
      !raidPending
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
    // Real elapsed gameplay time (not sim-speed / frame count). Pauses stop the clock.
    if (
      this.survivalTiming &&
      this.phase === 'playing' &&
      !this.pausedByPlayer &&
      !this.photoMode &&
      !this.metaBlocked &&
      this.speed !== 0
    ) {
      this.survivalElapsed += frameDt;
    }
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
      const gateRatio = this.maxLives > 0 ? this.lives / this.maxLives : 1;
      const damageVignette =
        gateRatio < 0.35 ? Math.min(1, (0.35 - gateRatio) / 0.35) : 0;
      this.renderer.render({
        camera: this.camera,
        map: this.map,
        towers: this.towers,
        enemies: this.enemies,
        projectiles: (this.combat.projectiles.fillActive(this.projectileScratch),
        this.projectileScratch),
        particles: this.particles,
        selectedTower: this.photoMode ? null : this.selectedTower,
        selectedEnemy: this.photoMode ? null : this.selectedEnemy,
        hero: this.hero?.active ? this.hero : null,
        selectedHero: this.selectedHero,
        ghostType: this.photoMode ? null : this.buildType,
        ghostX,
        ghostY,
        ghostValid,
        ghostReason: reject ? BUILD_REJECT_LABELS[reject] : null,
        abilityTargeting: !this.photoMode && !!this.abilityAim,
        showAllRanges: this.photoMode ? false : this.showAllRanges,
        ghostInBounds,
        dt: frameDt,
        hitFlash: this.hitFlash,
        critFlash: this.critFlash,
        bossFlash: this.bossFlash,
        damageVignette,
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
        const evt = this.runMeta.activeEvent;

        let activeEnemies = 0;
        for (let i = 0; i < this.enemies.length; i++) {
          if (this.enemies[i]!.active) activeEnemies++;
        }
        this.activeEnemyCount = activeEnemies;

        this.hudInspectAcc += frameDt;
        if (this.hudInspectAcc >= 0.2) {
          this.hudInspectAcc = 0;
          if (this.selectedTower && !this.selectedTower.isWall) {
            const tgt = this.selectedTower.selectTarget(this.enemies);
            this.hudCurrentTargetName = tgt
              ? (ENEMY_DEFS[tgt.type]?.name ?? tgt.type)
              : '';
          } else {
            this.hudCurrentTargetName = '';
          }
          this.hudAimedBy = '';
          if (this.selectedEnemy?.active) {
            const e = this.selectedEnemy;
            const r2max = (420) ** 2;
            for (const t of this.towers) {
              if (!t.active || t.isWall) continue;
              if (dist2(t.x, t.y, e.x, e.y) > Math.min(r2max, t.stats.range * t.stats.range)) {
                continue;
              }
              if (t.selectTarget(this.enemies)?.id === e.id) {
                this.hudAimedBy = TOWER_DEFS[t.type].name;
                break;
              }
            }
          }
        }

        const selEnemy = this.selectedEnemy?.active
          ? {
              name: ENEMY_DEFS[this.selectedEnemy.type]?.name ?? this.selectedEnemy.type,
              hp: this.selectedEnemy.hp,
              maxHp: this.selectedEnemy.maxHp,
              speed: this.selectedEnemy.baseSpeed,
              armor: this.selectedEnemy.armor,
              reward: this.selectedEnemy.reward,
              targetedBy: this.hudAimedBy,
              modifiers: this.selectedEnemy.modifiers.length
                ? this.selectedEnemy.modifiers.join(', ')
                : '',
              roleHint: [
                this.selectedEnemy.directionalShield
                  ? this.selectedEnemy.lastHitZone
                    ? `Shield ${this.selectedEnemy.lastHitZone}`
                    : 'Frontal shield'
                  : '',
                this.selectedEnemy.berserkActive
                  ? 'BERSERK'
                  : this.selectedEnemy.berserk
                    ? 'Berserker'
                    : '',
                this.selectedEnemy.healsAura ? 'Healer' : '',
                this.selectedEnemy.bannerAura ? 'Banner' : '',
                this.selectedEnemy.siege ? 'Siege' : '',
              ]
                .filter(Boolean)
                .join(' · '),
            }
          : null;

        const liveBoss = this.bossControllers.find(
          (b) => b.state === 'intro' || b.state === 'fighting' || b.state === 'dying',
        );

        if (
          this.pendingAchievements.length > 0 &&
          (!liveBoss || liveBoss.state !== 'intro')
        ) {
          this.presentAchievement(this.pendingAchievements.shift()!);
        }

        this.ui.updateHud({
          gold: this.gold,
          lives: this.lives > 0 ? Math.max(1, Math.ceil(this.lives)) : 0,
          maxLives: this.maxLives,
          gateLabel: this.map?.id === 'bastion-approach',
          goldPulse: this.goldPulse > 0,
          gateFlash: this.gateFlash > 0,
          wavePulse: this.wavePulse > 0,
          wave: this.wave,
          maxWaves: Number.isFinite(this.campaignWaveCap())
            ? this.campaignWaveCap()
            : MAX_WAVES_CAMPAIGN,
          endless: this.endless,
          enemies: activeEnemies + Math.max(0, this.pendingSpawns),
          runStats: {
            highestWave: Math.max(this.session.highestWave, this.wave),
            kills: this.session.kills,
            goldEarned: this.session.goldEarned,
            towersBuilt: this.session.towersBuilt,
            timeSurvived: this.survivalElapsed,
          },
          researchPoints: this.runMeta.researchPoints,
          activeResearch: researchLabel(this.runMeta.activeResearch),
          activeEvent: evt
            ? `${evt.name} (${Math.ceil(evt.remaining)}s)`
            : '',
          missionObjective: missionHudLine(this.missionRuntime),
          metaBlocked: this.metaBlocked,
          score: this.score,
          fps: this.fps,
          showFps: this.save.data.settings.showFps,
          waveReady: this.waveReady,
          waveActive: this.waveActive,
          prepareTimer: this.prepareTimer,
          speed: this.speed,
          paused: this.speed === 0,
          autoWaves: this.autoWaves,
          blitzActive: this.blitzActive,
          showAllRanges: this.showAllRanges,
          selected: this.selectedTower,
          currentTargetName: this.hudCurrentTargetName,
          selectedEnemy: selEnemy,
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
          hero: this.heroHudState(),
          boss: liveBoss ? liveBoss.hud() : null,
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
