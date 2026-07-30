import { TitleAction } from '../types';

export interface TitleUIOptions {
  title: string;
  version: string;
  hasContinue: boolean;
  hasReplay: boolean;
  onAction: (action: TitleAction) => void;
  onGateHover?: (active: boolean) => void;
  onNavHover?: (active: boolean) => void;
}

const ICONS: Record<string, string> = {
  swords:
    '<path d="M6 18 L14 6 M10 18 L18 6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 19h4M15 5h4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  laurel:
    '<path d="M12 19 V8 M12 8 C8 8 6 11 6 14 M12 8 C16 8 18 11 18 14 M12 12 C9 12 8 14 8 16 M12 12 C15 12 16 14 16 16" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  fire: '<path d="M12 19c3.5 0 5-2.2 5-5 0-3-2-4.5-2.5-6.5-.2 1.5-1.2 2.5-2.5 3C12 7 11 5 12 3c-3 2-5.5 5-5.5 9 0 3.5 2 7 5.5 7z" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  wheel:
    '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><path d="M12 5v3M12 16v3M5 12h3M16 12h3" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  gear: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M12 5v2M12 17v2M5 12h2M17 12h2M7 7l1.4 1.4M15.6 15.6L17 17M17 7l-1.4 1.4M7 17l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  skull:
    '<path d="M12 4c-4 0-7 2.8-7 6.5 0 2.2 1.1 4 2.8 5.1V18h8.4v-2.4c1.7-1.1 2.8-2.9 2.8-5.1C19 6.8 16 4 12 4z" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  tree: '<path d="M12 20v-6 M8 10c0-3 2-6 4-7 2 1 4 4 4 7-1.5 0-2.5.5-4 2-1.5-1.5-2.5-2-4-2z" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  book: '<path d="M5 6.5c2-.8 4-.8 6 0v12c-2-.8-4-.8-6 0V6.5zm14 0c-2-.8-4-.8-6 0v12c2-.8 4-.8 6 0V6.5z" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  crest:
    '<path d="M12 3l6 2v5c0 4.5-2.5 7.5-6 9-3.5-1.5-6-4.5-6-9V5l6-2z" fill="none" stroke="currentColor" stroke-width="1.3"/>',
};

function icon(name: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
}

function nav(
  action: TitleAction,
  title: string,
  sub: string,
  ic: string,
  disabled = false,
): string {
  return `<button type="button" class="ts-nav" data-action="${action}" data-ambient="${action}" ${disabled ? 'disabled' : ''} aria-label="${title}">
    <span class="ts-nav-icon">${icon(ic)}</span>
    <span class="ts-nav-copy">
      <span class="ts-nav-title">${title}</span>
      <span class="ts-nav-sub">${sub}</span>
    </span>
  </button>`;
}

/** Carved-into-world UI (docs/09-UI.md). */
export function mountTitleUI(host: HTMLElement, opts: TitleUIOptions): () => void {
  host.innerHTML = `
    <div class="ts-shell">
      <header class="ts-brand">
        <h1>${opts.title}</h1>
        <div class="ts-brand-mark">
          ${icon('crest')}
          <p>The last living fortress. Nature and stone, one organism.</p>
        </div>
      </header>

      <div class="ts-main">
        <nav class="ts-col ts-col-left" aria-label="Bastion left">
          ${nav('replay', 'War Room', 'Replay & History', 'swords', !opts.hasReplay)}
          ${nav('achievements', 'Achievements', 'Honors of the Bastion', 'laurel')}
          ${nav('continue', 'Continue', 'Resume your defense', 'fire', !opts.hasContinue)}
          ${nav('credits', 'Credits', 'The hands that built', 'wheel')}
        </nav>

        <div class="ts-enter-wrap">
          <button type="button" class="ts-enter" data-action="new" data-ambient="gate" aria-label="Enter the Bastion">
            <span class="ts-enter-icon">${icon('tree')}</span>
            <span class="ts-enter-line main">Enter</span>
            <span class="ts-enter-line sub">The Bastion</span>
            <span class="ts-enter-hint">Approach the gate to begin</span>
          </button>
        </div>

        <nav class="ts-col ts-col-right" aria-label="Bastion right">
          ${nav('settings', 'Settings', 'Adjust your experience', 'gear')}
          ${nav('daily', 'Daily Challenge', 'A new siege awaits', 'skull')}
          ${nav('research', 'Research', 'Grow. Adapt. Survive.', 'tree')}
          ${nav('encyclopedia', 'Encyclopedia', 'Knowledge of the world', 'book')}
        </nav>
      </div>

      <footer class="ts-foot">
        <button type="button" data-action="slots">Save slots</button>
        <button type="button" data-action="copy-seed">Daily seed</button>
        <span class="ts-ver">v${opts.version}</span>
      </footer>
    </div>
  `;

  const onClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!btn || btn.hasAttribute('disabled')) return;
    const action = btn.dataset.action as TitleAction;
    opts.onAction(action);
  };
  host.addEventListener('click', onClick);

  const enter = host.querySelector('.ts-enter');
  const onEnter = () => opts.onGateHover?.(true);
  const onLeave = () => opts.onGateHover?.(false);
  enter?.addEventListener('pointerenter', onEnter);
  enter?.addEventListener('pointerleave', onLeave);

  const navBtns = host.querySelectorAll('.ts-nav, .ts-foot button');
  const onNavIn = () => opts.onNavHover?.(true);
  const onNavOut = () => opts.onNavHover?.(false);
  navBtns.forEach((el) => {
    el.addEventListener('pointerenter', onNavIn);
    el.addEventListener('pointerleave', onNavOut);
  });

  return () => {
    host.removeEventListener('click', onClick);
    enter?.removeEventListener('pointerenter', onEnter);
    enter?.removeEventListener('pointerleave', onLeave);
    navBtns.forEach((el) => {
      el.removeEventListener('pointerenter', onNavIn);
      el.removeEventListener('pointerleave', onNavOut);
    });
  };
}
