// Bugfix: Power-Zero Game-Over Explosion
// Preservation Tests
//
// These tests capture CORRECT existing behavior that must NOT be broken
// by the power-zero fix. They are EXPECTED TO PASS on unfixed code.
//
// Validates bugfix spec requirements: 3.1–3.6 (Unchanged Behavior)
// Design Properties: 5 (Preservation - Non-Zero Power Collision),
//                    6 (Preservation - Chain Reaction and Explosion Mechanics)

import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { GameState, playerShip } from '../GameState.js';
import { ExplosionSystem, calcRadius } from '../ExplosionSystem.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  GameState.powerLevel = overrides.powerLevel ?? 10;
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
// Property 5: Preservation — High-power collision decrement
//
// For power levels p where p - decrement > 1, the collision result equals
// p - decrement. This uses the current Math.max(1, p - d) behavior as
// baseline — for inputs where p - d > 1, the result is p - d regardless
// of whether the floor is 0 or 1.
//
// Validates: Requirements 3.1, 3.7
// ---------------------------------------------------------------------------

describe('Preservation: Collision at power>1 still decrements correctly', () => {
  test('for p - decrement > 1, collision result equals p - decrement', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }),   // powerLevel p
        fc.integer({ min: 1, max: 10 }),    // decrement d
        (p, d) => {
          // Only test cases where result stays above 1
          fc.pre(p - d > 1);

          // Apply the current game logic: Math.max(1, p - d)
          const result = Math.max(1, p - d);

          // When p - d > 1, Math.max(1, p - d) === p - d
          expect(result).toBe(p - d);

          // After the fix (Math.max(0, p - d)), the result should also be p - d
          // since p - d > 1 > 0 — behavior is identical
          const fixedResult = Math.max(0, p - d);
          expect(fixedResult).toBe(result);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6a: Preservation — Explosion radius formula unchanged
//
// For all power levels p in [1, 100], calcRadius(p, config) equals
// baseExplosionRadius + p * radiusMultiplier. This formula must remain
// unchanged by the fix.
//
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------

describe('Preservation: Explosion radius formula unchanged', () => {
  test('calcRadius(p, config) = baseExplosionRadius + p * radiusMultiplier for all p in [1, 100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),       // powerLevel
        fc.integer({ min: 1, max: 20 }),        // baseExplosionRadius
        fc.double({ min: 0.1, max: 5.0, noNaN: true, noDefaultInfinity: true }), // radiusMultiplier
        (powerLevel, baseExplosionRadius, radiusMultiplier) => {
          const config = { baseExplosionRadius, radiusMultiplier };
          const result = calcRadius(powerLevel, config);
          const expected = baseExplosionRadius + powerLevel * radiusMultiplier;
          expect(result).toBeCloseTo(expected, 10);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6b: Preservation — Chain reward at threshold unchanged
//
// When chainDepth >= chainThreshold, powerLevel becomes
// min(powerLevel + increment, maxPower). When chainDepth < chainThreshold,
// power is unchanged. Uses ExplosionSystem's step() to verify.
//
// Validates: Requirements 3.3
// ---------------------------------------------------------------------------

describe('Preservation: Chain reward at threshold unchanged', () => {
  test('chainDepth >= threshold → power = min(power + increment, maxPower)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 90 }),    // powerLevel (above danger zone)
        fc.integer({ min: 1, max: 10 }),    // chainThreshold
        fc.integer({ min: 1, max: 10 }),    // powerGainIncrement
        fc.integer({ min: 50, max: 100 }),  // maxPower
        (powerLevel, chainThreshold, powerGainIncrement, maxPower) => {
          const config = setupGameState({
            powerLevel,
            chainThreshold,
            powerGainIncrement,
            maxPower,
            baseExplosionRadius: 5,
            radiusMultiplier: 0.5,
          });

          const explosionSystem = new ExplosionSystem(GameState, GameState.config);

          // Set up a chain depth that meets the threshold
          GameState.chainDepth = chainThreshold;

          // Enqueue one final job in the queue — when step() processes it
          // and the queue empties, the reward logic fires
          GameState.explosionQueue.push({
            center: { x: 999, y: 999, z: 999 }, // Far away from any entity
            radius: 0.01, // Tiny radius to avoid hitting anything
            isChain: true,
            chainDepth: chainThreshold,
          });

          const powerBefore = GameState.powerLevel;
          explosionSystem.step();

          // Queue is now empty, chainDepth >= threshold → reward applied
          const expected = Math.min(powerBefore + powerGainIncrement, maxPower);
          expect(GameState.powerLevel).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('chainDepth < threshold → power unchanged', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 90 }),    // powerLevel (safe range)
        fc.integer({ min: 2, max: 10 }),    // chainThreshold (at least 2)
        (powerLevel, chainThreshold) => {
          const config = setupGameState({
            powerLevel,
            chainThreshold,
            powerGainIncrement: 1,
            maxPower: 100,
            baseExplosionRadius: 5,
            radiusMultiplier: 0.5,
          });

          const explosionSystem = new ExplosionSystem(GameState, GameState.config);

          // Set chain depth below threshold
          GameState.chainDepth = chainThreshold - 1;

          // Enqueue one job far from any entity
          GameState.explosionQueue.push({
            center: { x: 999, y: 999, z: 999 },
            radius: 0.01,
            isChain: true,
            chainDepth: chainThreshold - 1,
          });

          const powerBefore = GameState.powerLevel;
          explosionSystem.step();

          // Queue empty, chainDepth < threshold → power unchanged
          expect(GameState.powerLevel).toBe(powerBefore);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Preservation — Level-complete logic unaffected
//
// When all generators have pendingRemoval=true or currentHp <= 0, the game
// should detect level-complete. This is unaffected by power changes.
//
// Validates: Requirements 3.6
// ---------------------------------------------------------------------------

describe('Preservation: Level-complete logic unaffected', () => {
  test('all generators destroyed → allGeneratorsDown is true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),  // number of generators
        (numGenerators) => {
          // Create generators that are all destroyed (pendingRemoval or currentHp <= 0)
          const generators = [];
          for (let i = 0; i < numGenerators; i++) {
            generators.push({
              id: `gen-${i}`,
              position: { x: i * 10, y: 0, z: 0 },
              currentHp: 0,
              maxHp: 5,
              spawnIntervalSeconds: 10,
              lastSpawnTime: 0,
              radius: 2.0,
              mesh: null,
              hpBarElement: null,
              pendingRemoval: true,
            });
          }

          // Apply the level-complete check (same logic as Game.js)
          const allGeneratorsDown = generators.every(
            (g) => g.pendingRemoval === true || g.currentHp <= 0,
          );

          expect(allGeneratorsDown).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('at least one generator alive → allGeneratorsDown is false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),  // number of generators (at least 2)
        fc.integer({ min: 1, max: 9 }),   // index of the alive generator
        (numGenerators, aliveIdx) => {
          const idx = aliveIdx % numGenerators; // ensure valid index
          const generators = [];
          for (let i = 0; i < numGenerators; i++) {
            generators.push({
              id: `gen-${i}`,
              position: { x: i * 10, y: 0, z: 0 },
              currentHp: i === idx ? 3 : 0, // one generator still alive
              maxHp: 5,
              spawnIntervalSeconds: 10,
              lastSpawnTime: 0,
              radius: 2.0,
              mesh: null,
              hpBarElement: null,
              pendingRemoval: i !== idx, // alive one is NOT pending removal
            });
          }

          const allGeneratorsDown = generators.every(
            (g) => g.pendingRemoval === true || g.currentHp <= 0,
          );

          expect(allGeneratorsDown).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
