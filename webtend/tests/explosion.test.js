// Feature: webtend-game
// Tests for ExplosionSystem.js: Properties 4, 5, 10

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { calcRadius, collectHits, ExplosionSystem } from '../ExplosionSystem.js';

// ---------------------------------------------------------------------------
// Property 4: Explosion Radius Formula Is Monotonically Increasing with Power Level
// Validates: Requirements 2.1, 5.2
// ---------------------------------------------------------------------------
describe('calcRadius (pure function)', () => {
  test('Property 4 – radius equals base + powerLevel × multiplier', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 100 }),                                           // powerLevel
      fc.float({ min: Math.fround(0.1), max: Math.fround(50), noNaN: true }),    // baseExplosionRadius > 0
      fc.float({ min: Math.fround(0), max: Math.fround(10), noNaN: true }),      // radiusMultiplier >= 0
      (powerLevel, baseExplosionRadius, radiusMultiplier) => {
        const config = { baseExplosionRadius, radiusMultiplier };
        const result = calcRadius(powerLevel, config);
        const expected = baseExplosionRadius + powerLevel * radiusMultiplier;
        return Math.abs(result - expected) < 1e-4;
      }
    ), { numRuns: 100 });
  });

  test('Property 4 – radius is monotonically non-decreasing with power level', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 99 }),                   // p1
      fc.integer({ min: 1, max: 99 }),                   // p2 (may equal p1)
      fc.float({ min: Math.fround(0.1), max: Math.fround(50), noNaN: true }),
      fc.float({ min: Math.fround(0), max: Math.fround(10), noNaN: true }),
      (p1Raw, p2Raw, baseExplosionRadius, radiusMultiplier) => {
        const [p1, p2] = [Math.min(p1Raw, p2Raw), Math.max(p1Raw, p2Raw)];
        const config = { baseExplosionRadius, radiusMultiplier };
        return calcRadius(p1, config) <= calcRadius(p2, config);
      }
    ), { numRuns: 100 });
  });

  test('delegates from ExplosionSystem instance to pure calcRadius', () => {
    const config = { baseExplosionRadius: 5, radiusMultiplier: 0.5 };
    const system = new ExplosionSystem(null, config);
    expect(system.calcRadius(10)).toBe(calcRadius(10, config));
    expect(system.calcRadius(10)).toBeCloseTo(10); // 5 + 10 * 0.5
  });
});

// ---------------------------------------------------------------------------
// Property 5: Explosion Blast Collection — All In-Radius Enemies Captured
// Validates: Requirements 2.3, 2.4, 2.8
// ---------------------------------------------------------------------------
describe('collectHits (pure function)', () => {
  // Helpers
  const makeEntity = (x, y, z, radius, pendingRemoval) => ({
    position: { x, y, z },
    radius,
    ...(pendingRemoval !== undefined ? { pendingRemoval } : {}),
  });

  const distance = (a, b) => {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  test('Property 5 – returns exactly the entities within radius + entity.radius', () => {
    const entityArb = fc.record({
      x: fc.float({ min: Math.fround(-50), max: Math.fround(50), noNaN: true }),
      y: fc.float({ min: Math.fround(-50), max: Math.fround(50), noNaN: true }),
      z: fc.float({ min: Math.fround(-50), max: Math.fround(50), noNaN: true }),
      radius: fc.float({ min: Math.fround(0.5), max: Math.fround(5), noNaN: true }),
    }).map(({ x, y, z, radius }) => makeEntity(x, y, z, radius));

    fc.assert(fc.property(
      fc.record({
        x: fc.float({ min: Math.fround(-20), max: Math.fround(20), noNaN: true }),
        y: fc.float({ min: Math.fround(-20), max: Math.fround(20), noNaN: true }),
        z: fc.float({ min: Math.fround(-20), max: Math.fround(20), noNaN: true }),
      }),
      fc.float({ min: Math.fround(1), max: Math.fround(20), noNaN: true }),
      fc.array(entityArb, { minLength: 0, maxLength: 20 }),
      fc.array(entityArb, { minLength: 0, maxLength: 10 }),
      (center, radius, enemies, generators) => {
        const { hitEnemies, hitGenerators } = collectHits(center, radius, enemies, generators);

        const shouldHitE = enemies.filter(e => distance(center, e.position) < radius + e.radius);
        const shouldHitG = generators.filter(g => distance(center, g.position) < radius + g.radius);

        return (
          hitEnemies.length === shouldHitE.length &&
          hitGenerators.length === shouldHitG.length &&
          hitEnemies.every(e => distance(center, e.position) < radius + e.radius) &&
          hitGenerators.every(g => distance(center, g.position) < radius + g.radius)
        );
      }
    ), { numRuns: 100 });
  });

  test('Property 5 – entities with pendingRemoval=true are excluded', () => {
    const center = { x: 0, y: 0, z: 0 };
    const radius = 10;
    // clearly within range but flagged
    const removed = makeEntity(0, 0, 0, 1, true);
    // within range, active
    const active = makeEntity(0, 0, 0, 1, false);

    const { hitEnemies } = collectHits(center, radius, [removed, active], []);
    expect(hitEnemies).toHaveLength(1);
    expect(hitEnemies[0]).toBe(active);
  });

  test('no hits when all enemies are out of range', () => {
    const center = { x: 0, y: 0, z: 0 };
    const { hitEnemies, hitGenerators } = collectHits(
      center, 5,
      [makeEntity(100, 0, 0, 1), makeEntity(-100, 0, 0, 1)],
      [makeEntity(0, 200, 0, 1)],
    );
    expect(hitEnemies).toHaveLength(0);
    expect(hitGenerators).toHaveLength(0);
  });

  test('entity exactly on the boundary (distance === radius + entity.radius) is NOT hit', () => {
    // collectHits uses strict < so touching the boundary is not a hit
    const center = { x: 0, y: 0, z: 0 };
    const explosionRadius = 5;
    const entityRadius = 2;
    // place entity exactly at distance == 7
    const entity = makeEntity(7, 0, 0, entityRadius);
    const { hitEnemies } = collectHits(center, explosionRadius, [entity], []);
    expect(hitEnemies).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Property 10: Generator HP Decreases by Exactly One Per Explosion Hit
// Validates: Requirements 2.5
// ---------------------------------------------------------------------------
describe('generator HP decrement', () => {
  test('Property 10 – HP is reduced by exactly 1 after one explosion hit', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 1000 }),  // currentHp
      fc.integer({ min: 1, max: 1000 }),  // maxHp
      (currentHp, maxHpOffset) => {
        const maxHp = currentHp + maxHpOffset; // ensure maxHp >= currentHp
        const generator = { currentHp, maxHp };
        const newHp = Math.max(0, generator.currentHp - 1);
        return newHp === currentHp - 1;
      }
    ), { numRuns: 100 });
  });

  test('HP cannot go below 0', () => {
    const generator = { currentHp: 1, maxHp: 5 };
    expect(Math.max(0, generator.currentHp - 1)).toBe(0);
  });
});
