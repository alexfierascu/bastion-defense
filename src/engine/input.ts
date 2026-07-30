/** Unified mouse / touch / keyboard input for gameplay + camera. */

export interface KeyBindings {
  panUp: string;
  panDown: string;
  panLeft: string;
  panRight: string;
  pause: string;
  speed1: string;
  speed2: string;
  speed4: string;
  sell: string;
  undo: string;
  cancel: string;
  ability1: string;
  ability2: string;
  ability3: string;
  ability4: string;
  ability5: string;
  ability6: string;
}

export const DEFAULT_KEYBINDINGS: KeyBindings = {
  panUp: 'KeyW',
  panDown: 'KeyS',
  panLeft: 'KeyA',
  panRight: 'KeyD',
  pause: 'Space',
  speed1: 'Digit1',
  speed2: 'Digit2',
  speed4: 'Digit3',
  sell: 'KeyX',
  undo: 'KeyZ',
  cancel: 'Escape',
  ability1: 'KeyQ',
  ability2: 'KeyE',
  ability3: 'KeyR',
  ability4: 'KeyT',
  ability5: 'KeyY',
  ability6: 'KeyU',
};

export const KEYBIND_LABELS: Record<keyof KeyBindings, string> = {
  panUp: 'Pan Up',
  panDown: 'Pan Down',
  panLeft: 'Pan Left',
  panRight: 'Pan Right',
  pause: 'Pause',
  speed1: 'Speed 1×',
  speed2: 'Speed 2×',
  speed4: 'Speed 4×',
  sell: 'Sell',
  undo: 'Undo',
  cancel: 'Cancel',
  ability1: 'Ability 1',
  ability2: 'Ability 2',
  ability3: 'Ability 3',
  ability4: 'Ability 4',
  ability5: 'Ability 5',
  ability6: 'Ability 6',
};

export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'Space';
  if (code === 'Escape') return 'Esc';
  return code;
}

export class InputManager {
  readonly keys = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  worldX = 0;
  worldY = 0;
  mouseDown = false;
  rightDown = false;
  justClicked = false;
  justRightClicked = false;
  justReleased = false;
  wheelDelta = 0;

  isPanning = false;
  panStartX = 0;
  panStartY = 0;
  midDown = false;
  panDeltaX = 0;
  panDeltaY = 0;
  private lastPanX = 0;
  private lastPanY = 0;

  // Touch
  touches: { id: number; x: number; y: number }[] = [];
  pinchDist = 0;
  private lastTouchMidX = 0;
  private lastTouchMidY = 0;
  /** One-finger drag pan when finger moves far from tap (mobile). */
  private touchPanArmed = false;
  private touchStartX = 0;
  private touchStartY = 0;

  bindings: KeyBindings = { ...DEFAULT_KEYBINDINGS };

  private canvas: HTMLCanvasElement;
  private toWorld: (sx: number, sy: number) => { x: number; y: number };

  constructor(
    canvas: HTMLCanvasElement,
    toWorld: (sx: number, sy: number) => { x: number; y: number },
  ) {
    this.canvas = canvas;
    this.toWorld = toWorld;
    this.bind();
  }

  setWorldMapper(fn: (sx: number, sy: number) => { x: number; y: number }): void {
    this.toWorld = fn;
  }

  setBindings(b: Partial<KeyBindings>): void {
    this.bindings = { ...this.bindings, ...b };
  }

  private bind(): void {
    const c = this.canvas;

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (
        e.code === 'Space' ||
        e.code.startsWith('Arrow') ||
        ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)
      ) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    c.addEventListener('mousemove', (e) => {
      this.updatePointer(e.clientX, e.clientY);
      if (this.isPanning) {
        this.panDeltaX += e.clientX - this.lastPanX;
        this.panDeltaY += e.clientY - this.lastPanY;
        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;
      }
    });
    c.addEventListener('mousedown', (e) => {
      this.updatePointer(e.clientX, e.clientY);
      if (e.button === 0) {
        this.mouseDown = true;
        this.justClicked = true;
      } else if (e.button === 1 || e.button === 2) {
        this.rightDown = e.button === 2;
        this.midDown = e.button === 1;
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;
        if (e.button === 2) this.justRightClicked = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        if (this.mouseDown) this.justReleased = true;
        this.mouseDown = false;
      }
      if (e.button === 1 || e.button === 2) {
        this.rightDown = false;
        this.midDown = false;
        this.isPanning = false;
      }
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.wheelDelta += -Math.sign(e.deltaY) * 0.08;
      },
      { passive: false },
    );

