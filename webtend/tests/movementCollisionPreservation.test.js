// Preservation tests for movement/collision bugfix.
// These verify CORRECT existing behavior that must NOT be broken by the fix.
// Requirements: 3.1–3.7 from bugfix spec

import { describe, test, expect } from 'vitest';
import { ExplosionSystem, collectHits } from '../ExplosionSystem.js';
import { EnemyAI } from '../EnemyAI.js';

// ---------------------------------------------------------------------------
// Helper: create a minimal GameState-like object for ExplosionSystem tests
// ---------------------------------------------------------------------------
function makeGameState(overrides = {}) {
  return {
    powerLevel: 1,
    chainDepth: 0,
    explosionQueue: [],
    enemies: [],
    generators: [],
    ...overrides,
  };
}

function makeConfig(overrides = {}) {
  return {
    baseExplosionRadius: 5,
    radiusMultiplier: 0.5,
    chainThreshold: 3,
    powerGainIncrement: 1,
    maxPower: 100,
    enemySpeed: 10,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Explosion chain reactions: enemies within radius are destroyed and
//    chain explosions enqueued at their positions.
//    Validates: Bugfix requirement 3.1
// ---------------------------------------------------------------------------
describe('Preservation: Explosion chain reactions', () => {
  test('processExplosion destroys enemies within radius and enqueues chains', () => {
    const enemy1 = {
      position: { x: 2, y: 0, z: 0 },
      radius: 1,
      pendingRemoval: false,
    };
    const enemy2 = {
      position: { x: 3, y: 0, z: 0 },
      radius: 1,
      pendingRemoval: false,
    };
    const enemyFar = {
      position: { x: 100, y: 0, z: 0 },
      radius: 1,
      pendingRemoval: false,
    };

    const gameState = makeGameState({ enemies: [enemy1, enemy2, enemyFar] });
    const config = makeConfig({ baseExplosionRadius: 5, radiusMultiplier: 0.5 });
    const system = new ExplosionSystem(gameState, config);

    // Explosion at origin with radius 5 — enemy1 (dist=2) and enemy2 (dist=3)
    // are within (5 + 1 = 6), enemyFar (dist=100) is not.
    system.processExplosion({ x: 0, y: 0, z: 0 }, 5);

    // Enemies within radius are flagged for removal
    expect(enemy1.pendingRemoval).toBe(true);
    expect(enemy2.pendingRemoval).toBe(true);
    expect(enemyFar.pendingRemoval).toBe(false);

    // Chain explosions enqueued at destroyed enemy positions
    expect(gameState.explosionQueue).toHaveLength(2);
    expect(gameState.explosionQueue[0].center).toEqual({ x: 2, y: 0, z: 0 });
    expect(gameState.explosionQueue[0].isChain).toBe(true);
    expect(gameState.explosionQueue[1].center).toEqual({ x: 3, y: 0, z: 0 });
    expect(gameState.explosionQueue[1].isChain).toBe(true);
  });

  test('chainDepth increments by number of enemies destroyed', () => {
    const enemies = [
      { position: { x: 1, y: 0, z: 0 }, radius: 1, pendingRemoval: false },
      { position: { x: 2, y: 0, z: 0 }, radius: 1, pendingRemoval: false },
      { position: { x: 3, y: 0, z: 0 }, radius: 1, pendingRemoval: false },
    ];

    const gameState = makeGameState({ enemies, chainDepth: 0 });
    const config = makeConfig();
    const system = new ExplosionSystem(gameState, config);

    system.processExplosion({ x: 0, y: 0, z: 0 }, 10);

    // All 3 enemies hit — chainDepth should increment by 3
    expect(gameState.chainDepth).toBe(3);
  });

  test('collectHits correctly identifies enemies and generators within radius', () => {
    const center = { x: 0, y: 0, z: 0 };
    const radius = 5;

    const enemyIn = { position: { x: 3, y: 0, z: 0 }, radius: 1 };
    const enemyOut = { position: { x: 20, y: 0, z: 0 }, radius: 1 };
    const genIn = { position: { x: 0, y: 4, z: 0 }, radius: 2 };
    const genOut = { position: { x: 0, y: 50, z: 0 }, radius: 1 };

    const { hitEnemies, hitGenerators } = collectHits(
      center, radius, [enemyIn, enemyOut], [genIn, genOut]
    );

    expect(hitEnemies).toHaveLength(1);
    expect(hitEnemies[0]).toBe(enemyIn);
    expect(hitGenerators).toHaveLength(1);
    expect(hitGenerators[0]).toBe(genIn);
  });
});

// ---------------------------------------------------------------------------
// 2. Enemy wall bounce: heading reflection preserves speed magnitude.
//    Validates: Bugfix requirement 3.2
// ---------------------------------------------------------------------------
describe('Preservation: Enemy wall bounce (heading reflection)', () => {
  test('reflect produces correct reflected velocity', () => {
    const ai = new EnemyAI({ enemySpeed: 10 });

    // Velocity going into a wall with normal pointing in +x
    const velocity = { x: -5, y: 3, z: 0 };
    const normal = { x: 1, y: 0, z: 0 };

    const reflected = ai.reflect(velocity, normal);

    // v' = v - 2(v·n)n = {-5,3,0} - 2*(-5)*{1,0,0} = {5,3,0}
    expect(reflected.x).toBeCloseTo(5);
    expect(reflected.y).toBeCloseTo(3);
    expect(reflected.z).toBeCloseTo(0);
  });

  test('reflect preserves speed magnitude', () => {
    const ai = new EnemyAI({ enemySpeed: 10 });

    const velocity = { x: -7, y: 4, z: 2 };
    const normal = { x: 1, y: 0, z: 0 };

    const reflected = ai.reflect(velocity, normal);

    const origSpeed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    const refSpeed = Math.sqrt(reflected.x ** 2 + reflected.y ** 2 + reflected.z ** 2);

    expect(refSpeed).toBeCloseTo(origSpeed);
  });

  test('reflect off a diagonal normal', () => {
    const ai = new EnemyAI({ enemySpeed: 10 });

    // Normal along z-axis
    const velocity = { x: 3, y: 0, z: -4 };
    const normal = { x: 0, y: 0, z: 1 };

    const reflected = ai.reflect(velocity, normal);

    // v' = {3,0,-4} - 2*(-4)*{0,0,1} = {3,0,4}
    expect(reflected.x).toBeCloseTo(3);
    expect(reflected.y).toBeCloseTo(0);
    expect(reflected.z).toBeCloseTo(4);

    // Speed preserved
    const origSpeed = Math.sqrt(9 + 0 + 16);
    const refSpeed = Math.sqrt(reflected.x ** 2 + reflected.y ** 2 + reflected.z ** 2);
    expect(refSpeed).toBeCloseTo(origSpeed);
  });
});

// ---------------------------------------------------------------------------
// 3. Generator HP decrement: explosion hit decreases HP by 1,
//    pendingRemoval flagged at 0.
//    Validates: Bugfix requirement 3.5
// ---------------------------------------------------------------------------
describe('Preservation: Generator HP decrement', () => {
  test('generator HP decreases by exactly 1 when hit by explosion', () => {
    const generator = {
      position: { x: 0, y: 0, z: 0 },
      radius: 2,
      currentHp: 5,
      maxHp: 5,
      pendingRemoval: false,
    };

    const gameState = makeGameState({ generators: [generator], enemies: [] });
    const config = makeConfig();
    const system = new ExplosionSystem(gameState, config);

    system.processExplosion({ x: 0, y: 0, z: 0 }, 10);

    expect(generator.currentHp).toBe(4);
    expect(generator.pendingRemoval).toBe(false);
  });

  test('generator becomes pendingRemoval when HP reaches 0', () => {
    const generator = {
      position: { x: 0, y: 0, z: 0 },
      radius: 2,
      currentHp: 1,
      maxHp: 5,
      pendingRemoval: false,
    };

    const gameState = makeGameState({ generators: [generator], enemies: [] });
    const config = makeConfig();
    const system = new ExplosionSystem(gameState, config);

    system.processExplosion({ x: 0, y: 0, z: 0 }, 10);

    expect(generator.currentHp).toBe(0);
    expect(generator.pendingRemoval).toBe(true);
  });

  test('generator with HP > 1 is NOT flagged for removal after one hit', () => {
    const generator = {
      position: { x: 1, y: 0, z: 0 },
      radius: 2,
      currentHp: 3,
      maxHp: 5,
      pendingRemoval: false,
    };

    const gameState = makeGameState({ generators: [generator], enemies: [] });
    const config = makeConfig();
    const system = new ExplosionSystem(gameState, config);

    system.processExplosion({ x: 0, y: 0, z: 0 }, 10);

    expect(generator.currentHp).toBe(2);
    expect(generator.pendingRemoval).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Chain reward: power level gain when chainDepth >= chainThreshold.
//    Validates: Bugfix requirement 3.3
// ---------------------------------------------------------------------------
describe('Preservation: Chain reward power level gain', () => {
  test('power increases when chainDepth >= chainThreshold after queue empties', () => {
    // Set up 3 enemies close to origin so chain reaches threshold of 3
    const enemies = [
      { position: { x: 1, y: 0, z: 0 }, radius: 1, pendingRemoval: false },
      { position: { x: 2, y: 0, z: 0 }, radius: 1, pendingRemoval: false },
      { position: { x: 3, y: 0, z: 0 }, radius: 1, pendingRemoval: false },
    ];

    const config = makeConfig({
      chainThreshold: 3,
      powerGainIncrement: 2,
      maxPower: 100,
      baseExplosionRadius: 10,
      radiusMultiplier: 0,
    });

    const gameState = makeGameState({
      enemies,
      powerLevel: 5,
      explosionQueue: [{ center: { x: 0, y: 0, z: 0 }, radius: 10, isChain: false, chainDepth: 0 }],
    });

    const system = new ExplosionSystem(gameState, config);

    // Process the first explosion — hits all 3 enemies, chainDepth becomes 3
    system.step();

    // Chain explosions enqueued for each enemy. Process them one by one.
    // Each chain explosion fires at an enemy's former position, but since
    // those enemies are already pendingRemoval, they won't be hit again.
    while (gameState.explosionQueue.length > 0) {
      system.step();
    }

    // After queue drains with chainDepth >= threshold, power should increase
    expect(gameState.powerLevel).toBe(7); // 5 + 2
  });

  test('power does NOT increase when chainDepth < chainThreshold', () => {
    // Only 1 enemy — chainDepth will be 1, below threshold of 3
    const enemies = [
      { position: { x: 1, y: 0, z: 0 }, radius: 1, pendingRemoval: false },
    ];

    const config = makeConfig({
      chainThreshold: 3,
      powerGainIncrement: 2,
      maxPower: 100,
      baseExplosionRadius: 10,
      radiusMultiplier: 0,
    });

    const gameState = makeGameState({
      enemies,
      powerLevel: 5,
      explosionQueue: [{ center: { x: 0, y: 0, z: 0 }, radius: 10, isChain: false, chainDepth: 0 }],
    });

    const system = new ExplosionSystem(gameState, config);

    // Process all steps
    while (gameState.explosionQueue.length > 0) {
      system.step();
    }

    // chainDepth is 1, below threshold of 3 — power unchanged
    expect(gameState.powerLevel).toBe(5);
  });

  test('power gain is capped at maxPower', () => {
    const enemies = [
      { position: { x: 1, y: 0, z: 0 }, radius: 1, pendingRemoval: false },
      { position: { x: 2, y: 0, z: 0 }, radius: 1, pendingRemoval: false },
      { position: { x: 3, y: 0, z: 0 }, radius: 1, pendingRemoval: false },
    ];

    const config = makeConfig({
      chainThreshold: 3,
      powerGainIncrement: 10,
      maxPower: 12,
      baseExplosionRadius: 10,
      radiusMultiplier: 0,
    });

    const gameState = makeGameState({
      enemies,
      powerLevel: 8,
      explosionQueue: [{ center: { x: 0, y: 0, z: 0 }, radius: 10, isChain: false, chainDepth: 0 }],
    });

    const system = new ExplosionSystem(gameState, config);

    while (gameState.explosionQueue.length > 0) {
      system.step();
    }

    // 8 + 10 = 18, but capped at 12
    expect(gameState.powerLevel).toBe(12);
  });
});
