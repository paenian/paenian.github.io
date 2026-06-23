/**
 * HUD.js — DOM manipulation for power bar, generator bars, level display, and overlay screens.
 *
 * All DOM queries are guarded with null checks so this module works safely in
 * test environments (jsdom or no-DOM) without throwing.
 *
 * Requirements: 4.2, 4.3, 5.5, 8.1, 8.2, 8.3, 9.5
 */

export class HUD {
  constructor() {
    const q = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);

    this._ = {
      levelDisplay:        q('level-display'),
      powerBarFill:        q('power-bar-fill'),
      powerBarValue:       q('power-bar-value'),
      generatorBarContainer: q('generator-bar-container'),
      levelCompleteScreen: q('level-complete-screen'),
      gameOverScreen:      q('game-over-screen'),
      errorScreen:         q('error-screen'),
      errorMessage:        q('error-message'),
    };
  }

  /**
   * Update the power bar fill width and numeric label.
   * @param {number} current
   * @param {number} max
   */
  updatePowerBar(current, max) {
    const pct = ((current / max) * 100).toFixed(1) + '%';
    if (this._.powerBarFill)  this._.powerBarFill.style.width = pct;
    if (this._.powerBarValue) this._.powerBarValue.textContent = String(current);
  }

  /**
   * Sync generator HP bar rows to the live generators array.
   *
   * - Active (non-pendingRemoval) generators get a row created or updated.
   * - Rows for missing or pendingRemoval generators are removed.
   * - Labels are numbered G1, G2… by position in the array.
   *
   * @param {Array<{id: string, currentHp: number, maxHp: number, pendingRemoval?: boolean}>} generators
   */
  updateGeneratorBars(generators) {
    const container = this._.generatorBarContainer;
    if (!container) return;

    // Build a set of IDs that should exist (active generators only)
    const activeGenerators = generators.filter((g) => !g.pendingRemoval);
    const activeIds = new Set(activeGenerators.map((g) => g.id));

    // Remove rows for generators that are gone or pendingRemoval
    const existingRows = container.querySelectorAll('.gen-bar-row');
    existingRows.forEach((row) => {
      if (!activeIds.has(row.dataset.genId)) {
        container.removeChild(row);
      }
    });

    // Create or update a row for each active generator
    activeGenerators.forEach((gen, index) => {
      const label = `G${index + 1}`;
      const fillPct = ((gen.currentHp / gen.maxHp) * 100).toFixed(1) + '%';

      let row = container.querySelector(`.gen-bar-row[data-gen-id="${gen.id}"]`);

      if (!row) {
        // Create a new row
        row = document.createElement('div');
        row.className = 'gen-bar-row';
        row.dataset.genId = gen.id;

        const labelEl = document.createElement('span');
        labelEl.className = 'gen-bar-label';

        const track = document.createElement('div');
        track.className = 'gen-bar-track';

        const fill = document.createElement('div');
        fill.className = 'gen-bar-fill';
        fill.style.width = fillPct;

        track.appendChild(fill);
        row.appendChild(labelEl);
        row.appendChild(track);
        container.appendChild(row);
      }

      // Update label and fill (works for both newly created and existing rows)
      const labelEl = row.querySelector('.gen-bar-label');
      const fillEl  = row.querySelector('.gen-bar-fill');
      if (labelEl) labelEl.textContent = label;
      if (fillEl)  fillEl.style.width  = fillPct;
    });
  }

  /**
   * Update the level display text.
   * @param {number} levelIndex
   */
  updateLevel(levelIndex) {
    if (this._.levelDisplay) this._.levelDisplay.textContent = `LEVEL ${levelIndex}`;
  }

  /** Show the level-complete overlay. */
  showLevelComplete() {
    if (this._.levelCompleteScreen) this._.levelCompleteScreen.classList.remove('hidden');
  }

  /** Hide the level-complete overlay. */
  hideLevelComplete() {
    if (this._.levelCompleteScreen) this._.levelCompleteScreen.classList.add('hidden');
  }

  /** Show the game-over overlay. */
  showGameOver() {
    if (this._.gameOverScreen) this._.gameOverScreen.classList.remove('hidden');
  }

  /** Show the error overlay with a WebGL-not-supported message. */
  showWebGLError() {
    if (this._.errorMessage) this._.errorMessage.textContent = 'WebGL is not supported in your browser.';
    if (this._.errorScreen)  this._.errorScreen.classList.remove('hidden');
  }

  /**
   * Show the error overlay with a failed-asset-load message.
   * @param {string} assetName
   */
  showAssetError(assetName) {
    if (this._.errorMessage) this._.errorMessage.textContent = `Failed to load asset: ${assetName}`;
    if (this._.errorScreen)  this._.errorScreen.classList.remove('hidden');
  }

  /**
   * Sync all HUD elements from a GameState snapshot.
   * @param {{ powerLevel: number, maxPowerLevel: number, generators: Array, levelIndex: number }} gameState
   */
  sync(gameState) {
    this.updatePowerBar(gameState.powerLevel, gameState.maxPowerLevel);
    this.updateGeneratorBars(gameState.generators);
    this.updateLevel(gameState.levelIndex);
  }
}
