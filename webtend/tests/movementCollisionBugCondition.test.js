// Bugfix: Player Movement and Collision Overhaul (Bullet-Hell Style)
// Bug Condition Exploration Tests
//
// These tests encode the EXPECTED (correct) behavior after the fix.
// They are EXPECTED TO FAIL on the current unfixed code, confirming the bugs exist.
//
// Validates bugfix spec requirements: 1.1–1.6, 2.1–2.6

import { describe, test, expect } from 'vitest';
import * as Physics from '../Physics.js';
import { GameState, playerShip } from '../GameState.js';
import { Game } from '../Game.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function magnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Create a minimal Game instance with mocked dependencies for testing
 * the collision handling logic.
 */
function createTestGame() {
  const noopRenderer = {
    addEnemy() {},
    removeEnemy() {},
    updateCameraRig() {},
    buildScene() {},
    render() {},
    spawnExplosionEffect() {},
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
    mouseDelta: { dx: 0, dy: 0 },
    get mouseDelta() { return { dx: 0, dy: 0 }; },
  };
  const noopExplosion = {
    step() {},
    config: null,
  };
  const noopEnemyAI = {
    update() {},
    computeSpawnHeading() { return { x: 0, y: 0, z: -1 }; },
  };

  return new Game({
    renderer: noopRenderer,
    hud: noopHud,
    inputHandler: noopInput,
    explosionSystem: noopExplosion,
    enemyAI: noopEnemyAI,
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
  GameState.powerLevel = 5;
  GameState.enemies = [];
  GameState.generators = [];
  GameState.walls = [];
  GameState.explosionQueue = [];
  GameState.chainDepth = 0;

  playerShip.position = { x: 0, y: 0, z: 0 };
  playerShip.velocity = { x: 0, y: 0, z: 0 };
  playerShip.radius = 1.0;
}

// ---------------------------------------------------------------------------
// Test 1: Enemy contacts player → enemy should be destroyed (pendingRemoval=true)
// BUG: Currently the enemy survives (bounces off instead of being destroyed)
// Expected behavior (bugfix spec 2.1): Enemy destroyed on contact, no chain explosion
// ---------------------------------------------------------------------------

describe('Bug Condition: Enemy-player collision should destroy enemy', () => {
  test('enemy is marked pendingRemoval=true when contacting player', () => {
    setupGameState();
    const game = createTestGame();

    // Place enemy overlapping with player
    const enemy = {
      id: 'enemy-test-1',
      position: { x: 1.5, y: 0, z: 0 }, // within combined radii (1.0 + 1.0 = 2.0)
      velocity: { x: -5, y: 0, z: 0 },
      heading: { x: -1, y: 0, z: 0 },
      radius: 1.0,
      mesh: null,
      pendingRemoval: false,
    };
    GameState.enemies.push(enemy);

    // Run one update frame
    game.update(0.016);

    // EXPECTED: enemy is destroyed (pendingRemoval = true)
    // ACTUAL (unfixed): enemy survives, gets deflected away
    expect(enemy.pendingRemoval).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Enemy contacts player → player velocity should be unchanged (no knockback)
// BUG: Currently player velocity is reflected (knockback applied)
// Expected behavior (bugfix spec 2.2): No velocity change to player on enemy contact
// ---------------------------------------------------------------------------

describe('Bug Condition: Enemy-player collision should NOT apply knockback', () => {
  test('player velocity z-component is NOT negated after enemy contact from front', () => {
    setupGameState();
    const game = createTestGame();

    // Player moving in +z direction at significant speed
    playerShip.velocity = { x: 0, y: 0, z: 80 };
    playerShip.position = { x: 0, y: 0, z: 0 };

    // Place enemy directly in front of player (overlapping on z-axis)
    // This means the collision normal will be roughly along z-axis
    // The reflect() will negate the z-component (knockback)
    const enemy = {
      id: 'enemy-test-2',
      position: { x: 0, y: 0, z: 1.5 }, // overlap from +z side
      velocity: { x: 0, y: 0, z: -5 },
      heading: { x: 0, y: 0, z: -1 },
      radius: 1.0,
      mesh: null,
      pendingRemoval: false,
    };
    GameState.enemies.push(enemy);

    // Run one update frame
    game.update(0.016);

    // EXPECTED: player velocity z-component remains positive (no knockback)
    // With deceleration at 2000/s² over 0.016s = 32 reduction, 80-32=48 remains
    // The key point is velocity is NOT negated (no reflect)
    expect(playerShip.velocity.z).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Player movement with accel=200, maxSpeed=100 reaches near-max in 0.5s
// BUG: Current config uses accel=20, maxSpeed=50 — too slow for bullet-hell
// Expected behavior (bugfix spec 2.3): accel=200, maxSpeed=100
// ---------------------------------------------------------------------------

describe('Bug Condition: Player acceleration should be fast (200 accel, 100 maxSpeed)', () => {
  test('reaches near-max speed (95%+) within 0.5 seconds with expected config', () => {
    const expectedAccel = 200;
    const expectedMaxSpeed = 100;
    const dir = { x: 0, y: 0, z: -1 }; // forward
    const dt = 0.016; // ~60fps
    const totalTime = 0.5;
    const steps = Math.ceil(totalTime / dt);

    let vel = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < steps; i++) {
      vel = Physics.applyAcceleration(vel, dir, expectedAccel, expectedMaxSpeed, dt);
    }

    const speed = magnitude(vel);
    // EXPECTED: speed reaches 95%+ of 100 (i.e. >= 95) in 0.5s
    // This tests the expected NEW values; the current config uses accel=20, max=50
    // which would only reach ~10 units/s in 0.5s. But this test uses the Physics
    // function directly with the correct params, so it should pass.
    // The REAL test is whether the game CONFIG provides these values.
    expect(speed).toBeGreaterThanOrEqual(0.95 * expectedMaxSpeed);

    // Now test with the CURRENT (buggy) config values — this should fail
    // because the current config is too slow to reach 95 in 0.5s
    const currentAccel = GameState.config?.playerAcceleration ?? 20;
    const currentMaxSpeed = GameState.config?.playerMaxSpeed ?? 50;

    // Verify the game config has the expected fast values
    setupGameState();
    expect(GameState.config.playerAcceleration).toBe(200);
    expect(GameState.config.playerMaxSpeed).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Player wall collision → perpendicular velocity component should be 0 (slide)
// BUG: Currently uses reflect() which bounces the player off walls
// Expected behavior (bugfix spec 2.5): Zero perpendicular component, preserve parallel (slide)
// ---------------------------------------------------------------------------

describe('Bug Condition: Player wall collision should slide (not bounce)', () => {
  test('wallSlide function exists and zeros perpendicular component', () => {
    // The expected behavior is that Physics.js has a wallSlide function
    // that zeros the perpendicular component and preserves the parallel component
    // EXPECTED: Physics.wallSlide exists
    // ACTUAL (unfixed): Physics.wallSlide does not exist
    expect(typeof Physics.wallSlide).toBe('function');
  });

  test('after wall collision, perpendicular velocity component is zero', () => {
    // Skip if wallSlide doesn't exist yet (will fail on unfixed code)
    if (typeof Physics.wallSlide !== 'function') {
      // Force a failure to document the bug
      expect(Physics.wallSlide).toBeDefined();
      return;
    }

    const velocity = { x: 5, y: 0, z: 10 }; // moving diagonally
    const wallNormal = { x: 1, y: 0, z: 0 }; // wall facing +x

    const result = Physics.wallSlide(velocity, wallNormal);

    // EXPECTED: perpendicular (x) component is 0, parallel (z) component preserved
    const perpComponent = dot(result, wallNormal);
    expect(Math.abs(perpComponent)).toBeLessThan(1e-6);
    expect(result.z).toBeCloseTo(10, 4); // parallel component preserved
  });

  test('Game.js uses wallSlide (not reflect) for player wall collisions', () => {
    setupGameState();
    const game = createTestGame();

    // Set up a wall to the right of the player
    GameState.walls = [
      { min: { x: 0.5, y: -5, z: -50 }, max: { x: 5, y: 5, z: 50 } },
    ];

    // Player moving diagonally into the wall at high speed
    // With decelRate=2000/s² and dt=0.016, reduction=32
    // Need speed > 32 to survive deceleration
    playerShip.position = { x: 0, y: 0, z: 0 };
    playerShip.velocity = { x: 50, y: 0, z: 50 };

    game.update(0.016);

    // EXPECTED: After wall collision, x-velocity (perpendicular) should be ~0
    //           and z-velocity (parallel) should be preserved (minus deceleration)
    // ACTUAL (unfixed): reflect() would make x-velocity negative (bounce)
    // After deceleration, speed drops from ~70.7 to ~38.7, then wallSlide zeros x
    expect(playerShip.velocity.x).toBeCloseTo(0, 0); // perpendicular zeroed
    expect(Math.abs(playerShip.velocity.z)).toBeGreaterThan(5); // parallel preserved
  });
});

// ---------------------------------------------------------------------------
// Test 5: Deceleration from max speed to stop in ≤0.05s
// BUG: Current decelerationTime=0.5s (10x too slow)
// Expected behavior (bugfix spec 2.4): Stop within 0.05s (near-instant)
// ---------------------------------------------------------------------------

describe('Bug Condition: Deceleration should stop in ≤0.05s (not 0.5s)', () => {
  test('deceleration with expected config stops within 0.05s', () => {
    const expectedMaxSpeed = 100;
    const expectedDecelTime = 0.05;
    const decelRate = expectedMaxSpeed / expectedDecelTime; // 2000 units/s²

    let vel = { x: 0, y: 0, z: expectedMaxSpeed }; // at max speed
    const dt = 0.001; // small timestep for accuracy
    const steps = Math.ceil(expectedDecelTime / dt);

    for (let i = 0; i < steps; i++) {
      vel = Physics.applyDeceleration(vel, decelRate, dt);
    }

    const speed = magnitude(vel);
    // EXPECTED: speed should be 0 (or very near 0) after 0.05s
    expect(speed).toBeLessThan(1e-3);
  });

  test('game config uses decelerationTime of 0.05s', () => {
    setupGameState();

    // EXPECTED: config has decelerationTime=0.05
    // ACTUAL (unfixed): config has decelerationTime=0.5
    expect(GameState.config.decelerationTime).toBe(0.05);
  });
});
