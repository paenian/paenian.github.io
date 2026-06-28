// Bugfix: Power-Zero Game-Over Explosion
// Bug Condition Exploration Tests
//
// These tests encode the EXPECTED (correct) behavior after the fix.
// They are EXPECTED TO FAIL on the current unfixed code, confirming the bugs exist.
//
// Validates bugfix spec requirements: 1.1–1.4 (Current Behavior / Defect)
// Design Properties: 1 (Power Can Reach Zero), 2 (Explosion Cost),
//                    3 (Desperation Shot), 4 (Death Explosion Max Radius)

import { describe, test, expect } from 'vitest';
import { GameState, playerShip } from '../GameState.js';
import { Game } from '../Game.js';
import { ExplosionSystem } from '../ExplosionSystem.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal Game instance with mocked dependencies for testing.
 */
function createTestGame(overrides = {}) {
  const noopRenderer = {
    addEnemy() {},
    removeEnemy() {},
    updateCameraRig() {},
    buildScene() {},
    render() {},
    spawnExplosionEffect() {},
    spawnDeathExplosionEffect() {},
  };
  const noopHud = {
    sync() {},
    showWebGLError() {},
    showGameOver() {},
    showLevelComplete() {},
    hideLevelComplete() {},
    showAssetError() {},
  };
  const noopInput = {
    keys: { w: false, a: false, s: false, d: false },
    get mouseDelta() { return { dx: 0, dy: 0 }; },
  };
  const noopExplosion = {
    step() {},
    config: null,
    onPlayerClick() {},
  };
  const noopEnemyAI = {
    update() {},
    computeSpawnHeading() { return { x: 0, y: 0, z: -1 }; },
  };

  return new Game({
    renderer: overrides.renderer || noopRenderer,
    hud: overrides.hud || noopHud,
    inputHandler: overrides.input || noopInput,
    explosionSystem: overrides.explosionSystem || noopExplosion,
    enemyAI: overrides.enemyAI || noopEnemyAI,
  });
}

/**
 * Set up GameState for testing with a minimal config.
 */
function setupGameState(overrides = {}) {
  const defaultConfig = {
    baseExplosionRadius: 5,
    radiusMultiplier: 0.5,
    chainThreshold: 3,
    powerGainIncrement: 1,
    powerDecrement: 1,
    maxPower: 100,
    enemySpeed: 8,
    playerMaxSpeed: 100,
    playerAcceleration: 200,
    decelerationTime: 0.05,
    ...overrides,
  };

  GameState.phase = 'PLAYING';
  GameState.config = defaultConfig;
  GameState.powerLevel = overrides.powerLevel ?? 5;
  GameState.enemies = [];
  GameState.generators = [];
  GameState.walls = [];
  GameState.explosionQueue = [];
  GameState.chainDepth = 0;

  playerShip.position = { x: 0, y: 0, z: 0 };
  playerShip.velocity = { x: 0, y: 0, z: 0 };
  playerShip.radius = 1.0;

  return defaultConfig;
}

// ---------------------------------------------------------------------------
// Test 1: Power=1, enemy collision → assert power=0
// BUG: Game.js uses Math.max(1, powerLevel - decrement), so power can never reach 0
// Expected behavior (bugfix spec 2.1): Power floor is 0, not 1
// ---------------------------------------------------------------------------

