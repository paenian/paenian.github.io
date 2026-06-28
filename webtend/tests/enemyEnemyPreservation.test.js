// Feature: enemy-enemy-collision
// Preservation Tests — Verify existing behaviors remain correct
// These tests should PASS on current unfixed code.
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6 from bugfix spec

import { describe, test, expect } from 'vitest';
import { EnemyAI } from '../EnemyAI.js';
import { collectHits } from '../ExplosionSystem.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function magnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function makeEnemy(position, heading, radius = 1.0) {
  return {
    id: `enemy-${Math.random().toString(36).slice(2, 6)}`,
    position: { ...position },
    velocity: { x: 0, y: 0, z: 0 },
    heading: { ...heading },
    radius,
    pendingRemoval: false,
  };
}

// ---------------------------------------------------------------------------
// Preservation Tests — These MUST pass on current code
// ---------------------------------------------------------------------------

describe('Enemy-Enemy Preservation: existing behavior unchanged', () => {
  const config = { enemySpeed: 10, avoidRadius: 5 };
  const ai = new EnemyAI(config);

  test('Test 1: Enemy wall bounce — EnemyAI.reflect() still works correctly', () => {
    // reflect(velocity, normal) should give v - 2(v·n)n
    const vel = { x: 10, y: 0, z: 0 };
    const wallNormal = { x: -1, y: 0, z: 0 }; // wall facing -x

    const reflected = ai.reflect(vel, wallNormal);

    // Heading should reverse in x
    expect(reflected.x).toBeCloseTo(-10, 4);
    expect(reflected.y).toBeCloseTo(0, 4);
    expect(reflected.z).toBeCloseTo(0, 4);

    // Speed is preserved
    expect(magnitude(reflected)).toBeCloseTo(magnitude(vel), 4);
  });

  test('Test 2: Straight-line movement at enemySpeed preserved for isolated enemies', () => {
    // A single enemy with no walls and no other enemies nearby moves in a straight line
    const enemy = makeEnemy({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });

    // Step for 1 second
    ai.update(enemy, { x: 999, y: 999, z: 999 }, [], 1.0);

    // Should move exactly enemySpeed (10) units in the -z direction
    expect(enemy.position.x).toBeCloseTo(0, 4);
    expect(enemy.position.y).toBeCloseTo(0, 4);
    expect(enemy.position.z).toBeCloseTo(-10, 4);

    // Velocity magnitude should equal enemySpeed
    expect(magnitude(enemy.velocity)).toBeCloseTo(config.enemySpeed, 4);
  });

  test('Test 3: Explosion hit detection uses bounding sphere radius (not capsule)', () => {
    // collectHits uses enemy.radius for bounding sphere checks
    const center = { x: 0, y: 0, z: 0 };
    const explosionRadius = 5;

    // Enemy at distance 5.5 with radius 1.0 — within (5 + 1.0 = 6.0) range
    const enemyInRange = makeEnemy({ x: 5.5, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.0);
    // Enemy at distance 7 with radius 1.0 — outside (5 + 1.0 = 6.0) range
    const enemyOutOfRange = makeEnemy({ x: 7, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.0);

    const { hitEnemies } = collectHits(center, explosionRadius, [enemyInRange, enemyOutOfRange], []);

    // Only the in-range enemy should be hit (using bounding sphere radius, not capsule)
    expect(hitEnemies.length).toBe(1);
    expect(hitEnemies[0].id).toBe(enemyInRange.id);
  });

  test('Test 4: EnemyAI.update() for a single enemy still moves it along its heading', () => {
    const enemy = makeEnemy({ x: 5, y: 0, z: 3 }, { x: 0.6, y: 0, z: 0.8 });

    const posBefore = { ...enemy.position };
    const headingBefore = { ...enemy.heading };

    // Step at dt=0.5 — no walls
    ai.update(enemy, { x: 0, y: 0, z: 0 }, [], 0.5);

    // Position should change by heading * enemySpeed * dt = heading * 10 * 0.5 = heading * 5
    const expectedX = posBefore.x + headingBefore.x * config.enemySpeed * 0.5;
    const expectedZ = posBefore.z + headingBefore.z * config.enemySpeed * 0.5;

    expect(enemy.position.x).toBeCloseTo(expectedX, 4);
    expect(enemy.position.y).toBeCloseTo(0, 4);
    expect(enemy.position.z).toBeCloseTo(expectedZ, 4);

    // Heading should be unchanged (no walls hit)
    expect(enemy.heading.x).toBeCloseTo(headingBefore.x, 4);
    expect(enemy.heading.y).toBeCloseTo(headingBefore.y, 4);
    expect(enemy.heading.z).toBeCloseTo(headingBefore.z, 4);
  });
});
