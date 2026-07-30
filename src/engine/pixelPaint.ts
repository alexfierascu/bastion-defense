/**
 * Tiny pixel-buffer helpers for crisp procedural sprites.
 * Logical pixels are scaled up into atlas cells (no anti-alias blur).
 */

export class PixelBuf {
  readonly w: number;
  readonly h: number;
  private data: (string | null)[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Array(w * h).fill(null);
  }

  clear(): void {
    this.data.fill(null);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, color: string | null): void {
    if (!this.inBounds(x, y)) return;
    this.data[y * this.w + x] = color;
  }

  get(x: number, y: number): string | null {
    if (!this.inBounds(x, y)) return null;
    return this.data[y * this.w + x]!;
  }

  fillRect(x: number, y: number, w: number, h: number, color: string): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, color);
    }
  }

  /** Draw a filled ellipse (axis-aligned). */
  fillEllipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    const rx2 = rx * rx;
    const ry2 = ry * ry;
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / rx2 + (y * y) / ry2 <= 1.05) this.set(cx + x, cy + y, color);
      }
    }
  }

  /** 1px outline around any opaque pixel. */
  outline(color: string): void {
    const marks: { x: number; y: number }[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        const n =
          this.get(x - 1, y) ||
          this.get(x + 1, y) ||
          this.get(x, y - 1) ||
          this.get(x, y + 1);
        if (n) marks.push({ x, y });
      }
    }
    for (const m of marks) this.set(m.x, m.y, color);
  }

  /** Soft drop-shadow under opaque pixels. */
  dropShadow(color: string, dx = 1, dy = 1): void {
    const marks: { x: number; y: number }[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.get(x, y)) continue;
        const tx = x + dx;
        const ty = y + dy;
        if (this.inBounds(tx, ty) && !this.get(tx, ty)) marks.push({ x: tx, y: ty });
      }
    }
    for (const m of marks) {
      if (!this.get(m.x, m.y)) this.set(m.x, m.y, color);
    }
  }

  blit(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    scale: number,
  ): void {
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y);
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    }
  }
}

export function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Mix two hex colors (t = 0..1 toward b). */
export function mix(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 6 ? h : '888888', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}
