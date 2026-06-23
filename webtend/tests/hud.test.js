// @vitest-environment jsdom
/**
 * Feature: webtend-game
 * Tests for HUD.js: DOM update examples
 *
 * Requirements: 4.2, 4.3, 5.5, 8.1, 8.2, 8.3, 9.5
 *
 * Uses jsdom to exercise every HUD method against real DOM elements.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HUD } from '../HUD.js';

// ---------------------------------------------------------------------------
// Minimal DOM fixture — mirrors the elements expected by HUD.js
// ---------------------------------------------------------------------------

function buildDOM() {
  document.body.innerHTML = `
    <div id="level-display">LEVEL 1</div>
    <div id="power-bar-fill" style="width:5%"></div>
    <span id="power-bar-value">5</span>
    <div id="generator-bar-container"></div>
    <div id="level-complete-screen" class="overlay-screen hidden"></div>
    <div id="game-over-screen"      class="overlay-screen hidden"></div>
    <div id="error-screen"          class="overlay-screen hidden">
      <div id="error-message"></div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGenerator(id, currentHp, maxHp, pendingRemoval = false) {
  return { id, currentHp, maxHp, pendingRemoval };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HUD', () => {
  let hud;

  beforeEach(() => {
    buildDOM();
    hud = new HUD();
  });

  // -------------------------------------------------------------------------
  // updatePowerBar
  // -------------------------------------------------------------------------

  describe('updatePowerBar', () => {
    it('sets the fill width as a percentage string', () => {
      hud.updatePowerBar(50, 100);
      // jsdom normalises "50.0%" → "50%" for round values; test the numeric value
      expect(parseFloat(document.getElementById('power-bar-fill').style.width)).toBeCloseTo(50, 1);
    });

    it('sets the numeric value label', () => {
      hud.updatePowerBar(42, 100);
      expect(document.getElementById('power-bar-value').textContent).toBe('42');
    });

    it('rounds to one decimal place', () => {
      hud.updatePowerBar(1, 3);
      expect(parseFloat(document.getElementById('power-bar-fill').style.width)).toBeCloseTo(33.3, 1);
    });

    it('handles 0% correctly', () => {
      hud.updatePowerBar(0, 100);
      expect(parseFloat(document.getElementById('power-bar-fill').style.width)).toBeCloseTo(0, 1);
    });

    it('handles 100% correctly', () => {
      hud.updatePowerBar(100, 100);
      expect(parseFloat(document.getElementById('power-bar-fill').style.width)).toBeCloseTo(100, 1);
    });
  });

  // -------------------------------------------------------------------------
  // updateGeneratorBars
  // -------------------------------------------------------------------------

  describe('updateGeneratorBars', () => {
    it('creates a bar row for each active generator', () => {
      hud.updateGeneratorBars([
        makeGenerator('gen-1', 80, 100),
        makeGenerator('gen-2', 60, 100),
      ]);
      const rows = document.querySelectorAll('.gen-bar-row');
      expect(rows.length).toBe(2);
    });

    it('sets data-gen-id on each row', () => {
      hud.updateGeneratorBars([makeGenerator('gen-abc', 50, 100)]);
      const row = document.querySelector('.gen-bar-row');
      expect(row.dataset.genId).toBe('gen-abc');
    });

    it('labels rows G1, G2… by array position', () => {
      hud.updateGeneratorBars([
        makeGenerator('g1', 100, 100),
        makeGenerator('g2', 100, 100),
        makeGenerator('g3', 100, 100),
      ]);
      const labels = [...document.querySelectorAll('.gen-bar-label')].map((el) => el.textContent);
      expect(labels).toEqual(['G1', 'G2', 'G3']);
    });

    it('sets the fill width proportional to currentHp/maxHp', () => {
      hud.updateGeneratorBars([makeGenerator('g1', 25, 100)]);
      const fill = document.querySelector('.gen-bar-fill');
      expect(parseFloat(fill.style.width)).toBeCloseTo(25, 1);
    });

    it('removes rows for pendingRemoval generators', () => {
      // First add two generators
      hud.updateGeneratorBars([
        makeGenerator('g1', 100, 100),
        makeGenerator('g2', 100, 100),
      ]);
      expect(document.querySelectorAll('.gen-bar-row').length).toBe(2);

      // Mark g2 as pendingRemoval
      hud.updateGeneratorBars([
        makeGenerator('g1', 100, 100),
        makeGenerator('g2', 100, 100, true),
      ]);
      expect(document.querySelectorAll('.gen-bar-row').length).toBe(1);
      expect(document.querySelector('.gen-bar-row').dataset.genId).toBe('g1');
    });

    it('removes rows for generators no longer in the array', () => {
      hud.updateGeneratorBars([makeGenerator('g1', 100, 100), makeGenerator('g2', 100, 100)]);
      hud.updateGeneratorBars([makeGenerator('g1', 100, 100)]);
      expect(document.querySelectorAll('.gen-bar-row').length).toBe(1);
    });

    it('updates existing row fill without duplicating the row', () => {
      hud.updateGeneratorBars([makeGenerator('g1', 100, 100)]);
      hud.updateGeneratorBars([makeGenerator('g1', 50, 100)]);
      const rows = document.querySelectorAll('.gen-bar-row');
      expect(rows.length).toBe(1);
      expect(parseFloat(rows[0].querySelector('.gen-bar-fill').style.width)).toBeCloseTo(50, 1);
    });

    it('handles an empty generators array (removes all rows)', () => {
      hud.updateGeneratorBars([makeGenerator('g1', 100, 100)]);
      hud.updateGeneratorBars([]);
      expect(document.querySelectorAll('.gen-bar-row').length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // updateLevel
  // -------------------------------------------------------------------------

  describe('updateLevel', () => {
    it('sets the level display text', () => {
      hud.updateLevel(3);
      expect(document.getElementById('level-display').textContent).toBe('LEVEL 3');
    });
  });

  // -------------------------------------------------------------------------
  // Overlay screens
  // -------------------------------------------------------------------------

  describe('showLevelComplete / hideLevelComplete', () => {
    it('removes hidden class to show level complete', () => {
      hud.showLevelComplete();
      expect(document.getElementById('level-complete-screen').classList.contains('hidden')).toBe(false);
    });

    it('adds hidden class to hide level complete', () => {
      hud.showLevelComplete();
      hud.hideLevelComplete();
      expect(document.getElementById('level-complete-screen').classList.contains('hidden')).toBe(true);
    });
  });

  describe('showGameOver', () => {
    it('removes hidden class from game-over screen', () => {
      hud.showGameOver();
      expect(document.getElementById('game-over-screen').classList.contains('hidden')).toBe(false);
    });
  });

  describe('showWebGLError', () => {
    it('sets the error message text', () => {
      hud.showWebGLError();
      expect(document.getElementById('error-message').textContent).toBe(
        'WebGL is not supported in your browser.',
      );
    });

    it('shows the error screen', () => {
      hud.showWebGLError();
      expect(document.getElementById('error-screen').classList.contains('hidden')).toBe(false);
    });
  });

  describe('showAssetError', () => {
    it('sets the error message with the asset name', () => {
      hud.showAssetError('textures/wall.png');
      expect(document.getElementById('error-message').textContent).toBe(
        'Failed to load asset: textures/wall.png',
      );
    });

    it('shows the error screen', () => {
      hud.showAssetError('model.glb');
      expect(document.getElementById('error-screen').classList.contains('hidden')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // sync
  // -------------------------------------------------------------------------

  describe('sync', () => {
    it('updates power bar, generators, and level from gameState', () => {
      const gameState = {
        powerLevel: 75,
        maxPowerLevel: 100,
        levelIndex: 2,
        generators: [makeGenerator('g1', 80, 100)],
      };
      hud.sync(gameState);

      expect(parseFloat(document.getElementById('power-bar-fill').style.width)).toBeCloseTo(75, 1);
      expect(document.getElementById('power-bar-value').textContent).toBe('75');
      expect(document.getElementById('level-display').textContent).toBe('LEVEL 2');
      expect(document.querySelectorAll('.gen-bar-row').length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Null-safety (no document)
  // -------------------------------------------------------------------------

  describe('null-safety', () => {
    it('does not throw when DOM elements are missing', () => {
      // Create an HUD with no DOM by nulling all cached elements
      const bare = new HUD();
      Object.keys(bare._).forEach((k) => { bare._[k] = null; });

      expect(() => bare.updatePowerBar(10, 100)).not.toThrow();
      expect(() => bare.updateGeneratorBars([makeGenerator('g1', 50, 100)])).not.toThrow();
      expect(() => bare.updateLevel(1)).not.toThrow();
      expect(() => bare.showLevelComplete()).not.toThrow();
      expect(() => bare.hideLevelComplete()).not.toThrow();
      expect(() => bare.showGameOver()).not.toThrow();
      expect(() => bare.showWebGLError()).not.toThrow();
      expect(() => bare.showAssetError('x')).not.toThrow();
      expect(() => bare.sync({ powerLevel: 5, maxPowerLevel: 100, levelIndex: 1, generators: [] })).not.toThrow();
    });
  });
});