    c.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.syncTouches(e);
        if (e.touches.length === 1) {
          const t = e.touches[0]!;
          this.updatePointer(t.clientX, t.clientY);
          this.mouseDown = true;
          this.touchPanArmed = false;
          this.touchStartX = this.mouseX;
          this.touchStartY = this.mouseY;
          // Defer click until touchend if it was a tap (not a pan)
          this.justClicked = false;
        } else if (e.touches.length === 2) {
          this.pinchDist = this.touchDist(e);
          this.isPanning = true;
          this.touchPanArmed = false;
          const mid = this.touchMid(e);
          this.lastTouchMidX = mid.x;
          this.lastTouchMidY = mid.y;
        }
      },
      { passive: false },
    );
    c.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        this.syncTouches(e);
        if (e.touches.length === 2) {
          const mid = this.touchMid(e);
          this.panDeltaX += mid.x - this.lastTouchMidX;
          this.panDeltaY += mid.y - this.lastTouchMidY;
          this.lastTouchMidX = mid.x;
          this.lastTouchMidY = mid.y;
          this.isPanning = true;
        } else if (e.touches.length === 1) {
          const t = e.touches[0]!;
          this.updatePointer(t.clientX, t.clientY);
          const dx = this.mouseX - this.touchStartX;
          const dy = this.mouseY - this.touchStartY;
          if (!this.touchPanArmed && Math.hypot(dx, dy) > 14) {
            this.touchPanArmed = true;
            this.isPanning = true;
          }
          if (this.touchPanArmed) {
            this.panDeltaX += dx;
            this.panDeltaY += dy;
            this.touchStartX = this.mouseX;
            this.touchStartY = this.mouseY;
          }
        }
      },
      { passive: false },
    );
    c.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        this.syncTouches(e);
        if (e.touches.length === 0) {
          if (this.mouseDown && !this.touchPanArmed) {
            this.justClicked = true;
          }
          if (this.mouseDown) this.justReleased = true;
          this.mouseDown = false;
          this.isPanning = false;
          this.touchPanArmed = false;
        }
        if (e.touches.length < 2) this.pinchDist = 0;
      },
      { passive: false },
    );
  }

  private touchMid(e: TouchEvent): { x: number; y: number } {
    const a = e.touches[0]!;
    const b = e.touches[1]!;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = this.canvas.clientWidth || rect.width;
    const cssH = this.canvas.clientHeight || rect.height;
    const ax = ((a.clientX - rect.left) / Math.max(1, rect.width)) * cssW;
    const ay = ((a.clientY - rect.top) / Math.max(1, rect.height)) * cssH;
    const bx = ((b.clientX - rect.left) / Math.max(1, rect.width)) * cssW;
    const by = ((b.clientY - rect.top) / Math.max(1, rect.height)) * cssH;
    return { x: (ax + bx) / 2, y: (ay + by) / 2 };
  }

  private updatePointer(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    // CSS pixel space — must match camera.viewportW/H (not device pixels)
    const cssW = this.canvas.clientWidth || rect.width;
    const cssH = this.canvas.clientHeight || rect.height;
    this.mouseX = ((clientX - rect.left) / Math.max(1, rect.width)) * cssW;
    this.mouseY = ((clientY - rect.top) / Math.max(1, rect.height)) * cssH;
    const w = this.toWorld(this.mouseX, this.mouseY);
    this.worldX = w.x;
    this.worldY = w.y;
  }

  private syncTouches(e: TouchEvent): void {
    this.touches = [];
    const rect = this.canvas.getBoundingClientRect();
    const cssW = this.canvas.clientWidth || rect.width;
    const cssH = this.canvas.clientHeight || rect.height;
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]!;
      this.touches.push({
        id: t.identifier,
        x: ((t.clientX - rect.left) / Math.max(1, rect.width)) * cssW,
        y: ((t.clientY - rect.top) / Math.max(1, rect.height)) * cssH,
      });
    }
  }

  private touchDist(e: TouchEvent): number {
    if (e.touches.length < 2) return 0;
    const a = e.touches[0]!;
    const b = e.touches[1]!;
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Consume one-frame flags. Call at end of frame. */
  endFrame(): void {
    this.justClicked = false;
    this.justRightClicked = false;
    this.justReleased = false;
    this.wheelDelta = 0;
    this.panDeltaX = 0;
    this.panDeltaY = 0;
  }

  /** Screen-space pan delta from right/middle drag. */
  consumeDragPan(): { dx: number; dy: number } {
    const dx = this.panDeltaX;
    const dy = this.panDeltaY;
    this.panDeltaX = 0;
    this.panDeltaY = 0;
    return { dx, dy };
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  consumeKey(code: string): boolean {
    if (this.keys.has(code)) {
      this.keys.delete(code);
      return true;
    }
    return false;
  }

  getPanKeys(): { left: boolean; right: boolean; up: boolean; down: boolean } {
    return {
      left: this.isDown(this.bindings.panLeft) || this.isDown('ArrowLeft'),
      right: this.isDown(this.bindings.panRight) || this.isDown('ArrowRight'),
      up: this.isDown(this.bindings.panUp) || this.isDown('ArrowUp'),
      down: this.isDown(this.bindings.panDown) || this.isDown('ArrowDown'),
    };
  }

  /** Returns pan delta from middle/right drag or two-finger drag. */
  consumePanDelta(): { dx: number; dy: number } {
    if (!this.isPanning || this.touches.length === 2) {
      // two-finger handled separately
    }
    return { dx: 0, dy: 0 };
  }

  getPinchZoomDelta(): number {
    if (this.touches.length !== 2 || this.pinchDist <= 0) return 0;
    const a = this.touches[0]!;
    const b = this.touches[1]!;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const delta = (dist - this.pinchDist) * 0.002;
    this.pinchDist = dist;
    return delta;
  }
}
