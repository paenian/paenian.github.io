// InputHandler.js — Keyboard state map and pointer-lock mouse delta.

export class InputHandler {
  constructor(_canvas) {
    this._keys = new Set();
    this._dx = 0;
    this._dy = 0;
  }

  /** @returns {{ w: boolean, a: boolean, s: boolean, d: boolean }} */
  get keys() {
    return {
      w: this._keys.has('w') || this._keys.has('W'),
      a: this._keys.has('a') || this._keys.has('A'),
      s: this._keys.has('s') || this._keys.has('S'),
      d: this._keys.has('d') || this._keys.has('D'),
    };
  }

  /** @returns {{ dx: number, dy: number }} Accumulated delta since last read; resets to {0,0}. */
  get mouseDelta() {
    const delta = { dx: this._dx, dy: this._dy };
    this._dx = 0;
    this._dy = 0;
    return delta;
  }

  requestPointerLock() {}
  isPointerLocked() { return false; }
}