describe('Bug Condition: Power can reach zero on enemy collision', () => {
  test('power=1, enemy collision with decrement=1 → power becomes 0', () => {
    setupGameState({ powerLevel: 1, powerDecrement: 1 });
    const game = createTestGame();

    // Place enemy overlapping with player (within combined radii)
    const enemy = {
      id: 'enemy-power-test',
      position: { x: 1.5, y: 0, z: 0 },
      velocity: { x: -5, y: 0, z: 0 },
      heading: { x: -1, y: 0, z: 0 },
      radius: 1.0,
      mesh: null,
      pendingRemoval: false,
    };
    GameState.enemies.push(enemy);

    // Run one update frame
    game.update(0.016);

    // EXPECTED: power reaches 0 (floor is 0, not 1)
    // ACTUAL (unfixed): Math.max(1, 1 - 1) = Math.max(1, 0) = 1 → stays at 1
    expect(GameState.powerLevel).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Power=5, click explosion → assert power=4
// BUG: ExplosionSystem.onPlayerClick does NOT deduct power — no cost exists
// Expected behavior (bugfix spec 2.3): Explosion click costs 1 power
// ---------------------------------------------------------------------------

describe('Bug Condition: Explosion click costs 1 power', () => {
  test('power=5, onPlayerClick → power becomes 4', () => {
    const config = setupGameState({ powerLevel: 5 });

    // Create a real ExplosionSystem to test its behavior
    const explosionSystem = new ExplosionSystem(GameState, config);

    // Fire an explosion
    explosionSystem.onPlayerClick({ x: 0, y: 0, z: 0 });

    // EXPECTED: power deducted by 1 (5 → 4)
    // ACTUAL (unfixed): onPlayerClick does not modify powerLevel — stays at 5
    expect(GameState.powerLevel).toBe(4);
  });

  test('explosion radius uses pre-deduction power level', () => {
    const config = setupGameState({ powerLevel: 5 });

    const explosionSystem = new ExplosionSystem(GameState, config);
    explosionSystem.onPlayerClick({ x: 0, y: 0, z: 0 });

    // EXPECTED: radius calculated with power=5 (before deduction)
    // radius = baseExplosionRadius + powerLevel * radiusMultiplier = 5 + 5*0.5 = 7.5
    const expectedRadius = config.baseExplosionRadius + 5 * config.radiusMultiplier;
    expect(GameState.explosionQueue[0].radius).toBe(expectedRadius);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Power=1, click, chain fails threshold → assert game-over triggers
// BUG: No desperation shot mechanic exists — power never changes on click,
//      and there's no post-chain game-over evaluation
// Expected behavior (bugfix spec 2.4, 2.6): Fire at power=1, power becomes 0,
//      if chain depth < threshold → game-over (DYING phase) triggers
// ---------------------------------------------------------------------------

describe('Bug Condition: Desperation shot failure triggers game-over', () => {
  test('power=1, click, chain below threshold → game-over/DYING phase', () => {
    const config = setupGameState({ powerLevel: 1, chainThreshold: 3 });

    const explosionSystem = new ExplosionSystem(GameState, config);

    // Fire explosion (should deduct power: 1 → 0)
    explosionSystem.onPlayerClick({ x: 0, y: 0, z: 0 });

    // Process all explosion steps until queue drains (no enemies to chain)
    let maxSteps = 100;
    while (GameState.explosionQueue.length > 0 && maxSteps-- > 0) {
      explosionSystem.step();
    }

    // Chain depth = 0, which is below chainThreshold (3)
    // EXPECTED: After chain resolves with power=0 and depth < threshold,
    //           the system signals game-over (sets desperationFailed flag or transitions phase)
    // ACTUAL (unfixed): Power never reaches 0 (no cost), no post-chain evaluation exists
    const gameOverTriggered =
      GameState.phase === 'DYING' ||
      GameState.phase === 'GAME_OVER' ||
      GameState.desperationFailed === true;

    expect(gameOverTriggered).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Game-over → assert death explosion enqueued with max radius
// BUG: Game.onGameOver() immediately sets phase='GAME_OVER' and shows HUD —
//      no death explosion, no DYING phase, no chain resolution before screen
// Expected behavior (bugfix spec 2.7, 2.8, 2.9): onGameOver spawns death
//      explosion with max radius, enters DYING phase, resolves chains, then shows screen
// ---------------------------------------------------------------------------

describe('Bug Condition: Game-over spawns death explosion with max radius', () => {
  test('onGameOver enters DYING phase (not immediate GAME_OVER)', () => {
    const config = setupGameState({ powerLevel: 0 });

    const game = createTestGame({
      explosionSystem: {
        step() {},
        config,
        onPlayerClick() {},
      },
    });

    game.onGameOver();

    // EXPECTED: phase transitions to 'DYING' first (death explosion plays)
    // ACTUAL (unfixed): phase immediately becomes 'GAME_OVER'
    expect(GameState.phase).toBe('DYING');
  });

  test('death explosion uses max-power radius formula', () => {
    const config = setupGameState({ powerLevel: 0 });

    const game = createTestGame();
    game.explosionSystem = {
      step() {},
      config,
      onPlayerClick() {},
    };

    game.onGameOver();

    // EXPECTED: death explosion enqueued with radius = baseExplosionRadius + maxPower * radiusMultiplier
    //           = 5 + 100 * 0.5 = 55
    const expectedMaxRadius = config.baseExplosionRadius + config.maxPower * config.radiusMultiplier;

    // Check the explosion queue for a death explosion
    const deathExplosion = GameState.explosionQueue.find(
      (job) => job.radius === expectedMaxRadius
    );

    // ACTUAL (unfixed): No explosion is enqueued; the queue is empty
    expect(deathExplosion).toBeDefined();
    expect(deathExplosion.radius).toBe(expectedMaxRadius);
  });
});
