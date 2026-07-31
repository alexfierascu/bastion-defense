import { GAME_TITLE, GAME_VERSION } from '../config/constants';
import { ACHIEVEMENTS, formatAchievementReward } from '../config/achievements';
import { ABILITY_DEFS, ABILITY_ORDER, AbilityType } from '../config/abilities';
import {
  ART_STYLE_ORDER,
  ART_STYLES,
  ArtStyleId,
  isArtStyleUnlocked,
} from '../config/artThemes';
import {
  PATH_THEME_ORDER,
  PATH_THEMES,
  PathThemeId,
  TOWER_SKIN_ORDER,
  TOWER_SKINS,
  TowerSkinId,
} from '../config/cosmetics';
import { BIOME_DEFS } from '../config/biomes';
import { getMission, missionTypeLabel } from '../config/campaign';
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  DifficultyId,
  migrateDifficultyId,
} from '../config/difficulty';
import { ENEMY_DEFS, ENEMY_ROSTER, EnemyRole } from '../config/enemies';
import { FACTION_DEFS } from '../config/factions';
import { HERO_DEFS, HERO_ORDER, HERO_TALENTS, HeroId } from '../config/heroes';
import { MODIFIER_DEFS, MODIFIER_ORDER, ModifierId } from '../config/modifiers';
import {
  TARGETING_LABELS,
  TARGETING_MODES,
  TOWER_DEFS,
  TOWER_ORDER,
  TowerType,
  TargetingMode,
  UpgradePath,
} from '../config/towers';
import { TOWER_UNLOCK_RULES } from '../config/unlocks';
import { t, Lang } from '../config/i18n';
import { formatKeyCode, KEYBIND_LABELS, KeyBindings } from '../engine/input';
import { MAP_PRESETS } from '../systems/map';
import { SaveManager, SettingsData } from '../save/saveManager';
import { Tower } from '../entities/tower';
import { AbilitySystem } from '../systems/abilities';
import { ProfilerSample } from '../engine/profiler';
import { formatReplayAction } from '../systems/replay';
import {
  BRANCH_LABELS,
  prestigeBonuses,
  prestigeResetTree,
  SKILL_BRANCHES,
  SKILL_DEFS,
  SkillId,
  skillUnlocked,
} from '../systems/research';
import { mountTitleScene, TitleAction, TitleAudioBridge, TitleSceneHandle } from '../title';
import { formatSurvivalTime } from '../utils/timeFormat';
import { mountWorldMap } from './worldMapView';

export type ScreenId =
  | 'main'
  | 'worldMap'
  | 'mapSelect'
  | 'brief'
  | 'hud'
  | 'pause'
  | 'settings'
  | 'credits'
  | 'achievements'
  | 'profile'
  | 'encyclopedia'
  | 'research'
  | 'gameOver'
  | 'victory'
  | 'missionSummary'
  | 'slots'
  | 'replay'
  | 'hidden';

export interface UiCallbacks {
  onNewGame: (
    mapIndex: number,
    daily: boolean,
    difficulty?: DifficultyId,
    modifiers?: ModifierId[],
  ) => void;
  /** Start a campaign mission by id. */
  onStartMission?: (missionId: string, difficulty: DifficultyId) => void;
  onContinue: () => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  /** War Room rematch with the same seed. */
  onRematchSeed?: (
    seed: string,
    mapIndex: number,
    difficulty: DifficultyId,
    modifiers: ModifierId[],
  ) => void;
  onOpenWorldMap?: () => void;
  onPause: () => void;
  onSpeed: (speed: number) => void;
  onSelectTowerType: (type: TowerType | null) => void;
  onUpgrade: (path?: UpgradePath) => void;
  onSell: () => void;
  onCycleTargeting: () => void;
  onApplyTargetingToType: () => void;
  onCopyTargeting: () => void;
  onPasteTargeting: () => void;
  onUndo: () => void;
  onOpenEncyclopedia: (focus?: string) => void;
  onAbility: (id: AbilityType) => void;
  onSettingsChange: (s: SettingsData) => void;
  onFullscreen: () => void;
  onStartNextWave: () => void;
  onEnterEndless: () => void;
  onResearchPurchase: (id: SkillId) => boolean;
  onToggleAutoWaves: () => void;
  onBlitzWave: () => void;
  onToggleShowRanges: () => void;
  onScreenshot: () => void;
  onPhotoMode: () => void;
  onExportSave: () => void;
  onImportSave: (json: string) => { ok: boolean; error?: string };
  onSelectSlot: (id: number) => void;
  onRenameSlot: (id: number, name: string) => void;
  /** Title scene audio bridge (docs/08-AUDIO.md). */
  titleAudio?: TitleAudioBridge;
  /** Enter the Bastion — open campaign world map (legacy alias). */
  onEnterBastion?: () => void;
  onOpenFieldResearch?: () => void;
  onActivateRunResearch?: (id: string) => boolean;
  onPickEliteReward?: (id: string) => void;
  onCloseMetaOverlay?: () => void;
  onHeroAbility?: (id: string) => void;
  onPickHeroTalent?: (id: string) => void;
  onSelectHero?: () => void;
  onHeroSelectedForRun?: (id: string) => void;
}

/** Reserved chrome around the playfield (CSS px). Camera uses the same insets. */
export const HUD_INSETS = {
  top: 84,
  right: 0,
  bottom: 108,
  left: 0,
} as const;

export class UIManager {
  private root: HTMLElement;
  private screen: ScreenId = 'main';
  private save: SaveManager;
  private cb: UiCallbacks;
  private lang: Lang = 'en';
  private toastTimer = 0;
  private toastQueue: string[] = [];
  private toastActive = false;
  private achTimer = 0;
  private achQueue: { name: string; icon: string; rewardText?: string }[] = [];
  private achActive = false;
  private speedBtnEls: HTMLElement[] = [];
  private selectedBuild: TowerType | null = null;
  private dockTab: 'build' | 'powers' = 'build';
  private selectedDifficulty: DifficultyId = 'veteran';
  private selectedModifiers: ModifierId[] = [];
  private lastPayload: Record<string, unknown> = {};
  private rebindingKey: keyof KeyBindings | null = null;
  private titleScene: TitleSceneHandle | null = null;
  private fadeEl: HTMLElement | null = null;
  private metaOverlay: HTMLElement | null = null;
  private worldMapCleanup: (() => void) | null = null;
  /** Avoid rebuilding upgrade path buttons every frame (breaks clicks). */
  private towerUpgradeKey = '';
  /** Cached HUD nodes — avoid querySelector storms every frame. */
  private hudEls: Record<string, HTMLElement | null> | null = null;
  private lastKillFeedKey = '';
  private selectedHeroForRun: HeroId = 'warden';
  private pendingMissionId: string | null = null;
  private pendingStart: {
    mapIndex: number;
    daily: boolean;
    difficulty: DifficultyId;
    modifiers: ModifierId[];
  } | null = null;

  constructor(root: HTMLElement, save: SaveManager, callbacks: UiCallbacks) {
    this.root = root;
    this.save = save;
    this.cb = callbacks;
    this.lang = save.data.settings.language;
    this.selectedDifficulty = save.data.lastDifficulty ?? 'veteran';
  }

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private dailySeed(): string {
    return `daily-${this.todayKey()}`;
  }

  setLang(lang: Lang): void {
    this.lang = lang;
  }

  /** Full-screen fade for menu → gameplay transitions (0..1). */
  setFade(opacity: number): void {
    if (!this.fadeEl) {
      this.fadeEl = document.createElement('div');
      this.fadeEl.className = 'scene-fade';
      this.fadeEl.setAttribute('aria-hidden', 'true');
      (document.getElementById('app') ?? document.body).appendChild(this.fadeEl);
    }
    const a = Math.max(0, Math.min(1, opacity));
    this.fadeEl.style.opacity = String(a);
    this.fadeEl.style.pointerEvents = a > 0.02 ? 'auto' : 'none';
  }

  clearFade(): void {
    this.setFade(0);
  }

  /** Large cinematic WAVE / Wave Cleared text over the playfield. */
  showCinematicBanner(title: string, durationSec = 1.5, subtitle = ''): void {
    const existing = this.root.querySelector('.cine-banner');
    existing?.remove();
    const el = this.el(`
      <div class="cine-banner" aria-live="polite">
        <p class="cine-title">${title}</p>
        ${subtitle ? `<p class="cine-sub">${subtitle}</p>` : ''}
      </div>
    `);
    this.root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    window.setTimeout(() => {
      el.classList.remove('show');
      el.classList.add('hide');
      window.setTimeout(() => el.remove(), 420);
    }, Math.max(400, durationSec * 1000));
  }

  show(screen: ScreenId, payload?: Record<string, unknown>): void {
    this.titleScene?.destroy();
    this.titleScene = null;
    this.worldMapCleanup?.();
    this.worldMapCleanup = null;
    // Screen swap wipes the #toast / #ach-popup nodes — drop queued notices with them.
    window.clearTimeout(this.toastTimer);
    this.toastQueue.length = 0;
    this.toastActive = false;
    window.clearTimeout(this.achTimer);
    this.achQueue.length = 0;
    this.achActive = false;
    this.speedBtnEls = [];
    this.screen = screen;
    this.lastPayload = payload ?? {};
    if (payload?.from === 'pause') this.root.dataset.from = 'pause';
    else if (screen !== 'settings' && screen !== 'encyclopedia') delete this.root.dataset.from;
    this.root.innerHTML = '';
    this.root.className = `ui-root screen-${screen}`;
    this.root.setAttribute('role', 'application');

    switch (screen) {
      case 'main':
        this.renderMain();
        break;
      case 'worldMap':
        this.renderWorldMap();
        break;
      case 'mapSelect':
        this.renderMapSelect();
        break;
      case 'brief':
        this.renderBrief();
        break;
      case 'missionSummary':
        this.renderMissionSummary(payload);
        break;
      case 'hud':
        this.renderHud();
        break;
      case 'pause':
        this.renderPause();
        break;
      case 'slots':
        this.renderSlots();
        break;
      case 'replay':
        this.renderReplay();
        break;
      case 'settings':
        this.renderSettings();
        break;
      case 'credits':
        this.renderCredits();
        break;
      case 'achievements':
        this.renderAchievements();
        break;
      case 'profile':
        this.renderProfile();
        break;
      case 'encyclopedia':
        this.renderEncyclopedia(payload);
        break;
      case 'research':
        this.renderResearch();
        break;
      case 'gameOver':
        this.renderEnd(false, payload);
        break;
      case 'victory':
        this.renderEnd(true, payload);
        break;
      case 'hidden':
        break;
    }
  }

  getScreen(): ScreenId {
    return this.screen;
  }

  private el(html: string): HTMLElement {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild as HTMLElement;
  }

  private renderMain(): void {
    const hasContinue =
      !!this.save.data.continueGame ||
      this.save.data.saveSlots.some((s) => !!s.snapshot);
    const hasReplay = !!this.save.data.lastReplay;

    const host = this.el(`<div class="landing-overlay" id="title-host"></div>`);
    this.root.appendChild(host);

    this.titleScene = mountTitleScene({
      root: host,
      title: GAME_TITLE,
      version: GAME_VERSION,
      hasContinue,
      hasReplay,
      reduceMotion:
        this.save.data.settings.reduceMotion ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      audio: this.cb.titleAudio,
      onAction: (action: TitleAction) => {
        switch (action) {
          case 'new':
            if (this.cb.onOpenWorldMap) this.cb.onOpenWorldMap();
            else if (this.cb.onEnterBastion) this.cb.onEnterBastion();
            else this.show('worldMap');
            break;
          case 'continue':
          case 'slots':
            this.show('slots');
            break;
          case 'daily':
            this.pendingStart = {
              mapIndex: 0,
              daily: true,
              difficulty: 'commander',
              modifiers: [],
            };
            this.show('brief');
            break;
          case 'research':
            this.show('research');
            break;
          case 'achievements':
            this.show('achievements');
            break;
          case 'profile':
            this.show('profile');
            break;
          case 'encyclopedia':
            this.show('encyclopedia');
            break;
          case 'replay':
            this.show('replay');
            break;
          case 'settings':
            this.show('settings');
            break;
          case 'credits':
            this.show('credits');
            break;
          case 'copy-seed': {
            const seed = this.dailySeed();
            void navigator.clipboard.writeText(seed).then(
              () => this.showToast(`Copied ${seed}`),
              () => this.showToast(`Seed: ${seed}`),
            );
            break;
          }
        }
      },
    });
  }

