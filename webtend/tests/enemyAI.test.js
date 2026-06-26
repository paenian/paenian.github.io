// Feature: webtend-game
// Tests for EnemyAI.js — Straight-line movement with wall reflection
// Validates: Requirements 3.2
// User Story: US-3

import { describe, test, expect } from 'vitest';
import { EnemyAI } from '../EnemyAI.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function magnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('EnemyAI constructor', () => {
  test('stores config with provided values', () => {
    const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 8 });
    expect(ai.config.enemySpeed).toBe(10);
    expect(ai.config.avoidRadius).toBe(8);
  });

  test('defaults avoidRadius to 5 if not provided', () => {
    const ai = new EnemyAI({ enemySpeed: 10 });
    expect(ai.config.avoidRadius).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// computeSpawnHeading()
// ---------------------------------------------------------------------------

describe('EnemyAI.computeSpawnHeading()', () => {
  const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });

  test('returns a unit vector pointing from spawn to player', () => {
    const heading = ai.computeSpawnHeading({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
    expect(heading.x).toBeCloseTo(1, 4);
    expect(heading.y).toBeCloseTo(0, 4);
    expect(heading.z).toBeCloseTo(0, 4);
  });

  test('returns a unit vector for diagonal targets', () => {
    const heading = ai.computeSpawnHeading({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 });
    expect(magnitude(heading)).toBeCloseTo(1, 4);
    expect(heading.x).toBeCloseTo(heading.z, 4);
  });

  test('returns a random direction when spawn equals player position', () => {
    const heading = ai.computeSpawnHeading({ x: 5, y: 0, z: 5 }, { x: 5, y: 0, z: 5 });
    expect(magnitude(heading)).toBeCloseTo(1, 4);
  });
});

// ---------------------------------------------------------------------------
// reflect()
// ---------------------------------------------------------------------------

describe('EnemyAI.reflect()', () => {
  const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });

  test('reflects velocity off a wall normal', () => {
    const vel = { x: 1, y: 0, z: 0 };
    const normal = { x: -1, y: 0, z: 0 };
    const result = ai.reflect(vel, normal);
    expect(result.x).toBeCloseTo(-1, 4);
    expect(result.y).toBeCloseTo(0, 4);
    expect(result.z).toBeCloseTo(0, 4);
  });

  test('preserves speed magnitude', () => {
    const vel = { x: 3, y: 0, z: 4 }; // magnitude 5
    const normal = { x: 1, y: 0, z: 0 };
    const result = ai.reflect(vel, normal);
    expect(magnitude(result)).toBeCloseTo(5, 4);
  });
});

// ---------------------------------------------------------------------------
// update() — straight-line movement
// ---------------------------------------------------------------------------

describe('EnemyAI.update()', () => {
  test('moves enemy in a straight line along heading', () => {
    const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });
    const enemy = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      heading: { x: 1, y: 0, z: 0 },
      radius: 1.0,
    };
    ai.update(enemy, { x: 999, y: 999, z: 999 }, [], 1.0);
    // Should move 10 units in +x regardless of playerPos
    expect(enemy.position.x).toBeCloseTo(10, 4);
    expect(enemy.position.y).toBeCloseTo(0, 4);
    expect(enemy.position.z).toBeCloseTo(0, 4);
  });

  test('does NOT follow the player', () => {
    const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });
    const enemy = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      heading: { x: 1, y: 0, z: 0 }, // heading is +x
      radius: 1.0,
    };
    // Player is in -z direction, but enemy should still go +x
    ai.update(enemy, { x: 0, y: 0, z: -100 }, [], 0.5);
    expect(enemy.position.x).toBeCloseTo(5, 4);
    expect(enemy.position.z).toBeCloseTo(0, 4);
  });

  test('velocity magnitude equals enemySpeed', () => {
    const ai = new EnemyAI({ enemySpeed: 8, avoidRadius: 5 });
    const enemy = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      heading: { x: 0.6, y: 0, z: 0.8 }, // already normalized (magnitude 1)
      radius: 1.0,
    };
    ai.update(enemy, { x: 0, y: 0, z: 0 }, [], 0.016);
    expect(magnitude(enemy.velocity)).toBeCloseTo(8, 4);
  });

  test('bounces off walls and changes heading', () => {
    const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });
    // Enemy at x=9.95 with radius 1 — after moving 0.01*10=0.1 units to x=10.05,
    // it overlaps the wall surface (distance from wall face < radius)
    const enemy = {
      position: { x: 9.95, y: 5, z: 5 },
      velocity: { x: 0, y: 0, z: 0 },
      heading: { x: 1, y: 0, z: 0 }, // heading toward wall
      radius: 1.0,
    };
    // Wall is a thin slab at x=11 so the enemy's sphere (center near x=10.05, radius=1)
    // just touches it from outside
    const wall = { min: { x: 10.1, y: 0, z: 0 }, max: { x: 12, y: 10, z: 10 } };
    ai.update(enemy, { x: 0, y: 0, z: 0 }, [wall], 0.01);
    // After collision, heading x should reverse
    expect(enemy.heading.x).toBeLessThan(0);
  });

  test('heading remains a unit vector after wall bounce', () => {
    const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });
    const enemy = {
      position: { x: 9.95, y: 5, z: 5 },
      velocity: { x: 0, y: 0, z: 0 },
      heading: { x: 1, y: 0, z: 0 },
      radius: 1.0,
    };
    const wall = { min: { x: 10.1, y: 0, z: 0 }, max: { x: 12, y: 10, z: 10 } };
    ai.update(enemy, { x: 0, y: 0, z: 0 }, [wall], 0.01);
    expect(magnitude(enemy.heading)).toBeCloseTo(1, 4);
  });

  test('position updates correctly over multiple frames', () => {
    const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });
    const enemy = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      heading: { x: 0, y: 0, z: -1 },
      radius: 1.0,
    };
    // 3 frames at dt=0.1
    ai.update(enemy, { x: 0, y: 0, z: 0 }, [], 0.1);
    ai.update(enemy, { x: 0, y: 0, z: 0 }, [], 0.1);
    ai.update(enemy, { x: 0, y: 0, z: 0 }, [], 0.1);
    expect(enemy.position.z).toBeCloseTo(-3, 4);
  });
});
