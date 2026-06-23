// InputHandler.js — Keyboard state map and pointer-lock mouse delta.

export class InputHandler {
  constructor(canvas) {
    this._canvas = canvas ?? null;
    this._keys = new Set();
    this._dx = 0;
    this._dy = 0;
    this._locked = false;

    if (typeof window !== 'undefined') {
      this._onKeyDown = (e) => this._keys.add(e.key.toLowerCase());
      this._onKeyUp   = (e) => this._keys.delete(e.key.toLowerCase());
      this._onMouseMove = (e) => {
        if (this._locked) {
          this._dx += e.movementX;
          this._dy += e.movementY;
        }
      };
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup',   this._onKeyUp);
      window.addEventListener('mousemove', this._onMouseMove);
    }

    if (typeof document !== 'undefined') {
      this._onPointerLockChange = () => {
        this._locked = document.pointerLockElement === this._canvas;
      };
      document.addEventListener('pointerlockchange', this._onPointerLockChange);
    }
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

  /** Request pointer lock on the canvas. */
  requestPointerLock() {
    if (this._canvas !== null) {
      this._canvas.requestPointerLock();
    }
  }

  /** @returns {boolean} Whether the pointer is currently locked to the canvas. */
  isPointerLocked() {
    return this._locked;
  }

  /** Remove all event listeners. */
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown',    this._onKeyDown);
      window.removeEventListener('keyup',      this._onKeyUp);
      window.removeEventListener('mousemove',  this._onMouseMove);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    }
  }
}
