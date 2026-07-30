/** Tiny typed pub/sub bus for decoupling systems. */

type Handler<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Handler<unknown>>>();

  on<T>(event: string, handler: Handler<T>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => set!.delete(handler as Handler<unknown>);
  }

  once<T>(event: string, handler: Handler<T>): () => void {
    const off = this.on<T>(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  emit<T>(event: string, payload: T): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      handler(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const GameEvents = {
  ENEMY_KILLED: 'enemy:killed',
  ENEMY_REACHED_BASE: 'enemy:reachedBase',
  TOWER_BUILT: 'tower:built',
  TOWER_SOLD: 'tower:sold',
  TOWER_UPGRADED: 'tower:upgraded',
  WAVE_STARTED: 'wave:started',
  WAVE_CLEARED: 'wave:cleared',
  GOLD_CHANGED: 'gold:changed',
  LIVES_CHANGED: 'lives:changed',
  GAME_OVER: 'game:over',
  VICTORY: 'game:victory',
  ABILITY_USED: 'ability:used',
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
  SETTINGS_CHANGED: 'settings:changed',
  SCREEN_SHAKE: 'fx:shake',
  FLOATING_TEXT: 'fx:floatingText',
} as const;
