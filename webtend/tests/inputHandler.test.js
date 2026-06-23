// @vitest-environment jsdom
/**
 * Feature: webtend-game
 * Tests for InputHandler.js
 *
 * Requirements: 1.2, 1.3, 1.4, 1.5, 1.6
 *
 * Uses jsdom to exercise keyboard and mouse event handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputHandler } from '../InputHandler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fireKeyDown(key) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function fireKeyUp(key) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
}

function fireMouseMove(movementX, movementY) {
  const e = new MouseEvent('mousemove', { bubbles: true });
  // jsdom does not propagate movementX/Y from the init dict, so define them directly.
  Object.defineProperty(e, 'movementX', { value: movementX, configurable: true });
  Object.defineProperty(e, 'movementY', { value: movementY, configurable: true });
  window.dispatchEvent(e);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InputHandler', () => {
  let handler;
  let canvas;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    // Give canvas a stub requestPointerLock for jsdom
    canvas.requestPointerLock = () => {};
    handler = new InputHandler(canvas);
  });

  afterEach(() => {
    handler.destroy();
  });

  // -------------------------------------------------------------------------
  // Keyboard state
  // -------------------------------------------------------------------------

  describe('keyboard state (keys getter)', () => {
    it('reports w as pressed after keydown W', () => {
      fireKeyDown('w');
      expect(handler.keys.w).toBe(true);
    });

    it('reports w as pressed regardless of case', () => {
      fireKeyDown('W');
      expect(handler.keys.w).toBe(true);
    });

    it('reports a/s/d pressed independently', () => {
      fireKeyDown('a');
      fireKeyDown('s');
      fireKeyDown('d');
      expect(handler.keys.a).toBe(true);
      expect(handler.keys.s).toBe(true);
      expect(handler.keys.d).toBe(true);
    });

    it('clears key after keyup', () => {
      fireKeyDown('w');
      expect(handler.keys.w).toBe(true);
      fireKeyUp('w');
      expect(handler.keys.w).toBe(false);
    });

    it('keys default to false when nothing is pressed', () => {
      const k = handler.keys;
      expect(k.w).toBe(false);
      expect(k.a).toBe(false);
      expect(k.s).toBe(false);
      expect(k.d).toBe(false);
    });

    it('multiple simultaneous keys are tracked independently', () => {
      fireKeyDown('w');
      fireKeyDown('d');
      expect(handler.keys.w).toBe(true);
      expect(handler.keys.d).toBe(true);
      expect(handler.keys.a).toBe(false);
    });

    it('releasing one key does not clear others', () => {
      fireKeyDown('w');
      fireKeyDown('a');
      fireKeyUp('w');
      expect(handler.keys.w).toBe(false);
      expect(handler.keys.a).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Mouse delta accumulation
  // -------------------------------------------------------------------------

  describe('mouseDelta', () => {
    it('returns zero delta when no mouse movement', () => {
      const delta = handler.mouseDelta;
      expect(delta.dx).toBe(0);
      expect(delta.dy).toBe(0);
    });

    it('does NOT accumulate mousemove when pointer is not locked', () => {
      // handler._locked is false by default
      fireMouseMove(10, 5);
      const delta = handler.mouseDelta;
      expect(delta.dx).toBe(0);
      expect(delta.dy).toBe(0);
    });

    it('accumulates mousemove when pointer is locked', () => {
      // Manually set locked to simulate pointer lock being active
      handler._locked = true;
      fireMouseMove(3, 7);
      fireMouseMove(2, -1);
      const delta = handler.mouseDelta;
      expect(delta.dx).toBe(5);
      expect(delta.dy).toBe(6);
    });

    it('resets to {0, 0} after reading mouseDelta', () => {
      handler._locked = true;
      fireMouseMove(10, 10);
      handler.mouseDelta; // first read — consumes
      const second = handler.mouseDelta;
      expect(second.dx).toBe(0);
      expect(second.dy).toBe(0);
    });

    it('accumulates across multiple frames before being read', () => {
      handler._locked = true;
      fireMouseMove(1, 0);
      fireMouseMove(1, 0);
      fireMouseMove(1, 0);
      expect(handler.mouseDelta.dx).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Pointer lock
  // -------------------------------------------------------------------------

  describe('requestPointerLock', () => {
    it('calls canvas.requestPointerLock()', () => {
      let called = false;
      canvas.requestPointerLock = () => { called = true; };
      handler.requestPointerLock();
      expect(called).toBe(true);
    });

    it('does not throw when canvas is null', () => {
      const nullHandler = new InputHandler(null);
      expect(() => nullHandler.requestPointerLock()).not.toThrow();
      nullHandler.destroy();
    });
  });

  describe('isPointerLocked', () => {
    it('returns false initially', () => {
      expect(handler.isPointerLocked()).toBe(false);
    });

    it('reflects the internal _locked flag', () => {
      handler._locked = true;
      expect(handler.isPointerLocked()).toBe(true);
    });

    it('updates via pointerlockchange event when canvas is the lock element', () => {
      // jsdom does not implement pointer lock natively, so simulate it by
      // faking document.pointerLockElement and firing the event
      Object.defineProperty(document, 'pointerLockElement', {
        configurable: true,
        get: () => canvas,
      });
      document.dispatchEvent(new Event('pointerlockchange'));
      expect(handler.isPointerLocked()).toBe(true);

      // Now simulate unlock
      Object.defineProperty(document, 'pointerLockElement', {
        configurable: true,
        get: () => null,
      });
      document.dispatchEvent(new Event('pointerlockchange'));
      expect(handler.isPointerLocked()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // destroy() — listener cleanup
  // -------------------------------------------------------------------------

  describe('destroy', () => {
    it('stops tracking keydown events after destroy', () => {
      handler.destroy();
      fireKeyDown('w');
      expect(handler.keys.w).toBe(false);
    });

    it('stops tracking keyup events after destroy', () => {
      fireKeyDown('w');
      handler.destroy();
      // Key was added before destroy; after destroy keyup should be ignored
      fireKeyUp('w');
      // _keys still has 'w' because keyup listener is gone
      expect(handler._keys.has('w')).toBe(true);
    });

    it('stops accumulating mousemove after destroy', () => {
      handler._locked = true;
      handler.destroy();
      fireMouseMove(100, 100);
      expect(handler.mouseDelta.dx).toBe(0);
      expect(handler.mouseDelta.dy).toBe(0);
    });

    it('can be called multiple times without throwing', () => {
      expect(() => {
        handler.destroy();
        handler.destroy();
      }).not.toThrow();
    });
  });
});
