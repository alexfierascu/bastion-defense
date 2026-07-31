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
import { DIFFICULTIES, DIFFICULTY_ORDER, DifficultyId } from '../config/difficulty';
import { ENEMY_DEFS } from '../config/enemies';
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

export type ScreenId =
  | 'main'
  | 'mapSelect'
  | 'brief'
  | 'hud'
  | 'pause'
  | 'settings'
  | 'credits'
  | 'achievements'
  | 'encyclopedia'
  | 'research'
  | 'gameOver'
  | 'victory'
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
  onContinue: () => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
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
  /** Enter the Bastion — cinematic start of the first handcrafted level. */
  onEnterBastion?: () => void;
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
  private selectedBuild: TowerType | null = null;
  private dockTab: 'build' | 'powers' = 'build';
  private selectedDifficulty: DifficultyId = 'normal';
  private selectedModifiers: ModifierId[] = [];
  private lastPayload: Record<string, unknown> = {};
  private rebindingKey: keyof KeyBindings | null = null;
  private titleScene: TitleSceneHandle | null = null;
  private fadeEl: HTMLElement | null = null;
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
    this.selectedDifficulty = save.data.lastDifficulty ?? 'normal';
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
      case 'mapSelect':
        this.renderMapSelect();
        break;
      case 'brief':
        this.renderBrief();
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
            if (this.cb.onEnterBastion) this.cb.onEnterBastion();
            else this.show('mapSelect');
            break;
          case 'continue':
          case 'slots':
            this.show('slots');
            break;
          case 'daily':
            this.pendingStart = {
              mapIndex: 0,
              daily: true,
              difficulty: 'hard',
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
          const req = s.requires?.map((r) => `${r.id}@${r.rank}`).join(', ') ?? '';
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
        alert('Reach wave 50 at least once to prestige.');
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

  private renderBrief(): void {
    const p = this.pendingStart;
    if (!p) {
      this.show('mapSelect');
      return;
    }
    const mapName =
      p.daily
        ? 'Daily Challenge'
        : p.mapIndex < 0
          ? 'Random Frontier'
          : (MAP_PRESETS[p.mapIndex]?.name ?? 'Unknown Map');
    const diff = DIFFICULTIES[p.difficulty];
    const mods =
      p.modifiers.length === 0
        ? 'None'
        : p.modifiers.map((m) => MODIFIER_DEFS[m]?.name ?? m).join(', ');
    const mapId = p.mapIndex >= 0 ? MAP_PRESETS[p.mapIndex]?.id : '';
    const lore = p.daily
      ? 'The swarm adapts every day. One seed. One chance. Your best score is recorded locally.'
      : p.mapIndex < 0
        ? 'Uncharted ground. Paths shift. Build zones are scarce. Trust your instincts.'
        : mapId === 'bastion-approach'
          ? 'The forest road leads home. Cross the bridge, hold the outer wall, and let nothing reach the Great Tree.'
          : `Briefing: Hold ${mapName}. The path is fixed — your kill zone is not. Spend wisely before the first horn.`;

    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel brief-panel">
          <p class="brand-tag">Mission Brief</p>
          <h2>${mapName}</h2>
          <p class="brief-lore">${lore}</p>
          <ul class="brief-stats">
            <li><span>Difficulty</span><strong>${diff.name}</strong></li>
            <li><span>Modifiers</span><strong>${mods}</strong></li>
            <li><span>Objective</span><strong>${p.daily ? 'Top the daily board' : 'Survive 50 waves'}</strong></li>
          </ul>
          <div class="brief-cinematic" aria-hidden="true">
            <div class="brief-scanline"></div>
          </div>
          <button class="btn primary" data-act="deploy">Deploy</button>
          <button class="btn" data-act="back">Back</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);
    panel.querySelector('[data-act="deploy"]')!.addEventListener('click', () => {
      const start = this.pendingStart!;
      this.pendingStart = null;
      this.cb.onNewGame(start.mapIndex, start.daily, start.difficulty, start.modifiers);
    });
    panel.querySelector('[data-act="back"]')!.addEventListener('click', () => {
      this.show(p.daily ? 'main' : 'mapSelect');
    });
  }

  private renderSlots(): void {
    const slots = this.save.data.saveSlots
      .map((s) => {
        const active = this.save.data.activeSlot === s.id ? 'active-toggle' : '';
        const snap = s.snapshot;
        const meta = snap
          ? `${snap.mapId} · W${snap.wave} · ${snap.gold}g · ${new Date(s.updatedAt || Date.now()).toLocaleDateString()}`
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
      .slice(-80)
      .map((a) => `<li>${formatReplayAction(a)}</li>`)
      .join('');
    const sum = replay.summary;
    const panel = this.el(`
      <div class="menu-overlay">
        <div class="menu-panel wide">
          <h2>Last Replay</h2>
          <p><strong>${replay.mapName}</strong> · ${replay.difficulty} · seed <code>${replay.seed}</code></p>
          <p class="muted">${sum ? `${sum.victory ? 'Victory' : 'Defeat'} · W${sum.wave} · ${sum.score} score · ${sum.kills} kills · ${Math.round(sum.durationSec)}s` : 'In-progress log'}</p>
          <ol class="replay-log">${lines}</ol>
          <button class="btn" data-act="copy">Copy Replay JSON</button>
          <button class="btn primary" data-act="back">Back</button>
        </div>
      </div>
    `);
    this.root.appendChild(panel);
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
        <header class="hud-chrome-top">
          <div class="hud-top-row">
            <div class="hud-stats hud-stats-primary">
              <div class="stat gold"><span class="stat-label">Gold</span><span class="stat-value" id="hud-gold">0</span></div>
              <div class="stat lives"><span class="stat-label" id="hud-lives-label">Gate</span><span class="stat-value" id="hud-lives">0</span></div>
              <div class="stat"><span class="stat-label">Wave</span><span class="stat-value" id="hud-wave">0/50</span></div>
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
              <button class="btn compact" id="btn-auto" title="Auto-start next waves">Auto</button>
              <button class="btn compact" id="btn-blitz" title="Resolve wave at extreme speed">Blitz</button>
              <button class="btn compact" id="btn-ranges" title="Show all tower ranges">Ranges</button>
              <button class="icon-btn" id="btn-pause" title="Pause [${formatKeyCode(kb.pause)}]" aria-label="Pause game">${formatKeyCode(kb.pause)}</button>
              <button class="icon-btn" id="btn-fs" title="Fullscreen" aria-label="Toggle fullscreen">[]</button>
              <button class="btn compact" id="btn-menu">${t(this.lang, 'quit')}</button>
            </div>
          </div>
          <div class="hud-meta-row">
            <div class="hud-stats hud-stats-meta">
              <div class="stat meta" id="hud-env"><span class="stat-label">Env</span><span class="stat-value" id="hud-env-val">—</span></div>
              <div class="stat meta" id="hud-diff-wrap"><span class="stat-label">Diff</span><span class="stat-value" id="hud-diff">—</span></div>
              <div class="stat meta" id="hud-fps-wrap"><span class="stat-label">FPS</span><span class="stat-value" id="hud-fps">60</span></div>
            </div>
            <p class="wave-preview" id="wave-preview" aria-live="polite"></p>
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
            <button class="btn compact" id="tp-target">Targeting</button>
            <button class="btn compact" id="tp-apply-all" title="Apply targeting to all of this type">Apply All</button>
            <button class="btn compact" id="tp-copy" title="Copy targeting">Copy</button>
            <button class="btn compact" id="tp-paste" title="Paste targeting">Paste</button>
            <button class="btn compact danger" id="tp-sell">Sell <span class="hotkey">${formatKeyCode(kb.sell)}</span></button>
          </div>
          <p class="tp-hint" id="tp-hint">${formatKeyCode(kb.undo)} undo · targeting cycles First → Last → Closest → Strongest</p>
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
    hud.querySelector('#btn-fs')!.addEventListener('click', () => this.cb.onFullscreen());
    hud.querySelector('#btn-menu')!.addEventListener('click', () => this.cb.onQuit());
    hud.querySelector('#btn-next-wave')!.addEventListener('click', () => this.cb.onStartNextWave());
    hud.querySelector('#btn-auto')!.addEventListener('click', () => this.cb.onToggleAutoWaves());
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
    hud.querySelector('#tp-sell')!.addEventListener('click', () => this.cb.onSell());
    hud.querySelector('#tp-target')!.addEventListener('click', () => this.cb.onCycleTargeting());
    hud.querySelector('#tp-apply-all')!.addEventListener('click', () => this.cb.onApplyTargetingToType());
    hud.querySelector('#tp-copy')!.addEventListener('click', () => this.cb.onCopyTargeting());
    hud.querySelector('#tp-paste')!.addEventListener('click', () => this.cb.onPasteTargeting());
  }

  updateHud(state: {
    gold: number;
    lives: number;
    maxLives?: number;
    gateLabel?: boolean;
    goldPulse?: boolean;
    gateFlash?: boolean;
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
  }): void {
    if (this.screen !== 'hud') return;
    const g = (id: string) => this.root.querySelector(id);
    const goldEl = g('#hud-gold') as HTMLElement;
    goldEl.textContent = `${Math.floor(state.gold)}`;
    goldEl.classList.toggle('pulse-gold', !!state.goldPulse);
    const goldStat = goldEl.closest('.stat');
    goldStat?.classList.toggle('pulse-gold', !!state.goldPulse);
    const livesLabel = g('#hud-lives-label') as HTMLElement | null;
    if (livesLabel) livesLabel.textContent = state.gateLabel ? 'Gate' : 'Lives';
    const maxL = state.maxLives ?? state.lives;
    const livesEl = g('#hud-lives') as HTMLElement;
    livesEl.textContent = state.gateLabel
      ? `${state.lives}/${maxL}`
      : `${state.lives}`;
    livesEl.classList.toggle('flash-gate', !!state.gateFlash);
    livesEl.closest('.stat')?.classList.toggle('flash-gate', !!state.gateFlash);
    const prep = state.prepareTimer ?? 0;
    const preparing = prep > 0 && state.waveReady && !state.waveActive;
    const nextWave = state.wave + 1;
    g('#hud-wave')!.textContent = state.endless
      ? `${state.wave} ∞`
      : preparing
        ? `Prep · ${nextWave}/${state.maxWaves}`
        : `${state.wave}/${state.maxWaves}`;
    g('#hud-enemies')!.textContent = `${state.enemies}`;
    g('#hud-score')!.textContent = `${state.score}`;
    g('#hud-env-val')!.textContent = state.envLabel || '—';
    const diffEl = g('#hud-diff') as HTMLElement;
    const diffWrap = g('#hud-diff-wrap') as HTMLElement;
    if (state.difficulty) {
      diffWrap.style.display = '';
      diffEl.textContent = state.difficulty;
    } else {
      diffWrap.style.display = 'none';
    }
    const fpsWrap = g('#hud-fps-wrap') as HTMLElement;
    fpsWrap.style.display = state.showFps ? '' : 'none';
    g('#hud-fps')!.textContent = `${state.fps}`;
    const nw = g('#btn-next-wave') as HTMLButtonElement;
    nw.disabled = !state.waveReady;
    if (preparing) {
      nw.textContent = `Start Wave (${Math.ceil(prep)}s)`;
    } else {
      nw.textContent = state.waveReady ? 'Start Wave' : 'Wave Active';
    }
    const autoBtn = g('#btn-auto') as HTMLElement;
    autoBtn.classList.toggle('active-toggle', state.autoWaves);
    autoBtn.textContent = state.autoWaves ? 'Auto ON' : 'Auto';
    const blitzBtn = g('#btn-blitz') as HTMLButtonElement;
    blitzBtn.classList.toggle('active-toggle', state.blitzActive);
    blitzBtn.disabled = !state.waveActive && !state.waveReady;
    blitzBtn.textContent = state.blitzActive ? 'Blitz…' : 'Blitz';
    const rangesBtn = g('#btn-ranges') as HTMLElement;
    rangesBtn.classList.toggle('active-toggle', state.showAllRanges);
    rangesBtn.textContent = state.showAllRanges ? 'Ranges ON' : 'Ranges';

    for (const id of ABILITY_ORDER) {
      const el = g(`[data-cd="${id}"]`) as HTMLElement | null;
      if (!el) continue;
      const cd = state.abilities.cooldowns[id]!;
      el.textContent = cd > 0 ? `${Math.ceil(cd)}` : '';
      el.parentElement!.classList.toggle('cooling', cd > 0);
    }

    const preview = g('#wave-preview') as HTMLElement | null;
    if (preview) {
      if (preparing) {
        preview.textContent = `Preparation — ${Math.ceil(prep)}s until Wave ${nextWave}`;
        preview.classList.remove('hidden');
      } else {
        preview.textContent = state.wavePreview || '';
        preview.classList.toggle('hidden', !state.wavePreview);
      }
    }
    const feed = g('#kill-feed') as HTMLElement | null;
    if (feed) {
      const lines = state.killFeed ?? [];
      feed.innerHTML = lines.map((t) => `<div class="kill-line">${t}</div>`).join('');
      feed.classList.toggle('hidden', lines.length === 0);
    }
    const prof = g('#profiler-hud') as HTMLElement | null;
    if (prof) {
      if (state.profiler) {
        const p = state.profiler;
        prof.textContent = `FPS ${p.fps} · upd ${p.updateMs}ms · rnd ${p.renderMs}ms · E${p.enemies} T${p.towers} P${p.particles}`;
        prof.classList.remove('hidden');
      } else {
        prof.classList.add('hidden');
      }
    }

    const panel = g('#tower-panel') as HTMLElement;
    const enemyPanel = g('#enemy-panel') as HTMLElement | null;
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
      (g('#tp-name') as HTMLElement).textContent = isWall
        ? def.name
        : branch
          ? `${def.name} · ${branch}`
          : `${def.name} · Tier ${state.selected.level}`;
      (g('#tp-stats') as HTMLElement).textContent = isWall
        ? 'Blocks road · forces ground enemies to repath'
        : `DMG ${s.damage.toFixed(0)} · Rate ${s.fireRate.toFixed(2)} · Range ${s.range.toFixed(0)}` +
          (s.splashRadius ? ` · Splash ${s.splashRadius.toFixed(0)}` : '') +
          (s.beamDps ? ` · Beam ${s.beamDps.toFixed(0)}` : '') +
          ` · ${tgtLabel}` +
          (state.currentTargetName ? ` → ${state.currentTargetName}` : '');
      const meters = g('#tp-meters') as HTMLElement;
      meters.textContent = isWall
        ? ''
        : `Dealt ${Math.round(state.selected.damageDealt)} · Kills ${state.selected.kills} · ~DPS ${dps.toFixed(0)}`;

      const choices = state.selected.upgradeChoices();
      const choiceBox = g('#tp-upgrade-choices') as HTMLElement;
      const up = g('#tp-upgrade') as HTMLButtonElement;
      if (!isWall && choices.length > 1) {
        up.classList.add('hidden');
        choiceBox.classList.remove('hidden');
        choiceBox.innerHTML = choices
          .map(
            (c) =>
              `<button class="btn compact upgrade-choice" data-path="${c.path}" title="${c.tagline}">
                <strong>${c.name}</strong>
                <span>${c.tagline}</span>
                <em>${c.cost}g</em>
              </button>`,
          )
          .join('');
        choiceBox.querySelectorAll('[data-path]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const path = (btn as HTMLElement).dataset.path as 'a' | 'b';
            this.cb.onUpgrade(path);
          });
        });
      } else {
        choiceBox.classList.add('hidden');
        choiceBox.innerHTML = '';
        up.classList.toggle('hidden', isWall);
        const cost = state.selected.upgradeCost();
        up.disabled = isWall || cost === null;
        if (isWall) up.textContent = '—';
        else if (cost === null) up.textContent = 'Max Tier';
        else if (choices.length === 1) up.textContent = `${choices[0]!.name} (${cost}g)`;
        else up.textContent = `Upgrade (${cost}g)`;
      }

      const sellKey = state.keyHints?.sell ? ` [${formatKeyCode(state.keyHints.sell)}]` : '';
      (g('#tp-sell') as HTMLElement).textContent = `Sell (${state.selected.sellValue()}g)${sellKey}`;
      const tgt = g('#tp-target') as HTMLElement;
      const apply = g('#tp-apply-all') as HTMLElement;
      const copy = g('#tp-copy') as HTMLElement;
      const paste = g('#tp-paste') as HTMLElement;
      tgt.textContent = tgtLabel;
      tgt.classList.toggle('hidden', isWall);
      apply.classList.toggle('hidden', isWall);
      copy.classList.toggle('hidden', isWall);
      paste.classList.toggle('hidden', isWall);
    } else {
      panel.classList.add('hidden');
      delete panel.dataset.towerType;
    }

    if (enemyPanel) {
      if (state.selectedEnemy) {
        enemyPanel.classList.remove('hidden');
        const e = state.selectedEnemy;
        (g('#ep-name') as HTMLElement).textContent = e.name;
        (g('#ep-stats') as HTMLElement).textContent =
          `HP ${Math.ceil(e.hp)}/${e.maxHp} · Spd ${e.speed.toFixed(0)} · Armor ${e.armor.toFixed(0)} · ${e.reward}g` +
          (e.targetedBy ? ` · Aimed by ${e.targetedBy}` : '');
      } else {
        enemyPanel.classList.add('hidden');
      }
    }
  }

  clearBuildSelection(): void {
    this.selectedBuild = null;
    this.root.querySelectorAll('.tower-btn').forEach((x) => x.classList.remove('selected'));
  }

  showToast(msg: string): void {
    const el = this.root.querySelector('#toast') as HTMLElement | null;
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.add('hidden'), 2200);
  }

  showAchievement(name: string, icon: string, rewardText?: string): void {
    const el = this.root.querySelector('#ach-popup') as HTMLElement | null;
    if (!el) return;
    el.innerHTML = `<span class="ach-icon">${icon || name.slice(0, 1)}</span><div><strong>Achievement</strong><p>${name}</p>${rewardText ? `<p class="muted">${rewardText}</p>` : ''}</div>`;
    el.classList.remove('hidden');
    window.setTimeout(() => el.classList.add('hidden'), 3500);
  }

  getMinimapCanvas(): HTMLCanvasElement | null {
    return this.root.querySelector('#minimap');
  }

  private renderPause(): void {
    const snap = this.save.data.continueGame;
    const kb = this.save.data.settings.keyBindings;
    const panel = this.el(`
      <div class="menu-overlay dim">
        <div class="menu-panel pause-panel">
          <h2>${t(this.lang, 'pause')}</h2>
          <div class="pause-summary">
            <p><strong>${snap?.mapId ?? 'Mission'}</strong></p>
            <p class="muted">Wave ${snap?.wave ?? '—'} · ${snap?.gold ?? '—'}g · ${snap?.lives ?? '—'} lives · Score ${snap?.score ?? '—'}</p>
            <p class="muted">Seed <code>${snap?.seed ?? '—'}</code></p>
            <p class="hint">${formatKeyCode(kb.pause)} resume · ${formatKeyCode(kb.undo)} undo · ${formatKeyCode(kb.sell)} sell</p>
          </div>
          <button class="btn primary" data-act="resume">${t(this.lang, 'resume')}</button>
          <button class="btn" data-act="settings">${t(this.lang, 'settings')}</button>
          <button class="btn" data-act="encyclopedia">Encyclopedia</button>
          <button class="btn" data-act="shot">Screenshot</button>
          <button class="btn" data-act="photo">Photo Mode</button>
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
    panel.querySelector('[data-act="shot"]')!.addEventListener('click', () => this.cb.onScreenshot());
    panel.querySelector('[data-act="photo"]')!.addEventListener('click', () => this.cb.onPhotoMode());
    panel.querySelector('[data-act="restart"]')!.addEventListener('click', () => {
      if (confirm('Restart this run? Progress since last wave clear may be lost.')) this.cb.onRestart();
    });
    panel.querySelector('[data-act="quit"]')!.addEventListener('click', () => {
      if (confirm('Abandon the run and return to the main menu?')) this.cb.onQuit();
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
          <p class="muted">Cozy Forest is free. Extra styles can unlock later (premium).</p>
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
      alert(result.ok ? 'Save imported.' : `Import failed: ${result.error}`);
      if (result.ok) this.show('settings');
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
          <p>Fonts: Orbitron &amp; Rajdhani</p>
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
          <h3>Statistics</h3>
          <pre class="stats-block">${JSON.stringify(this.save.data.statistics, null, 2)}</pre>
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
    const enemies = Object.values(ENEMY_DEFS)
      .map(
        (d) =>
          `<div class="enc-card" id="enc-enemy-${d.id}" data-enc="enemy:${d.id}">
            <h4 style="color:${d.accent}">${d.name}</h4>
            <p>${d.description}</p>
            <p class="muted">HP ${d.hp} · Spd ${d.speed} · ${d.reward}g${d.flying ? ' · Flying' : ''}${d.isBoss ? ' · Boss' : ''}</p>
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
    const goldEarned = Number(payload?.goldEarned ?? 0);
    const duration = Number(payload?.durationSec ?? 0);
    const mapName = String(payload?.mapName ?? '—');
    const verticalSlice = !!payload?.verticalSlice;
    const timeLabel = `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`;

    const panel = this.el(
      verticalSlice
        ? victory
          ? `
      <div class="menu-overlay">
        <div class="menu-panel wide">
          <h2>Victory</h2>
          <p class="muted">The Bastion holds. Three waves cleared.</p>
          <p class="muted">${mapName}</p>
          <div class="end-stats">
            <div><span>Time survived</span><strong>${timeLabel}</strong></div>
            <div><span>Towers built</span><strong>${towersBuilt}</strong></div>
            <div><span>Enemies defeated</span><strong>${kills}</strong></div>
            <div><span>Gold earned</span><strong>${goldEarned}</strong></div>
          </div>
          <button class="btn primary" data-act="restart">Play Again</button>
          <button class="btn" data-act="quit">Main Menu</button>
        </div>
      </div>`
          : `
      <div class="menu-overlay">
        <div class="menu-panel wide">
          <h2>Defeat</h2>
          <p class="muted">You Failed to Defend the Bastion</p>
          <p class="muted">${mapName}</p>
          <div class="end-stats">
            <div><span>Time survived</span><strong>${timeLabel}</strong></div>
            <div><span>Towers built</span><strong>${towersBuilt}</strong></div>
            <div><span>Enemies defeated</span><strong>${kills}</strong></div>
            <div><span>Gold earned</span><strong>${goldEarned}</strong></div>
          </div>
          <button class="btn primary" data-act="restart">Retry</button>
          <button class="btn" data-act="quit">Main Menu</button>
        </div>
      </div>`
        : `
      <div class="menu-overlay">
        <div class="menu-panel wide">
          <h2>${victory ? 'Victory' : 'Defeat'}</h2>
          <p class="muted">${victory ? 'The Bastion stands.' : 'The gate has fallen.'}</p>
          <p class="muted">${mapName}</p>
          <div class="end-stats">
            <div><span>Time survived</span><strong>${timeLabel}</strong></div>
            <div><span>Towers built</span><strong>${towersBuilt}</strong></div>
            <div><span>Enemies defeated</span><strong>${kills}</strong></div>
            <div><span>Gold earned</span><strong>${goldEarned}</strong></div>
          </div>
          <button class="btn primary" data-act="restart">${victory ? 'Play Again' : 'Retry'}</button>
          ${victory ? `<button class="btn" data-act="endless">${t(this.lang, 'endless')}</button>` : ''}
          <button class="btn" data-act="quit">Main Menu</button>
        </div>
      </div>`,
    );
    this.root.appendChild(panel);
    panel.querySelector('[data-act="endless"]')?.addEventListener('click', () => this.cb.onEnterEndless());
    panel.querySelector('[data-act="restart"]')!.addEventListener('click', () => this.cb.onRestart());
    panel.querySelector('[data-act="quit"]')!.addEventListener('click', () => this.cb.onQuit());
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