  private renderResearch(): void {
    const points = this.save.data.researchPoints;
    const prestige = this.save.data.prestigeLevel;
    const prest = prestigeBonuses(prestige);
    const branches = SKILL_BRANCHES.map((branch) => {
      const cards = SKILL_DEFS.filter((s) => s.branch === branch)
        .map((s) => {
          const rank = this.save.data.skillTree[s.id] ?? 0;
          const unlocked = skillUnlocked(this.save.data.skillTree, s);
          const req =
            s.requires
              ?.map((r) => {
                const dep = SKILL_DEFS.find((d) => d.id === r.id);
                return `${dep?.name ?? r.id} Rank ${r.rank}`;
              })
              .join(', ') ?? '';
          return `<button class="enc-card skill-card ${unlocked ? '' : 'locked'}" data-skill="${s.id}" ${unlocked ? '' : 'disabled'} aria-label="${s.name}">
            <h4>${s.name}</h4>
            <p>${s.description}</p>
            <p class="muted">Rank ${rank}/${s.maxRank} · ${s.costPerRank} RP${req ? ` · Needs ${req}` : ''}</p>
          </button>`;
        })
        .join('');
      return `<section class="skill-branch"><h3>${BRANCH_LABELS[branch]}</h3><div class="enc-grid">${cards}</div></section>`;
    }).join('');
    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel wide">
          <h2>Research Lab</h2>
          <p>Research Points: <strong>${points}</strong> · Prestige Level: <strong>${prestige}</strong></p>
          <p class="muted">Prestige bonuses: +${prest.startingGold}g start · +${(prest.interestBonus * 100).toFixed(1)}% interest · ×${prest.damageMult.toFixed(2)} damage · +${prest.researchPointBonus} RP on campaign clear.</p>
          ${branches}
          <div class="menu-actions-secondary" style="margin-top:12px">
            <button class="btn" data-act="prestige">Prestige (keep tree, +5 RP)</button>
            <button class="btn" data-act="prestige-reset">Prestige Reset (refund 50% RP spent)</button>
          </div>
          <button class="btn primary" data-act="back">Back</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);
    panel.querySelectorAll('[data-skill]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.skill as SkillId;
        if (this.cb.onResearchPurchase(id)) this.show('research');
      });
    });
    const doPrestige = (resetTree: boolean) => {
      if (this.save.data.statistics.highestWave < 50) {
        this.showConfirm('Prestige locked', 'Reach wave 50 at least once to prestige.', () => {}, {
          okOnly: true,
        });
        return;
      }
      this.save.data.prestigeLevel += 1;
      let gain = 5;
      if (resetTree) {
        const r = prestigeResetTree(this.save.data.skillTree);
        this.save.data.skillTree = r.tree;
        gain += r.refundRp;
      }
      this.save.data.researchPoints += gain;
      this.save.syncProgressUnlocks();
      this.save.save();
      this.show('research');
    };
    panel.querySelector('[data-act="prestige"]')!.addEventListener('click', () => doPrestige(false));
    panel.querySelector('[data-act="prestige-reset"]')!.addEventListener('click', () => doPrestige(true));
    panel.querySelector('[data-act="back"]')!.addEventListener('click', () => this.show('main'));
  }

  private renderMapSelect(): void {
    this.selectedDifficulty = this.save.data.lastDifficulty ?? this.selectedDifficulty;
    const unlocked = this.save.data.unlockedMaps;
    const diffBtns = DIFFICULTY_ORDER.map((id) => {
      const d = DIFFICULTIES[id];
      const active = this.selectedDifficulty === id ? 'active-toggle' : '';
      return `<button type="button" class="diff-btn ${active}" data-diff="${id}" title="${d.description}">${d.name}</button>`;
    }).join('');
    const modChips = MODIFIER_ORDER.map((id) => {
      const m = MODIFIER_DEFS[id];
      const active = this.selectedModifiers.includes(id) ? 'active-toggle' : '';
      return `<button type="button" class="mod-chip ${active}" data-mod="${id}" title="${m.description}">${m.name}</button>`;
    }).join('');
    const cards =
      MAP_PRESETS.map((m, i) => {
        const open = unlocked.includes(m.id) || i === 0;
        return `<button class="map-card ${open ? '' : 'locked'}" data-map="${i}" ${open ? '' : 'disabled'}>
          <span class="map-name">${m.name}</span>
          <span class="map-meta">${open ? 'Ready' : 'Locked'}</span>
        </button>`;
      }).join('') +
      `<button class="map-card" data-map="-1">
        <span class="map-name">Random Map</span>
        <span class="map-meta">Procedural layout</span>
      </button>`;
    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel wide">
          <h2>New Operation</h2>
          <div class="setup-section">
            <h3>Difficulty</h3>
            <div class="diff-row">${diffBtns}</div>
            <p class="muted" id="diff-desc">${DIFFICULTIES[this.selectedDifficulty].description}</p>
          </div>
          <div class="setup-section">
            <h3>Challenge Modifiers</h3>
            <div class="mod-row">${modChips}</div>
          </div>
          <div class="setup-section">
            <h3>Map</h3>
            <div class="map-grid">${cards}</div>
          </div>
          <button class="btn" data-act="back">Back</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);

    const desc = panel.querySelector('#diff-desc') as HTMLElement;
    panel.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.diff as DifficultyId;
        this.selectedDifficulty = id;
        panel.querySelectorAll('[data-diff]').forEach((x) => {
          x.classList.toggle('active-toggle', (x as HTMLElement).dataset.diff === id);
        });
        desc.textContent = DIFFICULTIES[id].description;
      });
    });
    panel.querySelectorAll('[data-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.mod as ModifierId;
        const i = this.selectedModifiers.indexOf(id);
        if (i >= 0) this.selectedModifiers.splice(i, 1);
        else this.selectedModifiers.push(id);
        btn.classList.toggle('active-toggle', this.selectedModifiers.includes(id));
      });
    });
    panel.querySelectorAll('[data-map]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number((btn as HTMLElement).dataset.map);
        this.pendingStart = {
          mapIndex: idx,
          daily: false,
          difficulty: this.selectedDifficulty,
          modifiers: [...this.selectedModifiers],
        };
        this.show('brief');
      });
    });
    panel.querySelector('[data-act="back"]')!.addEventListener('click', () => this.show('main'));
  }

  private renderWorldMap(): void {
    this.worldMapCleanup = mountWorldMap(this.root, this.save.data.campaignProgress, {
      onSelectMission: (missionId) => {
        this.pendingMissionId = missionId;
        const m = getMission(missionId);
        if (m) this.selectedDifficulty = m.difficulty;
        this.pendingStart = null;
        this.show('brief');
      },
      onBack: () => this.show('main'),
      onSkirmish: () => this.show('mapSelect'),
    });
  }

  private renderBrief(): void {
    const mission = this.pendingMissionId ? getMission(this.pendingMissionId) : null;
    const p = this.pendingStart;

    if (!mission && !p) {
      this.show('worldMap');
      return;
    }

    if (mission) {
      const biome = BIOME_DEFS[mission.biomeId];
      const diffBtns = DIFFICULTY_ORDER.map((id) => {
        const d = DIFFICULTIES[id];
        const on = this.selectedDifficulty === id ? 'active-toggle' : '';
        return `<button class="btn compact ${on}" data-diff="${id}">${d.name}</button>`;
      }).join('');
      const panel = this.el(`
        <div class="menu-overlay">
          <div class="menu-panel brief-panel">
            <div class="brief-loading-art" style="--brief-tint:${biome.terrainTint};--brief-sky:${biome.skyTop}">
              <div class="brief-scanline"></div>
              <p class="brand-tag">${missionTypeLabel(mission.type)}</p>
              <h2>${mission.name}</h2>
            </div>
            <p class="brief-lore">${mission.lore}</p>
            <ul class="brief-stats">
              <li><span>Biome</span><strong>${biome.name}</strong></li>
              <li><span>Map</span><strong>${MAP_PRESETS.find((m) => m.id === mission.mapId)?.name ?? mission.mapId}</strong></li>
              <li><span>Power</span><strong>${mission.recommendedPower}</strong></li>
              <li><span>Objective</span><strong>${missionBriefObjective(mission)}</strong></li>
              <li><span>Rewards</span><strong>${mission.rewards.gold}g · ${mission.rewards.researchPoints} RP</strong></li>
            </ul>
            <div class="setup-section">
              <h3>Difficulty</h3>
              <div class="diff-row">${diffBtns}</div>
              <p class="muted" id="diff-desc">${DIFFICULTIES[this.selectedDifficulty].description}</p>
            </div>
            <h3 class="brief-hero-title">Select Hero</h3>
            <div class="hero-pick-row">
              ${HERO_ORDER.map((id) => {
                const h = HERO_DEFS[id];
                const unlocked =
                  this.save.data.campaignProgress.unlockedHeroes.includes(id) ||
                  id === 'warden';
                const on = this.selectedHeroForRun === id ? 'active-toggle' : '';
                return `<button class="btn hero-pick ${on}" data-hero="${id}" ${unlocked ? '' : 'disabled'} title="${h.description}">
                  <span class="hero-pick-icon">${h.portrait}</span>
                  <strong>${h.name}</strong>
                  <span class="muted">${unlocked ? h.title : 'Locked'}</span>
                </button>`;
              }).join('')}
            </div>
            <button class="btn primary" data-act="deploy">Deploy</button>
            <button class="btn" data-act="back">Back</button>
          </div>
        </div>
      `);
      this.root.appendChild(panel);
      const desc = panel.querySelector('#diff-desc') as HTMLElement;
      panel.querySelectorAll('[data-diff]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.diff as DifficultyId;
          this.selectedDifficulty = id;
          panel.querySelectorAll('[data-diff]').forEach((x) => {
            x.classList.toggle('active-toggle', (x as HTMLElement).dataset.diff === id);
          });
          desc.textContent = DIFFICULTIES[id].description;
        });
      });
      panel.querySelectorAll('[data-hero]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selectedHeroForRun = (btn as HTMLElement).dataset.hero as HeroId;
          this.cb.onHeroSelectedForRun?.(this.selectedHeroForRun);
          panel.querySelectorAll('[data-hero]').forEach((b) => {
            b.classList.toggle(
              'active-toggle',
              (b as HTMLElement).dataset.hero === this.selectedHeroForRun,
            );
          });
        });
      });
      panel.querySelector('[data-act="deploy"]')!.addEventListener('click', () => {
        const id = this.pendingMissionId!;
        this.cb.onHeroSelectedForRun?.(this.selectedHeroForRun);
        this.cb.onStartMission?.(id, this.selectedDifficulty);
      });
      panel.querySelector('[data-act="back"]')!.addEventListener('click', () => {
        this.pendingMissionId = null;
        this.show('worldMap');
      });
      return;
    }

    // Skirmish / daily brief
    const mapName = p!.daily
      ? 'Daily Challenge'
      : p!.mapIndex < 0
        ? 'Random Frontier'
        : (MAP_PRESETS[p!.mapIndex]?.name ?? 'Unknown Map');
    const diff = DIFFICULTIES[p!.difficulty];
    const mods =
      p!.modifiers.length === 0
        ? 'None'
        : p!.modifiers.map((m) => MODIFIER_DEFS[m]?.name ?? m).join(', ');
    const mapId = p!.mapIndex >= 0 ? MAP_PRESETS[p!.mapIndex]?.id : '';
    const lore = p!.daily
      ? 'The swarm adapts every day. One seed. One chance. Your best score is recorded locally.'
      : p!.mapIndex < 0
        ? 'Uncharted ground. Paths shift. Build zones are scarce. Trust your instincts.'
        : mapId === 'bastion-approach'
          ? 'The forest road leads home. Cross the bridge, hold the outer wall, and let nothing reach the Great Tree.'
          : `Briefing: Hold ${mapName}. The path is fixed — your kill zone is not. Spend wisely before the first horn.`;

    const dailyBoard = p!.daily
      ? (() => {
          const rows = this.save.data.dailyHistory
            .slice(0, 5)
            .map(
              (h) =>
                `<tr><td>${h.date}</td><td>${h.wave}</td><td>${h.score}</td><td class="mono">${h.seed.slice(0, 12)}</td></tr>`,
            )
            .join('');
          return rows
            ? `<h3 class="brief-hero-title">Recent Daily Board</h3>
               <table class="daily-board"><thead><tr><th>Date</th><th>Wave</th><th>Score</th><th>Seed</th></tr></thead><tbody>${rows}</tbody></table>`
            : `<p class="muted">No daily runs recorded yet — set the first mark.</p>`;
        })()
      : '';

    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel brief-panel">
          <p class="brand-tag">Mission Brief</p>
          <h2>${mapName}</h2>
          <p class="brief-lore">${lore}</p>
          <ul class="brief-stats">
            <li><span>Difficulty</span><strong>${diff.name}</strong></li>
            <li><span>Modifiers</span><strong>${mods}</strong></li>
            <li><span>Objective</span><strong>${p!.daily ? 'Top the daily board' : 'Endless survival'}</strong></li>
          </ul>
          ${dailyBoard}
          <h3 class="brief-hero-title">Select Hero</h3>
          <div class="hero-pick-row">
            ${HERO_ORDER.map((id) => {
              const h = HERO_DEFS[id];
              const on = this.selectedHeroForRun === id ? 'active-toggle' : '';
              return `<button class="btn hero-pick ${on}" data-hero="${id}" title="${h.description}">
                <span class="hero-pick-icon">${h.portrait}</span>
                <strong>${h.name}</strong>
                <span class="muted">${h.title}</span>
              </button>`;
            }).join('')}
          </div>
          <div class="brief-cinematic" aria-hidden="true">
            <div class="brief-scanline"></div>
          </div>
          <button class="btn primary" data-act="deploy">Deploy</button>
          <button class="btn" data-act="back">Back</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);
    panel.querySelectorAll('[data-hero]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedHeroForRun = (btn as HTMLElement).dataset.hero as HeroId;
        this.cb.onHeroSelectedForRun?.(this.selectedHeroForRun);
        panel.querySelectorAll('[data-hero]').forEach((b) => {
          b.classList.toggle('active-toggle', (b as HTMLElement).dataset.hero === this.selectedHeroForRun);
        });
      });
    });
    panel.querySelector('[data-act="deploy"]')!.addEventListener('click', () => {
      const start = this.pendingStart!;
      this.pendingStart = null;
      this.cb.onHeroSelectedForRun?.(this.selectedHeroForRun);
      this.cb.onNewGame(start.mapIndex, start.daily, start.difficulty, start.modifiers);
    });
    panel.querySelector('[data-act="back"]')!.addEventListener('click', () => {
      this.show(p!.daily ? 'main' : 'mapSelect');
    });
  }

  private renderMissionSummary(payload?: Record<string, unknown>): void {
    const p = payload ?? {};
    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel brief-panel">
          <p class="brand-tag">Mission Complete</p>
          <h2>${p.missionName ?? 'Victory'}</h2>
          <p class="brief-lore">${p.summary ?? 'The Bastion holds.'}</p>
          <ul class="brief-stats">
            <li><span>Waves</span><strong>${p.wave ?? 0}</strong></li>
            <li><span>Score</span><strong>${p.score ?? 0}</strong></li>
            <li><span>Gold earned</span><strong>${p.goldReward ?? 0}</strong></li>
            <li><span>Research</span><strong>+${p.rpReward ?? 0} RP</strong></li>
            <li><span>Unlocked</span><strong>${p.unlocks || '—'}</strong></li>
          </ul>
          <button class="btn primary" data-act="map">World Map</button>
          <button class="btn" data-act="menu">Main Menu</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);
    panel.querySelector('[data-act="map"]')!.addEventListener('click', () => this.show('worldMap'));
    panel.querySelector('[data-act="menu"]')!.addEventListener('click', () => this.show('main'));
  }

  private renderSlots(): void {
    const slots = this.save.data.saveSlots
      .map((s) => {
        const active = this.save.data.activeSlot === s.id ? 'active-toggle' : '';
        const snap = s.snapshot;
        const mapName = snap
          ? (MAP_PRESETS.find((m) => m.id === snap.mapId)?.name ?? snap.mapId)
          : '';
        const meta = snap
          ? `${mapName} · W${snap.wave} · ${snap.gold}g · ${new Date(s.updatedAt || Date.now()).toLocaleDateString()}`
          : 'Empty';
        return `<div class="slot-card ${active}" data-slot="${s.id}">
          <input class="slot-name" data-rename="${s.id}" value="${s.name}" maxlength="24" />
          <p class="muted">${meta}</p>
          <div class="slot-actions">
            <button class="btn compact" data-load="${s.id}" ${snap ? '' : 'disabled'}>Load</button>
            <button class="btn compact" data-select="${s.id}">Set Active</button>
          </div>
        </div>`;
      })
      .join('');
    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel wide">
          <h2>Save Slots</h2>
          <p class="muted">Mid-run progress is written to the active slot on each wave clear.</p>
          <div class="slot-grid">${slots}</div>
          <button class="btn primary" data-act="back">Back</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);
    panel.querySelectorAll('[data-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.cb.onSelectSlot(Number((btn as HTMLElement).dataset.select));
        this.show('slots');
      });
    });
    panel.querySelectorAll('[data-load]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.cb.onSelectSlot(Number((btn as HTMLElement).dataset.load));
        this.cb.onContinue();
      });
    });
    panel.querySelectorAll('[data-rename]').forEach((input) => {
      input.addEventListener('change', () => {
        const id = Number((input as HTMLInputElement).dataset.rename);
        this.cb.onRenameSlot(id, (input as HTMLInputElement).value);
      });
    });
    panel.querySelector('[data-act="back"]')!.addEventListener('click', () => this.show('main'));
  }

  private renderReplay(): void {
    const replay = this.save.data.lastReplay;
    if (!replay) {
      this.show('main');
      return;
    }
    const lines = replay.actions
      .slice(-40)
      .map((a) => `<li>${formatReplayAction(a)}</li>`)
      .join('');
    const sum = replay.summary;
    const history = this.save.data.dailyHistory
      .slice()
      .reverse()
      .slice(0, 8)
      .map(
        (h) =>
          `<tr><td>${h.date}</td><td>W${h.wave}</td><td>${h.score}</td><td><code>${h.seed}</code></td></tr>`,
      )
      .join('');
    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel wide">
          <h2>War Room</h2>
          <p><strong>${replay.mapName}</strong> · ${replay.difficulty}</p>
          <p class="muted">Seed <code class="seed-code">${replay.seed}</code></p>
          <p class="muted">${sum ? `${sum.victory ? 'Victory' : 'Defeat'} · W${sum.wave} · ${sum.score} score · ${sum.kills} kills · ${Math.round(sum.durationSec)}s` : 'In-progress log'}</p>
          <div class="report-actions" style="margin:12px 0">
            <button class="btn primary" data-act="rematch">Rematch Seed</button>
            <button class="btn" data-act="copy-seed">Copy Seed</button>
            <button class="btn" data-act="copy">Export JSON</button>
          </div>
          <details class="replay-details">
            <summary>Action log (last 40)</summary>
            <ol class="replay-log">${lines}</ol>
          </details>
          <h3>Daily Board</h3>
          ${
            history
              ? `<table class="daily-board"><thead><tr><th>Date</th><th>Wave</th><th>Score</th><th>Seed</th></tr></thead><tbody>${history}</tbody></table>`
              : `<p class="muted">No daily runs recorded yet.</p>`
          }
          <button class="btn primary" data-act="back">Back</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);
    panel.querySelector('[data-act="rematch"]')?.addEventListener('click', () => {
      const diff = migrateDifficultyId(replay.difficulty as string);
      this.cb.onRematchSeed?.(
        replay.seed,
        replay.mapIndex,
        diff,
        (replay.modifiers as ModifierId[]) ?? [],
      );
    });
    panel.querySelector('[data-act="copy-seed"]')!.addEventListener('click', () => {
      void navigator.clipboard.writeText(replay.seed);
      this.showToast('Seed copied');
    });
    panel.querySelector('[data-act="copy"]')!.addEventListener('click', () => {
      void navigator.clipboard.writeText(JSON.stringify(replay, null, 2));
      this.showToast('Replay JSON copied');
    });
    panel.querySelector('[data-act="back"]')!.addEventListener('click', () => this.show('main'));
  }

  private renderHud(): void {
    this.dockTab = 'build';
    const kb = this.save.data.settings.keyBindings;
    const unlocked = new Set(this.save.data.unlockedTowers);
    const towers = TOWER_ORDER.map((type) => {
      const d = TOWER_DEFS[type];
      const open = unlocked.has(type);
      const rule = TOWER_UNLOCK_RULES.find((r) => r.type === type);
      const tip = open ? `${d.name} — ${d.cost}g` : `Locked — ${rule?.hint ?? 'Progress further'}`;
      return `<button class="tower-btn ${open ? '' : 'locked'}" data-tower="${type}" title="${tip}" aria-label="${tip}" ${open ? '' : 'disabled'}>
          <span class="swatch" style="background:${d.accent}"></span>
          <span class="tname">${d.name.split(' ')[0]}</span>
          <span class="tcost">${open ? d.cost : '🔒'}</span>
        </button>`;
    }).join('');

    const abilities = ABILITY_ORDER.map((id, i) => {
      const d = ABILITY_DEFS[id];
      const keys = [kb.ability1, kb.ability2, kb.ability3, kb.ability4, kb.ability5, kb.ability6];
      const hot = formatKeyCode(keys[i]!);
      return `<button class="ability-btn" data-ability="${id}" title="${d.name}: ${d.description} [${hot}]" aria-label="${d.name}">
        <span class="aicon" style="background:${d.color}">${d.icon}</span>
        <span class="aname">${d.name.split(' ')[0]}</span>
        <span class="hotkey">${hot}</span>
        <span class="acd" data-cd="${id}"></span>
        <span class="acost">${d.cost}</span>
      </button>`;
    }).join('');

    const hud = this.el(`
      <div class="hud chrome">
        <div class="pause-veil hidden" id="pause-veil" role="status" aria-label="Simulation paused">
          <div class="pause-veil-card">
            <h2>Paused</h2>
            <p>Press ${formatKeyCode(kb.speed1)} or click to resume</p>
          </div>
        </div>
        <header class="hud-chrome-top">
          <div class="hud-top-row">
            <div class="hud-stats hud-stats-primary">
              <div class="stat gold"><span class="stat-label">Gold</span><span class="stat-value" id="hud-gold">0</span></div>
              <div class="stat lives"><span class="stat-label" id="hud-lives-label">Gate</span><span class="stat-value" id="hud-lives">0</span></div>
              <div class="stat"><span class="stat-label">Wave</span><span class="stat-value" id="hud-wave">0</span></div>
              <div class="stat"><span class="stat-label">Enemy</span><span class="stat-value" id="hud-enemies">0</span></div>
              <div class="stat"><span class="stat-label">Score</span><span class="stat-value" id="hud-score">0</span></div>
            </div>
            <div class="hud-commands">
              <div class="speed-row">
                <button class="speed-btn" data-speed="0" title="Pause sim" aria-label="Pause simulation">II</button>
                <button class="speed-btn active" data-speed="1" title="1× [${formatKeyCode(kb.speed1)}]">1x <span class="hotkey">${formatKeyCode(kb.speed1)}</span></button>
                <button class="speed-btn" data-speed="2" title="2× [${formatKeyCode(kb.speed2)}]">2x <span class="hotkey">${formatKeyCode(kb.speed2)}</span></button>
                <button class="speed-btn" data-speed="4" title="4× [${formatKeyCode(kb.speed4)}]">4x <span class="hotkey">${formatKeyCode(kb.speed4)}</span></button>
              </div>
              <button class="btn compact" id="btn-next-wave" aria-label="Start next wave">Start Wave</button>
              <button class="btn compact" id="btn-research" title="Field Research">Research</button>
              <button class="btn compact" id="btn-hero" title="Select Hero">Hero</button>
              <button class="btn compact" id="btn-auto" title="Auto-start next waves">Auto</button>
              <button class="btn compact" id="btn-blitz" title="Resolve wave at extreme speed">Blitz</button>
              <button class="btn compact" id="btn-ranges" title="Show all tower ranges">Ranges</button>
              <button class="icon-btn" id="btn-pause" title="Pause [${formatKeyCode(kb.pause)}]" aria-label="Pause game">${formatKeyCode(kb.pause)}</button>
              <button class="icon-btn" id="btn-fs" title="Fullscreen" aria-label="Toggle fullscreen">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M2 6V2h4v1.5H3.5V6H2zm8-2.5V2h4v4h-1.5V3.5H10zM2 10h1.5v2.5H6V14H2v-4zm12 0v4h-4v-1.5h2.5V10H14z"/></svg>
              </button>
              <button class="btn compact" id="btn-menu">${t(this.lang, 'quit')}</button>
            </div>
          </div>
          <div class="boss-bar hidden" id="boss-bar" role="status" aria-label="Boss health">
            <div class="boss-bar-head">
              <strong id="boss-bar-name">Boss</strong>
              <span id="boss-bar-phase" class="muted"></span>
              <em id="boss-bar-ability"></em>
            </div>
            <div class="boss-bar-track">
              <div class="boss-bar-shield" id="boss-bar-shield"></div>
              <div class="boss-bar-hp" id="boss-bar-hp"></div>
            </div>
            <div class="boss-bar-nums"><span id="boss-bar-hp-text">0</span></div>
          </div>
          <div class="hud-meta-row">
            <div class="hud-stats hud-stats-meta">
              <div class="stat meta" id="hud-env"><span class="stat-label">Env</span><span class="stat-value" id="hud-env-val">—</span></div>
              <div class="stat meta" id="hud-diff-wrap"><span class="stat-label">Diff</span><span class="stat-value" id="hud-diff">—</span></div>
              <div class="stat meta" id="hud-fps-wrap"><span class="stat-label">FPS</span><span class="stat-value" id="hud-fps">60</span></div>
              <div class="stat meta"><span class="stat-label">Best</span><span class="stat-value" id="hud-best">0</span></div>
              <div class="stat meta"><span class="stat-label">Kills</span><span class="stat-value" id="hud-kills">0</span></div>
              <div class="stat meta"><span class="stat-label">Earned</span><span class="stat-value" id="hud-earned">0</span></div>
              <div class="stat meta"><span class="stat-label">Built</span><span class="stat-value" id="hud-built">0</span></div>
              <div class="stat meta"><span class="stat-label">Time</span><span class="stat-value" id="hud-time">0:00</span></div>
            </div>
            <p class="wave-preview" id="wave-preview" aria-live="polite"></p>
            <p class="hud-mission hidden" id="hud-mission" aria-live="polite"></p>
            <p class="hud-event hidden" id="hud-event" aria-live="polite"></p>
          </div>
        </header>

        <aside class="kill-feed" id="kill-feed" aria-live="polite" aria-label="Combat log"></aside>
        <aside class="profiler-hud hidden" id="profiler-hud" aria-label="Profiler"></aside>

        <footer class="hud-chrome-bottom">
          <div class="dock-tabs">
            <button class="dock-tab active" data-tab="build" aria-label="Towers dock">Towers</button>
            <button class="dock-tab" data-tab="powers" aria-label="Powers dock">Powers</button>
          </div>
          <div class="dock-body">
            <div class="build-bar dock-pane" data-pane="build">${towers}</div>
            <div class="ability-bar dock-pane hidden" data-pane="powers">${abilities}</div>
          </div>
          <div class="dock-map">
            <canvas id="minimap" width="160" height="88" aria-label="Minimap"></canvas>
          </div>
        </footer>

        <div class="tower-panel hidden" id="tower-panel" role="dialog" aria-label="Selected tower">
          <h3 id="tp-name">Tower</h3>
          <p id="tp-stats"></p>
          <p id="tp-meters" class="tp-meters"></p>
          <div class="tp-upgrade-choices hidden" id="tp-upgrade-choices"></div>
          <div class="tp-actions">
            <button class="btn compact" id="tp-upgrade">Upgrade</button>
            <button class="btn compact" id="tp-target" title="Cycle targeting mode">Target: First</button>
            <button class="btn compact" id="tp-apply-all" title="Set this targeting on every tower of this type (and as default)">Apply to Type</button>
            <button class="btn compact danger" id="tp-sell">Sell <span class="hotkey">${formatKeyCode(kb.sell)}</span></button>
          </div>
          <p class="tp-hint" id="tp-hint">${formatKeyCode(kb.undo)} undo · Target cycles First → Last → Closest → Strongest</p>
        </div>
        <div class="hero-panel hidden" id="hero-panel" role="dialog" aria-label="Hero">
          <div class="hero-panel-head">
            <span class="hero-portrait" id="hp-portrait">🛡</span>
            <div>
              <h3 id="hp-name">Hero</h3>
              <p id="hp-title" class="muted"></p>
            </div>
          </div>
          <p id="hp-stats"></p>
          <div class="hero-bars">
            <div class="hero-bar"><span>HP</span><div class="bar-track"><div class="bar-fill hp" id="hp-bar"></div></div><em id="hp-hp">0</em></div>
            <div class="hero-bar"><span>XP</span><div class="bar-track"><div class="bar-fill xp" id="hp-xp-bar"></div></div><em id="hp-xp">0</em></div>
          </div>
          <p id="hp-level" class="muted"></p>
          <p id="hp-talents" class="muted"></p>
          <div class="hero-abilities" id="hp-abilities"></div>
          <div class="hero-talent-choices hidden" id="hp-talent-choices"></div>
          <p class="tp-hint">Left-click select · Right-click move · T/Y/U abilities</p>
        </div>
        <div class="enemy-panel hidden" id="enemy-panel" role="dialog" aria-label="Selected enemy">
          <h3 id="ep-name">Enemy</h3>
          <p id="ep-stats"></p>
        </div>
        <div class="toast hidden" id="toast" role="status"></div>
        <div class="achievement-popup hidden" id="ach-popup" role="status"></div>
      </div>
    `);
    this.root.appendChild(hud);

    hud.querySelector('#btn-pause')!.addEventListener('click', () => this.cb.onPause());
    hud.querySelector('#pause-veil')!.addEventListener('click', () => this.cb.onSpeed(1));
    hud.querySelector('#btn-fs')!.addEventListener('click', () => this.cb.onFullscreen());
    hud.querySelector('#btn-menu')!.addEventListener('click', () => this.cb.onQuit());
    hud.querySelector('#btn-next-wave')!.addEventListener('click', () => this.cb.onStartNextWave());
    hud.querySelector('#btn-research')!.addEventListener('click', () => this.cb.onOpenFieldResearch?.());
    hud.querySelector('#btn-hero')!.addEventListener('click', () => this.cb.onSelectHero?.());
    hud.querySelector('#btn-auto')!.addEventListener('click', () => this.cb.onToggleAutoWaves());
    hud.querySelector('#hp-abilities')!.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest('[data-hero-ability]') as HTMLElement | null;
      if (btn) this.cb.onHeroAbility?.(btn.dataset.heroAbility!);
    });
    hud.querySelector('#hp-talent-choices')!.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest('[data-talent]') as HTMLElement | null;
      if (btn) this.cb.onPickHeroTalent?.(btn.dataset.talent!);
    });
    hud.querySelector('#btn-blitz')!.addEventListener('click', () => this.cb.onBlitzWave());
    hud.querySelector('#btn-ranges')!.addEventListener('click', () => this.cb.onToggleShowRanges());
    hud.querySelectorAll('.speed-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const s = Number((b as HTMLElement).dataset.speed);
        this.cb.onSpeed(s);
        hud.querySelectorAll('.speed-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
    hud.querySelectorAll('.dock-tab').forEach((b) => {
      b.addEventListener('click', () => {
        const tab = (b as HTMLElement).dataset.tab as 'build' | 'powers';
        this.dockTab = tab;
        hud.querySelectorAll('.dock-tab').forEach((x) => x.classList.toggle('active', x === b));
        hud.querySelectorAll('.dock-pane').forEach((pane) => {
          pane.classList.toggle('hidden', (pane as HTMLElement).dataset.pane !== tab);
        });
        if (tab === 'powers') {
          this.selectedBuild = null;
          this.cb.onSelectTowerType(null);
          hud.querySelectorAll('.tower-btn').forEach((x) => x.classList.remove('selected'));
        }
      });
    });
    hud.querySelectorAll('.tower-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const type = (b as HTMLElement).dataset.tower as TowerType;
        if (this.selectedBuild === type) {
          this.selectedBuild = null;
          b.classList.remove('selected');
          this.cb.onSelectTowerType(null);
        } else {
          this.selectedBuild = type;
          hud.querySelectorAll('.tower-btn').forEach((x) => x.classList.remove('selected'));
          b.classList.add('selected');
          this.cb.onSelectTowerType(type);
        }
      });
    });
    hud.querySelectorAll('.ability-btn').forEach((b) => {
      b.addEventListener('click', () => {
        this.cb.onAbility((b as HTMLElement).dataset.ability as AbilityType);
      });
    });
    hud.querySelector('#tp-upgrade')!.addEventListener('click', () => this.cb.onUpgrade());
    hud.querySelector('#tp-upgrade-choices')!.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest('[data-path]') as HTMLElement | null;
      if (!btn || btn.hasAttribute('disabled')) return;
      const path = btn.dataset.path as UpgradePath | undefined;
      if (path === 'a' || path === 'b') this.cb.onUpgrade(path);
    });
    hud.querySelector('#tp-sell')!.addEventListener('click', () => this.cb.onSell());
    hud.querySelector('#tp-target')!.addEventListener('click', () => this.cb.onCycleTargeting());
    hud.querySelector('#tp-apply-all')!.addEventListener('click', () => this.cb.onApplyTargetingToType());
    this.cacheHudEls(hud);
  }

  private cacheHudEls(hud: HTMLElement): void {
    const id = (sel: string) => hud.querySelector(sel) as HTMLElement | null;
    this.hudEls = {
      gold: id('#hud-gold'),
      lives: id('#hud-lives'),
      livesLabel: id('#hud-lives-label'),
      wave: id('#hud-wave'),
      enemies: id('#hud-enemies'),
      score: id('#hud-score'),
      best: id('#hud-best'),
      kills: id('#hud-kills'),
      earned: id('#hud-earned'),
      built: id('#hud-built'),
      time: id('#hud-time'),
      env: id('#hud-env-val'),
      diff: id('#hud-diff'),
      diffWrap: id('#hud-diff-wrap'),
      fps: id('#hud-fps'),
      fpsWrap: id('#hud-fps-wrap'),
      nextWave: id('#btn-next-wave'),
      research: id('#btn-research'),
      mission: id('#hud-mission'),
      event: id('#hud-event'),
      auto: id('#btn-auto'),
      blitz: id('#btn-blitz'),
      ranges: id('#btn-ranges'),
      preview: id('#wave-preview'),
      feed: id('#kill-feed'),
      profiler: id('#profiler-hud'),
      towerPanel: id('#tower-panel'),
      enemyPanel: id('#enemy-panel'),
      tpName: id('#tp-name'),
      tpStats: id('#tp-stats'),
      tpMeters: id('#tp-meters'),
      tpUpgrade: id('#tp-upgrade'),
      tpChoices: id('#tp-upgrade-choices'),
      tpSell: id('#tp-sell'),
      tpTarget: id('#tp-target'),
      tpApply: id('#tp-apply-all'),
      epName: id('#ep-name'),
      epStats: id('#ep-stats'),
      pauseVeil: id('#pause-veil'),
    };
    this.speedBtnEls = Array.from(hud.querySelectorAll('.speed-btn')) as HTMLElement[];
    this.lastKillFeedKey = '';
  }

  updateHud(state: {
    gold: number;
    lives: number;
    maxLives?: number;
    gateLabel?: boolean;
    goldPulse?: boolean;
    gateFlash?: boolean;
    wavePulse?: boolean;
    wave: number;
    maxWaves: number;
    endless: boolean;
    enemies: number;
    score: number;
    fps: number;
    showFps: boolean;
    waveReady: boolean;
    waveActive: boolean;
    prepareTimer?: number;
    /** Current sim speed (0 = soft pause). Drives speed-button state + pause veil. */
    speed: number;
    paused: boolean;
    autoWaves: boolean;
    blitzActive: boolean;
    showAllRanges: boolean;
    selected: Tower | null;
    selectedEnemy?: {
      name: string;
      hp: number;
      maxHp: number;
      speed: number;
      armor: number;
      reward: number;
      targetedBy: string;
      modifiers?: string;
      roleHint?: string;
    } | null;
    currentTargetName?: string;
    abilities: AbilitySystem;
    envLabel: string;
    difficulty?: string;
    wavePreview?: string;
    killFeed?: string[];
    keyHints?: Partial<Record<string, string>>;
    seed?: string;
    mapName?: string;
    profiler?: ProfilerSample;
    runStats?: {
      highestWave: number;
      kills: number;
      goldEarned: number;
      towersBuilt: number;
      timeSurvived: number;
    };
    researchPoints?: number;
    activeResearch?: string;
    activeEvent?: string;
    missionObjective?: string;
    metaBlocked?: boolean;
    hero?: {
      name: string;
      title: string;
      portrait: string;
      hp: number;
      maxHp: number;
      level: number;
      xp: number;
      xpToNext: number;
      damage: number;
      armor: number;
      attackSpeed: number;
      moveSpeed: number;
      attackRange: number;
      critChance: number;
      talents: string;
      alive: boolean;
      respawnTimer: number;
      selected: boolean;
      abilities: { id: string; name: string; cd: number; maxCd: number; ready: boolean }[];
      talentOptions?: { id: string; name: string; description: string }[];
    } | null;
    boss?: {
      name: string;
      title: string;
      hp: number;
      maxHp: number;
      shield: number;
      maxShield: number;
      phase: number;
      phaseName: string;
      intro: boolean;
      abilityHint: string;
    } | null;
  }): void {
    if (this.screen !== 'hud') return;
    const g = (id: string) => this.root.querySelector(id);
    const h = this.hudEls;
    const el = (key: string, fallback: string) =>
      (h?.[key] as HTMLElement | null) ?? (g(fallback) as HTMLElement);

    const goldEl = el('gold', '#hud-gold');
    goldEl.textContent = `${Math.floor(state.gold)}`;
    goldEl.classList.toggle('pulse-gold', !!state.goldPulse);
    goldEl.closest('.stat')?.classList.toggle('pulse-gold', !!state.goldPulse);
    const livesLabel = el('livesLabel', '#hud-lives-label');
    if (livesLabel) livesLabel.textContent = state.gateLabel ? 'Gate' : 'Lives';
    const maxL = state.maxLives ?? state.lives;
    const livesEl = el('lives', '#hud-lives');
    livesEl.textContent = state.gateLabel
      ? `${state.lives}/${maxL}`
      : `${state.lives}`;
    livesEl.classList.toggle('flash-gate', !!state.gateFlash);
    livesEl.closest('.stat')?.classList.toggle('flash-gate', !!state.gateFlash);
    const prep = state.prepareTimer ?? 0;
    const preparing = prep > 0 && state.waveReady && !state.waveActive;
    const nextWave = state.wave + 1;
    const waveEl = el('wave', '#hud-wave');
    waveEl.textContent = state.endless
      ? preparing
        ? `${state.wave} → ${nextWave}`
        : `${state.wave}`
      : preparing
        ? `Prep · ${nextWave}/${state.maxWaves}`
        : `${state.wave}/${state.maxWaves}`;
    waveEl.classList.toggle('pulse-wave', !!state.wavePulse);
    waveEl.closest('.stat')?.classList.toggle('pulse-wave', !!state.wavePulse);
    el('enemies', '#hud-enemies').textContent = `${state.enemies}`;
    el('score', '#hud-score').textContent = `${state.score}`;
    if (state.runStats) {
      el('best', '#hud-best').textContent = `${state.runStats.highestWave}`;
      el('kills', '#hud-kills').textContent = `${state.runStats.kills}`;
      el('earned', '#hud-earned').textContent = `${Math.floor(state.runStats.goldEarned)}`;
      el('built', '#hud-built').textContent = `${state.runStats.towersBuilt}`;
      el('time', '#hud-time').textContent = formatSurvivalTime(state.runStats.timeSurvived);
    }
    el('env', '#hud-env-val').textContent = state.envLabel || '—';
    const diffEl = el('diff', '#hud-diff');
    const diffWrap = el('diffWrap', '#hud-diff-wrap');
    if (state.difficulty) {
      diffWrap.style.display = '';
      diffEl.textContent = state.difficulty;
    } else {
      diffWrap.style.display = 'none';
    }
    const fpsWrap = el('fpsWrap', '#hud-fps-wrap');
    fpsWrap.style.display = state.showFps ? '' : 'none';
    el('fps', '#hud-fps').textContent = `${state.fps}`;
    const nw = el('nextWave', '#btn-next-wave') as HTMLButtonElement;
    nw.disabled = !state.waveReady || !!state.metaBlocked;
    if (preparing) {
      nw.textContent = `Start Wave (${Math.ceil(prep)}s)`;
    } else {
      nw.textContent = state.waveReady ? 'Start Wave' : 'Wave Active';
    }
    const researchBtn = el('research', '#btn-research') as HTMLButtonElement | null;
    if (researchBtn) {
      const rp = state.researchPoints ?? 0;
      researchBtn.textContent = rp > 0 ? `Research (${rp})` : 'Research';
      researchBtn.classList.toggle('active-toggle', rp > 0 && !state.activeResearch);
      researchBtn.disabled = !!state.metaBlocked;
    }
    const missionEl = el('mission', '#hud-mission');
    if (missionEl) {
      const obj = state.missionObjective || '';
      missionEl.textContent = obj;
      missionEl.classList.toggle('hidden', !obj);
    }
    const eventEl = el('event', '#hud-event');
    if (eventEl) {
      const label = state.activeEvent || '';
      eventEl.textContent = label;
      eventEl.classList.toggle('hidden', !label);
    }
    const autoBtn = el('auto', '#btn-auto');
    autoBtn.classList.toggle('active-toggle', state.autoWaves);
    autoBtn.textContent = state.autoWaves ? 'Auto ON' : 'Auto';
    const blitzBtn = el('blitz', '#btn-blitz') as HTMLButtonElement;
    blitzBtn.classList.toggle('active-toggle', state.blitzActive);
    blitzBtn.disabled = !state.waveActive && !state.waveReady;
    blitzBtn.textContent = state.blitzActive ? 'Blitz…' : 'Blitz';
    const rangesBtn = el('ranges', '#btn-ranges');
    rangesBtn.classList.toggle('active-toggle', state.showAllRanges);
    rangesBtn.textContent = state.showAllRanges ? 'Ranges ON' : 'Ranges';

    // Keep speed buttons in sync with keyboard shortcuts and show the pause veil.
    for (const b of this.speedBtnEls) {
      b.classList.toggle('active', Number(b.dataset.speed) === state.speed);
    }
    const veil = el('pauseVeil', '#pause-veil');
    if (veil) veil.classList.toggle('hidden', !state.paused);

    for (const id of ABILITY_ORDER) {
      const cdEl = g(`[data-cd="${id}"]`) as HTMLElement | null;
      if (!cdEl) continue;
      const cd = state.abilities.cooldowns[id]!;
      cdEl.textContent = cd > 0 ? `${Math.ceil(cd)}` : '';
      cdEl.parentElement!.classList.toggle('cooling', cd > 0);
    }

    const preview = el('preview', '#wave-preview');
    if (preview) {
      if (preparing) {
        preview.textContent = `Preparation — ${Math.ceil(prep)}s until Wave ${nextWave}`;
        preview.classList.remove('hidden');
      } else {
        preview.textContent = state.wavePreview || '';
        preview.classList.toggle('hidden', !state.wavePreview);
      }
    }
    const feed = el('feed', '#kill-feed');
    if (feed) {
      const lines = state.killFeed ?? [];
      const key = lines.join('\n');
      if (key !== this.lastKillFeedKey) {
        this.lastKillFeedKey = key;
        feed.innerHTML = lines.map((t) => `<div class="kill-line">${t}</div>`).join('');
      }
      feed.classList.toggle('hidden', lines.length === 0);
    }
    const prof = el('profiler', '#profiler-hud');
    if (prof) {
      if (state.profiler) {
        const p = state.profiler;
        prof.textContent = `FPS ${p.fps} · upd ${p.updateMs}ms · rnd ${p.renderMs}ms · E${p.enemies} T${p.towers} P${p.particles}`;
        prof.classList.remove('hidden');
      } else {
        prof.classList.add('hidden');
      }
    }

    const panel = el('towerPanel', '#tower-panel');
    const enemyPanel = el('enemyPanel', '#enemy-panel');
    if (state.selected) {
      panel.classList.remove('hidden');
      panel.dataset.towerType = state.selected.type;
      const def = TOWER_DEFS[state.selected.type];
      const s = state.selected.stats;
      const isWall = !!def.isWall;
      const branch = state.selected.branchLabel;
      const dps = isWall
        ? 0
        : def.isBeam
          ? s.beamDps
          : s.damage * s.fireRate * (1 + s.critChance * (s.critMultiplier - 1));
      const tgtLabel = TARGETING_LABELS[state.selected.targeting] ?? state.selected.targeting;
      el('tpName', '#tp-name').textContent = isWall
        ? def.name
        : branch
          ? `${def.name} · ${branch}`
          : `${def.name} · Tier ${state.selected.level}`;
      el('tpStats', '#tp-stats').textContent = isWall
        ? 'Blocks road · forces ground enemies to repath'
        : `DMG ${s.damage.toFixed(0)} · Rate ${s.fireRate.toFixed(2)} · Range ${s.range.toFixed(0)}` +
          (s.splashRadius ? ` · Splash ${s.splashRadius.toFixed(0)}` : '') +
          (s.beamDps ? ` · Beam ${s.beamDps.toFixed(0)}` : '') +
          ` · ${tgtLabel}` +
          (state.currentTargetName ? ` → ${state.currentTargetName}` : '');
      el('tpMeters', '#tp-meters').textContent = isWall
        ? ''
        : `Dealt ${Math.round(state.selected.damageDealt)} · Kills ${state.selected.kills} · ~DPS ${dps.toFixed(0)}`;

      const choices = state.selected.upgradeChoices();
      const choiceBox = el('tpChoices', '#tp-upgrade-choices');
      const up = el('tpUpgrade', '#tp-upgrade') as HTMLButtonElement;
      const upgradeKey = `${state.selected.id}:${state.selected.level}:${state.selected.path ?? ''}:${choices.map((c) => c.path + c.cost).join('|')}`;
      if (upgradeKey !== this.towerUpgradeKey) {
        this.towerUpgradeKey = upgradeKey;
        if (!isWall && choices.length > 1) {
          up.classList.add('hidden');
          choiceBox.classList.remove('hidden');
          choiceBox.innerHTML = choices
            .map(
              (c) =>
                `<button class="btn compact upgrade-choice" type="button" data-path="${c.path}" title="${c.tagline}">
                <strong>${c.name}</strong>
                <span>${c.tagline}</span>
                <em>${c.cost}g</em>
              </button>`,
            )
            .join('');
        } else {
          choiceBox.classList.add('hidden');
          choiceBox.innerHTML = '';
          up.classList.toggle('hidden', isWall);
        }
      }
      if (isWall || choices.length <= 1) {
        const cost = state.selected.upgradeCost();
        up.disabled = isWall || cost === null || !!state.metaBlocked;
        if (isWall) up.textContent = '—';
        else if (cost === null) up.textContent = 'Max Tier';
        else if (choices.length === 1) up.textContent = `${choices[0]!.name} (${cost}g)`;
        else up.textContent = `Upgrade (${cost}g)`;
      }

      const sellKey = state.keyHints?.sell ? ` [${formatKeyCode(state.keyHints.sell)}]` : '';
      el('tpSell', '#tp-sell').textContent = `Sell (${state.selected.sellValue()}g)${sellKey}`;
      const tgt = el('tpTarget', '#tp-target');
      const apply = el('tpApply', '#tp-apply-all');
      tgt.textContent = `Target: ${tgtLabel}`;
      tgt.classList.toggle('hidden', isWall);
      apply.classList.toggle('hidden', isWall);
    } else {
      panel.classList.add('hidden');
      delete panel.dataset.towerType;
      this.towerUpgradeKey = '';
    }

    if (enemyPanel) {
      if (state.selectedEnemy && !state.hero?.selected) {
        enemyPanel.classList.remove('hidden');
        const e = state.selectedEnemy;
        el('epName', '#ep-name').textContent = e.name;
        el('epStats', '#ep-stats').textContent =
          `HP ${Math.ceil(e.hp)}/${e.maxHp} · Spd ${e.speed.toFixed(0)} · Armor ${e.armor.toFixed(0)} · ${e.reward}g` +
          (e.roleHint ? ` · ${e.roleHint}` : '') +
          (e.targetedBy ? ` · Aimed by ${e.targetedBy}` : '') +
          (e.modifiers ? ` · ${e.modifiers}` : '');
      } else {
        enemyPanel.classList.add('hidden');
      }
    }

    const heroPanel = g('#hero-panel') as HTMLElement | null;
    const heroBtn = g('#btn-hero') as HTMLElement | null;
    if (heroPanel && state.hero) {
      const h = state.hero;
      heroBtn?.classList.toggle('active-toggle', h.selected);
      heroPanel.classList.toggle('hidden', !h.selected && h.alive);
      if (h.selected || !h.alive) {
        heroPanel.classList.remove('hidden');
        (g('#hp-portrait') as HTMLElement).textContent = h.portrait;
        (g('#hp-name') as HTMLElement).textContent = h.name;
        (g('#hp-title') as HTMLElement).textContent = h.alive
          ? h.title
          : `Fallen — respawn ${Math.ceil(h.respawnTimer)}s`;
        (g('#hp-stats') as HTMLElement).textContent =
          `DMG ${h.damage.toFixed(0)} · AS ${h.attackSpeed.toFixed(2)} · Range ${h.attackRange.toFixed(0)} · MS ${h.moveSpeed.toFixed(0)} · Armor ${h.armor.toFixed(1)} · Crit ${(h.critChance * 100).toFixed(0)}%`;
        (g('#hp-hp') as HTMLElement).textContent = `${Math.ceil(h.hp)}/${h.maxHp}`;
        (g('#hp-xp') as HTMLElement).textContent = `${h.xp}/${h.xpToNext}`;
        (g('#hp-bar') as HTMLElement).style.width = `${Math.max(0, Math.min(100, (h.hp / h.maxHp) * 100))}%`;
        (g('#hp-xp-bar') as HTMLElement).style.width =
          `${Math.max(0, Math.min(100, (h.xp / Math.max(1, h.xpToNext)) * 100))}%`;
        (g('#hp-level') as HTMLElement).textContent = `Level ${h.level}`;
        (g('#hp-talents') as HTMLElement).textContent = `Talents: ${h.talents}`;
        const ab = g('#hp-abilities') as HTMLElement;
        ab.innerHTML = h.abilities
          .map(
            (a) =>
              `<button class="btn compact hero-ability-btn ${a.ready ? '' : 'cooling'}" data-hero-ability="${a.id}" ${a.ready && h.alive ? '' : 'disabled'}>
                <strong>${a.name}</strong>
                <em>${a.ready ? 'Ready' : `${Math.ceil(a.cd)}s`}</em>
              </button>`,
          )
          .join('');
        const talentBox = g('#hp-talent-choices') as HTMLElement;
        if (h.talentOptions && h.talentOptions.length) {
          talentBox.classList.remove('hidden');
          talentBox.innerHTML =
            `<p class="muted">Choose a talent</p>` +
            h.talentOptions
              .map(
                (t) =>
                  `<button class="btn compact upgrade-choice" data-talent="${t.id}">
                    <strong>${t.name}</strong><span>${t.description}</span>
                  </button>`,
              )
              .join('');
        } else {
          talentBox.classList.add('hidden');
          talentBox.innerHTML = '';
        }
      }
    } else if (heroPanel) {
      heroPanel.classList.add('hidden');
    }

    const bossBar = g('#boss-bar') as HTMLElement | null;
    if (bossBar) {
      if (state.boss) {
        const b = state.boss;
        bossBar.classList.remove('hidden');
        bossBar.classList.toggle('intro', b.intro);
        (g('#boss-bar-name') as HTMLElement).textContent = b.name;
        (g('#boss-bar-phase') as HTMLElement).textContent = `Phase ${b.phase + 1}: ${b.phaseName}`;
        (g('#boss-bar-ability') as HTMLElement).textContent = b.abilityHint || b.title;
        const hpPct = Math.max(0, Math.min(100, (b.hp / Math.max(1, b.maxHp)) * 100));
        const shPct = Math.max(
          0,
          Math.min(100, (b.shield / Math.max(1, b.maxHp + b.maxShield)) * 100),
        );
        (g('#boss-bar-hp') as HTMLElement).style.width = `${hpPct}%`;
        (g('#boss-bar-shield') as HTMLElement).style.width = `${shPct}%`;
        (g('#boss-bar-hp-text') as HTMLElement).textContent =
          `${Math.ceil(b.hp)} / ${b.maxHp}` +
          (b.shield > 0 ? ` · 🛡 ${Math.ceil(b.shield)}` : '');
      } else {
        bossBar.classList.add('hidden');
      }
    }
  }

  clearBuildSelection(): void {
    this.selectedBuild = null;
    this.root.querySelectorAll('.tower-btn').forEach((x) => x.classList.remove('selected'));
  }

  /** Toasts queue instead of overwriting; consecutive duplicates are dropped. */
  showToast(msg: string): void {
    const el = this.root.querySelector('#toast') as HTMLElement | null;
    if (!el) return;
    if (this.toastActive) {
      if (el.textContent === msg || this.toastQueue[this.toastQueue.length - 1] === msg) return;
      this.toastQueue.push(msg);
      if (this.toastQueue.length > 4) this.toastQueue.shift();
      return;
    }
    this.presentToast(el, msg);
  }

  private presentToast(el: HTMLElement, msg: string): void {
    this.toastActive = true;
    el.textContent = msg;
    el.classList.remove('hidden');
    window.clearTimeout(this.toastTimer);
    // Drain faster while messages are waiting.
    const hold = this.toastQueue.length > 0 ? 1500 : 2200;
    this.toastTimer = window.setTimeout(() => {
      const next = this.toastQueue.shift();
      if (next !== undefined) {
        this.presentToast(el, next);
      } else {
        el.classList.add('hidden');
        this.toastActive = false;
      }
    }, hold);
  }

  /** In-game confirm — never use browser alert/confirm. */
  showConfirm(
    title: string,
    body: string,
    onOk: () => void,
    opts?: { okOnly?: boolean; okLabel?: string },
  ): void {
    const existing = this.root.querySelector('.confirm-overlay');
    existing?.remove();
    const overlay = this.el(`
      <div class="confirm-overlay" role="dialog" aria-modal="true">
        <div class="confirm-panel">
          <h3>${title}</h3>
          <p class="muted">${body}</p>
          <div class="report-actions">
            <button class="btn primary" data-act="ok">${opts?.okLabel ?? (opts?.okOnly ? 'OK' : 'Confirm')}</button>
            ${opts?.okOnly ? '' : '<button class="btn" data-act="cancel">Cancel</button>'}
          </div>
        </div>
      </div>`);
    this.root.appendChild(overlay);
    const close = () => {
      overlay.remove();
      window.removeEventListener('keydown', onKey);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        close();
        onOk();
      }
    };
    window.addEventListener('keydown', onKey);
    overlay.querySelector('[data-act="ok"]')!.addEventListener('click', () => {
      close();
      onOk();
    });
    overlay.querySelector('[data-act="cancel"]')?.addEventListener('click', close);
    (overlay.querySelector('[data-act="ok"]') as HTMLButtonElement).focus();
  }

  /** Achievement popups queue so simultaneous unlocks play one after another. */
  showAchievement(name: string, icon: string, rewardText?: string): void {
    this.achQueue.push({ name, icon, rewardText });
    if (this.achQueue.length > 6) this.achQueue.shift();
    if (!this.achActive) this.drainAchievement();
  }

  private drainAchievement(): void {
    const el = this.root.querySelector('#ach-popup') as HTMLElement | null;
    const next = this.achQueue.shift();
    if (!el || !next) {
      this.achActive = false;
      return;
    }
    this.achActive = true;
    el.innerHTML = `<span class="ach-icon">${next.icon || next.name.slice(0, 1)}</span><div><strong>Achievement</strong><p>${next.name}</p>${next.rewardText ? `<p class="muted">${next.rewardText}</p>` : ''}</div>`;
    el.classList.remove('hidden');
    window.clearTimeout(this.achTimer);
    this.achTimer = window.setTimeout(() => {
      el.classList.add('hidden');
      this.achActive = false;
      if (this.achQueue.length) this.drainAchievement();
    }, 3500);
  }

  getMinimapCanvas(): HTMLCanvasElement | null {
    return this.root.querySelector('#minimap');
  }

  private renderPause(): void {
    const p = this.lastPayload;
    const kb = this.save.data.settings.keyBindings;
    const panel = this.el(`
      <div class="menu-overlay dim">
        <div class="menu-panel pause-panel">
          <h2>${t(this.lang, 'pause')}</h2>
          <div class="pause-summary">
            <p><strong>${p.mapName ?? 'Mission'}</strong></p>
            <p class="muted">Wave ${p.wave ?? '—'} · ${p.gold ?? '—'}g · ${p.lives ?? '—'} lives · Score ${p.score ?? '—'}</p>
            <p class="muted">Seed <code>${p.seed ?? '—'}</code></p>
            <p class="hint">${formatKeyCode(kb.pause)} resume · ${formatKeyCode(kb.undo)} undo · ${formatKeyCode(kb.sell)} sell</p>
          </div>
          <button class="btn primary" data-act="resume">${t(this.lang, 'resume')}</button>
          <button class="btn" data-act="settings">${t(this.lang, 'settings')}</button>
          <button class="btn" data-act="encyclopedia">Encyclopedia</button>
          <button class="btn" data-act="restart">${t(this.lang, 'restart')}</button>
          <button class="btn danger" data-act="quit">Abandon Run</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);
    this.root.dataset.from = 'pause';
    panel.querySelector('[data-act="resume"]')!.addEventListener('click', () => this.cb.onResume());
    panel.querySelector('[data-act="settings"]')!.addEventListener('click', () => {
      this.root.dataset.from = 'pause';
      this.show('settings');
    });
    panel.querySelector('[data-act="encyclopedia"]')!.addEventListener('click', () => {
      this.show('encyclopedia', { from: 'pause' });
    });
    panel.querySelector('[data-act="restart"]')!.addEventListener('click', () => {
      this.showConfirm(
        'Restart this run?',
        'Progress since the last wave clear may be lost.',
        () => this.cb.onRestart(),
      );
    });
    panel.querySelector('[data-act="quit"]')!.addEventListener('click', () => {
      this.showConfirm(
        'Abandon the run?',
        'Return to the main menu. Unsaved mid-wave progress is lost.',
        () => this.cb.onQuit(),
      );
    });
  }

  private renderSettings(): void {
    const s = this.save.data.settings;
    const unlockedCos = new Set(this.save.data.unlockedCosmetics);
    const themeOpts = PATH_THEME_ORDER.map((id) => {
      const locked = !unlockedCos.has(id);
      return `<option value="${id}" ${s.pathTheme === id ? 'selected' : ''} ${locked ? 'disabled' : ''}>${PATH_THEMES[id].name}${locked ? ' (locked)' : ''}</option>`;
    }).join('');
    const skinOpts = TOWER_SKIN_ORDER.map((id) => {
      const locked = !unlockedCos.has(id);
      return `<option value="${id}" ${s.towerSkin === id ? 'selected' : ''} ${locked ? 'disabled' : ''}>${TOWER_SKINS[id].name}${locked ? ' (locked)' : ''}</option>`;
    }).join('');
    const artOpts = ART_STYLE_ORDER.map((id) => {
      const open = isArtStyleUnlocked(id, this.save.data.unlockedCosmetics);
      const style = ART_STYLES[id];
      const tag = open ? '' : ` — ${style.premiumHint ?? 'locked'}`;
      return `<option value="${id}" ${s.artStyle === id ? 'selected' : ''} ${open ? '' : 'disabled'}>${style.name}${tag}</option>`;
    }).join('');
    const bindRows = (Object.keys(KEYBIND_LABELS) as (keyof KeyBindings)[])
      .map(
        (k) =>
          `<button type="button" class="bind-row" data-bind="${k}"><span>${KEYBIND_LABELS[k]}</span><kbd id="bind-${k}">${formatKeyCode(s.keyBindings[k])}</kbd></button>`,
      )
      .join('');
    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel wide settings-scroll">
          <h2>${t(this.lang, 'settings')}</h2>
          <label>Master Volume <input type="range" id="s-master" min="0" max="1" step="0.01" value="${s.masterVolume}" /></label>
          <label>Music <input type="range" id="s-music" min="0" max="1" step="0.01" value="${s.musicVolume}" /></label>
          <label>SFX <input type="range" id="s-sfx" min="0" max="1" step="0.01" value="${s.sfxVolume}" /></label>
          <label><input type="checkbox" id="s-music-on" ${s.musicEnabled ? 'checked' : ''}/> Music Enabled</label>
          <label><input type="checkbox" id="s-sfx-on" ${s.sfxEnabled ? 'checked' : ''}/> SFX Enabled</label>
          <label>Graphics
            <select id="s-gfx">
              <option value="low" ${s.graphicsQuality === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${s.graphicsQuality === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${s.graphicsQuality === 'high' ? 'selected' : ''}>High</option>
            </select>
          </label>
          <label>UI Scale
            <select id="s-scale">
              <option value="0.9" ${s.uiScale === 0.9 ? 'selected' : ''}>90%</option>
              <option value="1" ${s.uiScale === 1 ? 'selected' : ''}>100%</option>
              <option value="1.15" ${s.uiScale === 1.15 ? 'selected' : ''}>115%</option>
              <option value="1.3" ${s.uiScale === 1.3 ? 'selected' : ''}>130%</option>
            </select>
          </label>
          <label>Art Style
            <select id="s-art">${artOpts}</select>
          </label>
          <p class="muted">Additional art styles unlock through campaign play.</p>
          <label>Path Theme <select id="s-theme">${themeOpts}</select></label>
          <label>Tower Skin <select id="s-skin">${skinOpts}</select></label>
          <label>Language
            <select id="s-lang">
              ${(['en', 'es', 'fr', 'de', 'pt'] as Lang[]).map((l) => `<option value="${l}" ${s.language === l ? 'selected' : ''}>${l.toUpperCase()}</option>`).join('')}
            </select>
          </label>
          <label><input type="checkbox" id="s-cb" ${s.colorblind ? 'checked' : ''}/> Colorblind-safe palette</label>
          <label><input type="checkbox" id="s-fps" ${s.showFps ? 'checked' : ''}/> Show FPS</label>
          <label><input type="checkbox" id="s-dmg" ${s.showDamageNumbers ? 'checked' : ''}/> Damage Numbers</label>
          <label><input type="checkbox" id="s-motion" ${s.reduceMotion ? 'checked' : ''}/> Reduce Motion</label>
          <label><input type="checkbox" id="s-killfeed" ${s.showKillFeed ? 'checked' : ''}/> Kill Feed</label>
          <label><input type="checkbox" id="s-waveprev" ${s.showWavePreview ? 'checked' : ''}/> Wave Preview</label>
          <label><input type="checkbox" id="s-confirm-sell" ${s.confirmSell ? 'checked' : ''}/> Confirm Sell</label>
          <label><input type="checkbox" id="s-confirm-up" ${s.confirmUpgrade ? 'checked' : ''}/> Confirm Upgrade</label>
          <label><input type="checkbox" id="s-profiler" ${s.showProfiler ? 'checked' : ''}/> Show Profiler</label>
          <label><input type="checkbox" id="s-autoq" ${s.autoQuality ? 'checked' : ''}/> Auto lower graphics if FPS drops</label>
          <label><input type="checkbox" id="s-blitz" ${s.enableBlitz ? 'checked' : ''}/> Enable Blitz (extreme wave resolve)</label>
          <p class="muted">Blitz is off by default for fair play.</p>
          <h3>Keybindings</h3>
          <p class="muted" id="rebind-hint">Click a row, then press a key.</p>
          <div class="bind-grid">${bindRows}</div>
          <h3>Save Data</h3>
          <div class="menu-actions-secondary">
            <button class="btn" data-act="export">Export Save JSON</button>
            <button class="btn" data-act="import">Import Save JSON</button>
            <input type="file" id="s-import-file" accept="application/json,.json" hidden />
          </div>
          <button class="btn" data-act="fs">Toggle Fullscreen</button>
          <button class="btn primary" data-act="back">Back</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);

    let bindings: KeyBindings = { ...s.keyBindings };

    const apply = () => {
      const next: SettingsData = {
        ...s,
        masterVolume: Number((panel.querySelector('#s-master') as HTMLInputElement).value),
        musicVolume: Number((panel.querySelector('#s-music') as HTMLInputElement).value),
        sfxVolume: Number((panel.querySelector('#s-sfx') as HTMLInputElement).value),
        musicEnabled: (panel.querySelector('#s-music-on') as HTMLInputElement).checked,
        sfxEnabled: (panel.querySelector('#s-sfx-on') as HTMLInputElement).checked,
        graphicsQuality: (panel.querySelector('#s-gfx') as HTMLSelectElement).value as SettingsData['graphicsQuality'],
        language: (panel.querySelector('#s-lang') as HTMLSelectElement).value as Lang,
        colorblind: (panel.querySelector('#s-cb') as HTMLInputElement).checked,
        showFps: (panel.querySelector('#s-fps') as HTMLInputElement).checked,
        showDamageNumbers: (panel.querySelector('#s-dmg') as HTMLInputElement).checked,
        reduceMotion: (panel.querySelector('#s-motion') as HTMLInputElement).checked,
        confirmSell: (panel.querySelector('#s-confirm-sell') as HTMLInputElement).checked,
        confirmUpgrade: (panel.querySelector('#s-confirm-up') as HTMLInputElement).checked,
        showKillFeed: (panel.querySelector('#s-killfeed') as HTMLInputElement).checked,
        showWavePreview: (panel.querySelector('#s-waveprev') as HTMLInputElement).checked,
        showProfiler: (panel.querySelector('#s-profiler') as HTMLInputElement).checked,
        autoQuality: (panel.querySelector('#s-autoq') as HTMLInputElement).checked,
        enableBlitz: (panel.querySelector('#s-blitz') as HTMLInputElement).checked,
        uiScale: Number((panel.querySelector('#s-scale') as HTMLSelectElement).value),
        pathTheme: (panel.querySelector('#s-theme') as HTMLSelectElement).value as PathThemeId,
        towerSkin: (panel.querySelector('#s-skin') as HTMLSelectElement).value as TowerSkinId,
        artStyle: (panel.querySelector('#s-art') as HTMLSelectElement).value as ArtStyleId,
        keyBindings: { ...bindings },
        targetingPresets: { ...s.targetingPresets },
      };
      this.lang = next.language;
      this.cb.onSettingsChange(next);
    };
    panel.querySelectorAll('input,select').forEach((el) => {
      if ((el as HTMLElement).id === 's-import-file') return;
      el.addEventListener('change', apply);
    });
    panel.querySelector('[data-act="export"]')!.addEventListener('click', () => this.cb.onExportSave());
    panel.querySelector('[data-act="import"]')!.addEventListener('click', () => {
      (panel.querySelector('#s-import-file') as HTMLInputElement).click();
    });
    panel.querySelector('#s-import-file')!.addEventListener('change', async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const result = this.cb.onImportSave(text);
      this.showConfirm(
        result.ok ? 'Save imported' : 'Import failed',
        result.ok ? 'Your save data was loaded.' : (result.error ?? 'Unknown error'),
        () => {
          if (result.ok) this.show('settings');
        },
        { okOnly: true },
      );
    });
    panel.querySelectorAll('[data-bind]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.bind as keyof KeyBindings;
        this.rebindingKey = key;
        (panel.querySelector('#rebind-hint') as HTMLElement).textContent = `Press a key for ${KEYBIND_LABELS[key]}…`;
        btn.classList.add('listening');
      });
    });
    const onKey = (e: KeyboardEvent) => {
      if (!this.rebindingKey) return;
      e.preventDefault();
      bindings = { ...bindings, [this.rebindingKey]: e.code };
      const kbd = panel.querySelector(`#bind-${this.rebindingKey}`) as HTMLElement | null;
      if (kbd) kbd.textContent = formatKeyCode(e.code);
      panel.querySelectorAll('.bind-row').forEach((b) => b.classList.remove('listening'));
      (panel.querySelector('#rebind-hint') as HTMLElement).textContent = 'Binding updated.';
      this.rebindingKey = null;
      apply();
    };
    window.addEventListener('keydown', onKey, { once: false });
    panel.querySelector('[data-act="fs"]')!.addEventListener('click', () => this.cb.onFullscreen());
    panel.querySelector('[data-act="back"]')!.addEventListener('click', () => {
      window.removeEventListener('keydown', onKey);
      apply();
      if (this.root.dataset.from === 'pause') this.show('pause');
      else this.show('main');
    });
  }

  private renderCredits(): void {
    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel">
          <h2>${t(this.lang, 'credits')}</h2>
          <p><strong>${GAME_TITLE}</strong></p>
          <p>Design, engineering &amp; systems — Bastion Interactive</p>
          <p>Procedural audio via Web Audio API</p>
          <p>Fonts: Cinzel &amp; Source Sans 3</p>
          <p>Built with TypeScript + Vite + Canvas</p>
          <p class="muted">No external game engine. Runs fully offline after load.</p>
          <button class="btn primary" data-act="back">Back</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);
    panel.querySelector('[data-act="back"]')!.addEventListener('click', () => this.show('main'));
  }

  private renderAchievements(): void {
    const unlocked = new Set(this.save.data.achievements);
    const items = ACHIEVEMENTS.map((a) => {
      const reward = formatAchievementReward(a.reward);
      return `<div class="ach-item ${unlocked.has(a.id) ? 'on' : 'off'}">
        <span class="ach-icon">${a.icon}</span>
        <div><strong>${a.name}</strong><p>${a.description}</p>${reward ? `<p class="reward">${reward}</p>` : ''}</div>
      </div>`;
    }).join('');
    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel wide">
          <h2>${t(this.lang, 'achievements')} (${unlocked.size}/${ACHIEVEMENTS.length})</h2>
          <p class="muted">Unlocks grant research points, cosmetics, and banked gold.</p>
          <div class="ach-grid">${items}</div>
          <button class="btn" data-act="profile">Profile</button>
          <button class="btn primary" data-act="back">Back</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);
    panel.querySelector('[data-act="profile"]')!.addEventListener('click', () => this.show('profile'));
    panel.querySelector('[data-act="back"]')!.addEventListener('click', () => this.show('main'));
  }

  private renderProfile(): void {
    const st = this.save.data.statistics;
    const avgSurv =
      st.runsFinished > 0 ? formatSurvivalTime(st.survivalTimeTotal / st.runsFinished) : '—';
    const favTowerId = favoriteKey(st.towerKills);
    const favTower = favTowerId
      ? (TOWER_DEFS[favTowerId as TowerType]?.name ?? favTowerId)
      : '—';
    const favHeroId = favoriteKey(st.heroRuns) ?? 'warden';
    const favHero = HERO_DEFS[favHeroId as HeroId]?.name ?? favHeroId;
    const factionRows = Object.keys(st.factionGames)
      .map((id) => {
        const games = st.factionGames[id] ?? 0;
        const wins = st.factionWins[id] ?? 0;
        const rate = games > 0 ? Math.round((wins / games) * 100) : 0;
        const name = FACTION_DEFS[id as keyof typeof FACTION_DEFS]?.name ?? id;
        return `<div><span>${name}</span><strong>${wins}/${games} (${rate}%)</strong></div>`;
      })
      .join('');
    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel wide profile-panel">
          <h2>Commander Profile</h2>
          <p class="muted">Your legend across sieges.</p>
          <div class="end-stats wide">
            <div><span>Games Played</span><strong>${st.gamesPlayed}</strong></div>
            <div><span>Highest Wave</span><strong>${st.highestWave}</strong></div>
            <div><span>Bosses Defeated</span><strong>${st.bossesDefeated}</strong></div>
            <div><span>Lifetime Kills</span><strong>${st.enemiesKilled}</strong></div>
            <div><span>Lifetime Gold</span><strong>${Math.floor(st.moneyEarned)}</strong></div>
            <div><span>Avg Survival</span><strong>${avgSurv}</strong></div>
            <div><span>Favorite Tower</span><strong>${favTower}</strong></div>
            <div><span>Favorite Hero</span><strong>${favHero}</strong></div>
            <div><span>Wins / Losses</span><strong>${st.wins} / ${st.losses}</strong></div>
          </div>
          <h3>Faction Win Rate</h3>
          <div class="end-stats">${factionRows || '<p class="muted">No faction data yet.</p>'}</div>
          <button class="btn primary" data-act="back">Back</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);
    panel.querySelector('[data-act="back"]')!.addEventListener('click', () => this.show('main'));
  }

  private renderEncyclopedia(payload?: Record<string, unknown>): void {
    const unlocked = new Set(this.save.data.unlockedTowers);
    const towers = TOWER_ORDER.map((id) => {
      const d = TOWER_DEFS[id];
      const open = unlocked.has(id);
      return `<div class="enc-card ${open ? '' : 'locked'}" id="enc-tower-${id}" data-enc="tower:${id}">
        <h4 style="color:${d.accent}">${d.name}${open ? '' : ' 🔒'}</h4>
        <p>${d.description}</p>
        <p class="muted">Cost ${d.cost} · Range ${d.base.range} · ${d.damageType}${d.isWall ? ' · Barricade' : ''}</p>
      </div>`;
    }).join('');
    const enemies = ENEMY_ROSTER.map((id) => ENEMY_DEFS[id])
      .map(
        (d) =>
          `<div class="enc-card" id="enc-enemy-${d.id}" data-enc="enemy:${d.id}">
            <h4 style="color:${d.accent}">${d.name}</h4>
            <p>${d.description}</p>
            <p class="muted">HP ${d.hp} · Spd ${d.speed} · ${d.reward}g · ${ROLE_LABELS[d.role] ?? d.role}${d.flying ? ' · Flying' : ''}${d.isBoss ? ' · Boss' : ''}</p>
          </div>`,
      )
      .join('');
    const fromPause = payload?.from === 'pause' || this.root.dataset.from === 'pause';
    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel wide">
          <h2>${t(this.lang, 'encyclopedia')}</h2>
          <p class="muted">Select a card for details. Open from a tower’s Info button to jump here mid-run.</p>
          <div id="enc-detail" class="enc-detail muted">Choose an entry.</div>
          <h3>Towers</h3>
          <div class="enc-grid">${towers}</div>
          <h3>Enemies</h3>
          <div class="enc-grid">${enemies}</div>
          <button class="btn primary" data-act="back">Back</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);
    const detail = panel.querySelector('#enc-detail') as HTMLElement;
    panel.querySelectorAll('[data-enc]').forEach((card) => {
      card.addEventListener('click', () => {
        panel.querySelectorAll('[data-enc]').forEach((c) => c.classList.remove('focused'));
        card.classList.add('focused');
        const key = (card as HTMLElement).dataset.enc!;
        if (key.startsWith('tower:')) {
          const id = key.slice(6) as TowerType;
          const d = TOWER_DEFS[id];
          detail.innerHTML = `<strong>${d.name}</strong> — ${d.description}<br/>Cost ${d.cost} · Max Lv ${d.maxLevel} · ${d.damageType} · Flying: ${d.canTargetFlying ? 'yes' : 'no'}`;
        } else if (key.startsWith('enemy:')) {
          const id = key.slice(6) as keyof typeof ENEMY_DEFS;
          const d = ENEMY_DEFS[id];
          detail.innerHTML = `<strong>${d.name}</strong> — ${d.description}<br/>HP ${d.hp} · Armor ${d.armor} · Speed ${d.speed} · Reward ${d.reward}g`;
        }
      });
    });
    const focus = String(payload?.focus ?? '');
    if (focus) {
      const el = panel.querySelector(`[data-enc="${focus}"]`) as HTMLElement | null;
      el?.click();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    panel.querySelector('[data-act="back"]')!.addEventListener('click', () => {
      if (fromPause) this.show('pause');
      else this.show('main');
    });
  }

  private renderEnd(victory: boolean, payload?: Record<string, unknown>): void {
    const kills = Number(payload?.kills ?? 0);
    const towersBuilt = Number(payload?.towersBuilt ?? 0);
    const towersSold = Number(payload?.towersSold ?? 0);
    const towersUpgraded = Number(payload?.towersUpgraded ?? 0);
    const goldEarned = Number(payload?.goldEarned ?? 0);
    const goldSpent = Number(payload?.goldSpent ?? 0);
    const damageDealt = Math.round(Number(payload?.damageDealt ?? 0));
    const bossesKilled = Number(payload?.bossesKilled ?? 0);
    const duration = Number(payload?.timeSurvived ?? payload?.durationSec ?? 0);
    const wave = Number(payload?.wave ?? 0);
    const mapName = String(payload?.mapName ?? '—');
    const research = String(payload?.researchSelected ?? 'None');
    const relics = String(payload?.relics ?? payload?.eliteRewards ?? 'None');
    const faction = String(payload?.faction ?? 'Unknown');
    const epithet = String(payload?.factionEpithet ?? '');
    const env = String(payload?.envModifiers ?? 'None');
    const mvp = String(payload?.mvpTower ?? '—');
    const danger = String(payload?.mostDangerous ?? '—');
    const rating = String(payload?.difficultyRating ?? '—');
    const seed = String(payload?.seed ?? '');
    const unlocks = String(payload?.unlocks ?? '—');
    const director = String(payload?.directorNote ?? '');
    const exportText = String(payload?.exportText ?? `Seed: ${seed}`);
    const title = String(payload?.reportTitle ?? (victory ? 'Bastion Holds' : 'Gate Broken'));
    const subtitle = String(
      payload?.reportSubtitle ?? (victory ? 'The Bastion stands.' : 'The gate has fallen.'),
    );
    const timeLabel = formatSurvivalTime(duration);
    const diffName = String(payload?.difficulty ?? '');

    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel wide run-report">
          <p class="brand-tag">${epithet || 'After-Action'}</p>
          <h2>${title}</h2>
          <p class="muted">${subtitle}</p>
          <div class="report-identity">
            <div><span>Faction</span><strong>${faction}</strong></div>
            <div><span>Environment</span><strong>${env}</strong></div>
            <div><span>Difficulty</span><strong>${diffName} · ${rating}</strong></div>
            <div><span>Map</span><strong>${mapName}</strong></div>
          </div>
          <div class="end-stats wide">
            <div><span>Time survived</span><strong>${timeLabel}</strong></div>
            <div><span>Wave</span><strong>${wave}</strong></div>
            <div><span>Kills</span><strong>${kills}</strong></div>
            <div><span>Gold earned</span><strong>${goldEarned}</strong></div>
            <div><span>Gold spent</span><strong>${goldSpent}</strong></div>
            <div><span>Towers built</span><strong>${towersBuilt}</strong></div>
            <div><span>Sold / Upgraded</span><strong>${towersSold} / ${towersUpgraded}</strong></div>
            <div><span>Bosses</span><strong>${bossesKilled}</strong></div>
            <div><span>Damage</span><strong>${damageDealt}</strong></div>
            <div><span>MVP Tower</span><strong>${mvp}</strong></div>
            <div><span>Most Dangerous</span><strong>${danger}</strong></div>
            <div><span>Score</span><strong>${Number(payload?.score ?? 0)}</strong></div>
          </div>
          <p class="end-notes">
            <strong>Relics:</strong> ${relics}<br/>
            <strong>Research:</strong> ${research}<br/>
            <strong>Unlocked:</strong> ${unlocks}<br/>
            ${director ? `<strong>Director:</strong> ${director}<br/>` : ''}
            <strong>Seed:</strong> <code class="seed-code">${seed}</code>
          </p>
          <div class="report-actions">
            <button class="btn primary" data-act="restart">${victory ? 'Play Again' : 'Retry'}</button>
            <button class="btn" data-act="copy">Copy Seed / Export</button>
            ${victory ? `<button class="btn" data-act="endless">${t(this.lang, 'endless')}</button>` : ''}
            <button class="btn" data-act="quit">Main Menu</button>
          </div>
        </div>
      </div>`);
    this.root.appendChild(panel);
    panel.querySelector('[data-act="endless"]')?.addEventListener('click', () => this.cb.onEnterEndless());
    panel.querySelector('[data-act="restart"]')!.addEventListener('click', () => this.cb.onRestart());
    panel.querySelector('[data-act="quit"]')!.addEventListener('click', () => this.cb.onQuit());
    panel.querySelector('[data-act="copy"]')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(exportText);
        this.showToast('Run export copied');
      } catch {
        this.showToast(seed || 'Copy failed');
      }
    });
  }

  /** Modal choice overlay on top of HUD (does not tear down chrome). */
  showChoiceOverlay(opts: {
    title: string;
    subtitle?: string;
    choices: { id: string; name: string; description: string; meta?: string; disabled?: boolean }[];
    onPick: (id: string) => void;
    dismissLabel?: string;
    onDismiss?: () => void;
  }): void {
    this.clearMetaOverlay();
    const cards = opts.choices
      .map(
        (c) => `
      <button class="choice-card" data-id="${c.id}" ${c.disabled ? 'disabled' : ''}>
        <strong>${c.name}</strong>
        <span>${c.description}</span>
        ${c.meta ? `<em>${c.meta}</em>` : ''}
      </button>`,
      )
      .join('');
    const overlay = this.el(`
      <div class="choice-overlay" role="dialog" aria-modal="true">
        <div class="choice-panel">
          <h2>${opts.title}</h2>
          ${opts.subtitle ? `<p class="muted">${opts.subtitle}</p>` : ''}
          <div class="choice-grid">${cards}</div>
          ${
            opts.dismissLabel
              ? `<button class="btn" data-act="dismiss">${opts.dismissLabel}</button>`
              : ''
          }
        </div>
      </div>`);
    this.root.appendChild(overlay);
    this.metaOverlay = overlay;
    overlay.querySelectorAll('.choice-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        opts.onPick(id);
      });
    });
    overlay.querySelector('[data-act="dismiss"]')?.addEventListener('click', () => {
      opts.onDismiss?.();
    });
  }

  clearMetaOverlay(): void {
    this.metaOverlay?.remove();
    this.metaOverlay = null;
  }

  hasMetaOverlay(): boolean {
    return !!this.metaOverlay;
  }

  /** Overlay used by photo mode after HUD is hidden. */
  showPhotoChrome(onDone: () => void): void {
    const bar = this.el(`
      <div class="photo-chrome">
        <p>Photo mode — UI hidden</p>
        <button class="btn primary" data-act="snap">Capture &amp; Exit</button>
        <button class="btn" data-act="cancel">Cancel</button>
      </div>
    `);
    this.root.appendChild(bar);
    bar.querySelector('[data-act="snap"]')!.addEventListener('click', () => {
      this.cb.onScreenshot();
      bar.remove();
      onDone();
    });
    bar.querySelector('[data-act="cancel"]')!.addEventListener('click', () => {
      bar.remove();
      onDone();
    });
  }
}

export function nextTargeting(mode: TargetingMode): TargetingMode {
  const i = TARGETING_MODES.indexOf(mode);
  return TARGETING_MODES[(i + 1) % TARGETING_MODES.length]!;
}

/** Player-facing labels for internal enemy role ids. */
const ROLE_LABELS: Record<EnemyRole, string> = {
  scout: 'Scout',
  raider: 'Raider',
  brute: 'Brute',
  shieldBearer: 'Shield Bearer',
  berserker: 'Berserker',
  healer: 'Healer',
  banner: 'Banner',
  siege: 'Siege',
  flying: 'Flier',
  stealth: 'Stealth',
  boss: 'Boss',
};

function favoriteKey(map: Record<string, number>): string | null {
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of Object.entries(map)) {
    if (v > n) {
      n = v;
      best = k;
    }
  }
  return best;
}

function missionBriefObjective(mission: {
  type: string;
  waveGoal: number;
  requireBossKill?: boolean;
}): string {
  switch (mission.type) {
    case 'bossHunt':
      return `Slay the boss by wave ${mission.waveGoal}`;
    case 'protectVillagers':
      return `Hold the village through ${mission.waveGoal} waves`;
    case 'escort':
      return `Escort the caravan (${mission.waveGoal} stages)`;
    case 'multiGate':
      return `Hold both fronts for ${mission.waveGoal} waves`;
    case 'nightDefense':
      return `Survive ${mission.waveGoal} waves under night`;
    case 'randomEvents':
      return `Endure chaos for ${mission.waveGoal} waves`;
    default:
      return `Survive ${mission.waveGoal} waves`;
  }
}
