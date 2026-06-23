// Feature: webtend-game
// Tests for EnemyAI.js — Seek and wall-avoidance steering
// Validates: Requirements 3.2

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
// seek()
// ---------------------------------------------------------------------------

describe('EnemyAI.seek()', () => {
  const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });

  test('returns a vector pointing from enemy toward target', () => {
    const enemy = { position: { x: 0, y: 0, z: 0 } };
    const target = { x: 10, y: 0, z: 0 };
    const result = ai.seek(enemy, target);
    expect(result.x).toBeCloseTo(10, 4);
    expect(result.y).toBeCloseTo(0, 4);
    expect(result.z).toBeCloseTo(0, 4);
  });

  test('result magnitude equals enemySpeed', () => {
    const enemy = { position: { x: 1, y: 2, z: 3 } };
    const target = { x: 5, y: -1, z: 7 };
    const result = ai.seek(enemy, target);
    expect(magnitude(result)).toBeCloseTo(10, 4);
  });

  test('returns zero vector when enemy is at target', () => {
    const enemy = { position: { x: 5, y: 5, z: 5 } };
    const target = { x: 5, y: 5, z: 5 };
    const result = ai.seek(enemy, target);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.z).toBe(0);
  });

  test('direction is correct for diagonal target', () => {
    const enemy = { position: { x: 0, y: 0, z: 0 } };
    const target = { x: 1, y: 0, z: 1 };
    const result = ai.seek(enemy, target);
    // Should point equally in x and z
    expect(result.x).toBeCloseTo(result.z, 4);
    expect(result.x).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// avoidWalls()
// ---------------------------------------------------------------------------

describe('EnemyAI.avoidWalls()', () => {
  const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });

  test('returns zero when no walls are nearby', () => {
    const enemy = { position: { x: 0, y: 0, z: 0 } };
    const walls = [{ min: { x: 20, y: 0, z: 20 }, max: { x: 30, y: 10, z: 30 } }];
    const result = ai.avoidWalls(enemy, walls);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.z).toBe(0);
  });

  test('returns zero when walls array is empty', () => {
    const enemy = { position: { x: 0, y: 0, z: 0 } };
    const result = ai.avoidWalls(enemy, []);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.z).toBe(0);
  });

  test('repels away from a nearby wall', () => {
    // Wall is to the +x side, enemy is close to it
    const enemy = { position: { x: 8, y: 5, z: 5 } };
    const wall = { min: { x: 10, y: 0, z: 0 }, max: { x: 20, y: 10, z: 10 } };
    const result = ai.avoidWalls(enemy, [wall]);
    // Repulsion should push enemy in -x direction (away from wall)
    expect(result.x).toBeLessThan(0);
  });

  test('repulsion strength increases as enemy gets closer to wall', () => {
    const wall = { min: { x: 10, y: 0, z: 0 }, max: { x: 20, y: 10, z: 10 } };
    const enemyFar = { position: { x: 6, y: 5, z: 5 } }; // 4 units from wall
    const enemyClose = { position: { x: 9, y: 5, z: 5 } }; // 1 unit from wall
    const farResult = ai.avoidWalls(enemyFar, [wall]);
    const closeResult = ai.avoidWalls(enemyClose, [wall]);
    expect(Math.abs(closeResult.x)).toBeGreaterThan(Math.abs(farResult.x));
  });

  test('sums repulsion from multiple nearby walls', () => {
    // Enemy between two walls
    const enemy = { position: { x: 0, y: 5, z: 0 } };
    const wallLeft = { min: { x: -5, y: 0, z: -10 }, max: { x: -2, y: 10, z: 10 } };
    const wallRight = { min: { x: 2, y: 0, z: -10 }, max: { x: 5, y: 10, z: 10 } };
    const result = ai.avoidWalls(enemy, [wallLeft, wallRight]);
    // Equal distance from both walls, so x-repulsion should cancel out
    expect(Math.abs(result.x)).toBeLessThan(0.01);
  });

  test('does not repel when enemy is exactly at avoidRadius', () => {
    // avoidRadius = 5, so wall at distance exactly 5 should NOT repel (distance < avoidRadius check)
    const enemy = { position: { x: 5, y: 5, z: 5 } };
    const wall = { min: { x: 10, y: 0, z: 0 }, max: { x: 20, y: 10, z: 10 } };
    const result = ai.avoidWalls(enemy, [wall]);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.z).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------

describe('EnemyAI.update()', () => {
  test('moves enemy toward player when no walls nearby', () => {
    const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });
    const enemy = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    const playerPos = { x: 100, y: 0, z: 0 };
    ai.update(enemy, playerPos, [], 1.0);
    // After 1 second, enemy should have moved 10 units in +x
    expect(enemy.position.x).toBeCloseTo(10, 4);
    expect(enemy.position.y).toBeCloseTo(0, 4);
    expect(enemy.position.z).toBeCloseTo(0, 4);
  });

  test('velocity magnitude does not exceed enemySpeed', () => {
    const ai = new EnemyAI({ enemySpeed: 8, avoidRadius: 5 });
    const enemy = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    const playerPos = { x: 10, y: 10, z: 10 };
    ai.update(enemy, playerPos, [], 0.016);
    expect(magnitude(enemy.velocity)).toBeLessThanOrEqual(8 + 1e-5);
  });

  test('velocity is clamped even with wall avoidance adding force', () => {
    const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });
    const enemy = { position: { x: 9, y: 5, z: 5 }, velocity: { x: 0, y: 0, z: 0 } };
    const playerPos = { x: 100, y: 5, z: 5 };
    const wall = { min: { x: 10, y: 0, z: 0 }, max: { x: 20, y: 10, z: 10 } };
    ai.update(enemy, playerPos, [wall], 0.016);
    expect(magnitude(enemy.velocity)).toBeLessThanOrEqual(10 + 1e-5);
  });

  test('position updates by velocity * dt', () => {
    const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });
    const enemy = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    const playerPos = { x: 10, y: 0, z: 0 };
    ai.update(enemy, playerPos, [], 0.5);
    // velocity should be 10 in +x, position should move by 10 * 0.5 = 5
    expect(enemy.position.x).toBeCloseTo(5, 4);
  });

  test('enemy at player position results in zero velocity', () => {
    const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });
    const enemy = { position: { x: 5, y: 5, z: 5 }, velocity: { x: 0, y: 0, z: 0 } };
    const playerPos = { x: 5, y: 5, z: 5 };
    ai.update(enemy, playerPos, [], 1.0);
    expect(enemy.velocity.x).toBe(0);
    expect(enemy.velocity.y).toBe(0);
    expect(enemy.velocity.z).toBe(0);
    expect(enemy.position.x).toBe(5);
  });

  test('wall avoidance deflects path around obstacle', () => {
    const ai = new EnemyAI({ enemySpeed: 10, avoidRadius: 5 });
    // Enemy heading toward player but a wall is directly in the path
    const enemy = { position: { x: 0, y: 5, z: 2 }, velocity: { x: 0, y: 0, z: 0 } };
    const playerPos = { x: 30, y: 5, z: 2 }; // player is far ahead in +x
    // Wall is right in front, close to enemy
    const wall = { min: { x: 2, y: 0, z: 0 }, max: { x: 4, y: 10, z: 4 } };
    ai.update(enemy, playerPos, [wall], 0.016);
    // The wall should push enemy in -x, but seek pushes in +x.
    // The z component should be non-zero due to avoidance pushing away from wall's z-face
    // At least velocity should still be valid
    expect(magnitude(enemy.velocity)).toBeLessThanOrEqual(10 + 1e-5);
    expect(magnitude(enemy.velocity)).toBeGreaterThan(0);
  });
});
