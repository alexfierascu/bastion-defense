/**
 * Generic object pool to avoid GC pressure during combat.
 * Objects must implement reset() and a free-state flag via active.
 */

export interface Poolable {
  active: boolean;
  reset(): void;
}

export class ObjectPool<T extends Poolable> {
  private readonly free: T[] = [];
  private readonly all: T[] = [];
  private readonly factory: () => T;
  readonly maxSize: number;

  constructor(factory: () => T, initial: number, maxSize: number) {
    this.factory = factory;
    this.maxSize = maxSize;
    for (let i = 0; i < initial; i++) {
      const obj = factory();
      obj.active = false;
      this.free.push(obj);
      this.all.push(obj);
    }
  }

  acquire(): T | null {
    let obj = this.free.pop();
    if (!obj) {
      if (this.all.length >= this.maxSize) return null;
      obj = this.factory();
      this.all.push(obj);
    }
    obj.active = true;
    return obj;
  }

  release(obj: T): void {
    if (!obj.active) return;
    obj.active = false;
    obj.reset();
    this.free.push(obj);
  }

  releaseAll(): void {
    for (const obj of this.all) {
      if (obj.active) {
        obj.active = false;
        obj.reset();
        this.free.push(obj);
      }
    }
  }

  getActive(): T[] {
    return this.all.filter((o) => o.active);
  }

  forEachActive(fn: (obj: T) => void): void {
    for (let i = 0; i < this.all.length; i++) {
      const obj = this.all[i]!;
      if (obj.active) fn(obj);
    }
  }

  get size(): number {
    return this.all.length;
  }

  get activeCount(): number {
    let n = 0;
    for (const o of this.all) if (o.active) n++;
    return n;
  }
}
