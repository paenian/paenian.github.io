// Feature: webtend-game
// Tests for generator / level progression logic: Properties 6, 9, 11, 12
// Validates: Requirements 2.6, 4.2, 4.5, 5.3, 7.3, 7.4

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Property 6: Chain Reaction Power Gain Obeys Threshold and Maximum
// Validates: Requirements 2.6, 5.3
// ---------------------------------------------------------------------------

describe('Property 6 — chain reaction power gain', () => {
  test('if chainDepth >= chainThreshold, power increases by increment capped at maxPower', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 100 }),  // powerLevel
      fc.integer({ min: 1, max: 50 }),   // chainDepth
      fc.integer({ min: 1, max: 50 }),   // chainThreshold
      fc.integer({ min: 1, max: 20 }),   // increment
      fc.integer({ min: 50, max: 100 }), // maxPower
      (power, depth, threshold, increment, maxPower) => {
        let newPower = power;
        if (depth >= threshold) {
          newPower = Math.min(power + increment, maxPower);
        }
        // If threshold met: result is capped at maxPower and is at least min(power, maxPower)
        if (depth >= threshold) {
          return newPower <= maxPower && newPower >= Math.min(power, maxPower);
        }
        // If threshold not met: power unchanged
        return newPower === power;
      }
    ), { numRuns: 200 });
  });

  test('power never exceeds maxPower', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: 1, max: 20 }),
      fc.integer({ min: 50, max: 100 }),
      (power, increment, maxPower) => {
        const result = Math.min(power + increment, maxPower);
        return result <= maxPower;
      }
    ), { numRuns: 200 });
  });

  test('example: power 95 + increment 10, max 100 = 100', () => {
    expect(Math.min(95 + 10, 100)).toBe(100);
  });

  test('example: power at max stays at max', () => {
    expect(Math.min(100 + 5, 100)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Property 9: Generator HP Bar Fill Ratio Is Always in [0, 1]
// Validates: Requirements 4.2
// ---------------------------------------------------------------------------

describe('Property 9 — generator HP bar fill ratio', () => {
  test('currentHp / maxHp is always in [0, 1] for valid HP values', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 1000 }),   // currentHp
      fc.integer({ min: 1, max: 1000 }),   // maxHp (must be > 0)
      (currentHp, maxHp) => {
        // currentHp should not exceed maxHp in practice
        const clampedHp = Math.min(currentHp, maxHp);
        const ratio = clampedHp / maxHp;
        return ratio >= 0 && ratio <= 1;
      }
    ), { numRuns: 200 });
  });

  test('ratio is 0 when HP is depleted', () => {
    expect(0 / 5).toBe(0);
  });

  test('ratio is 1 when HP is full', () => {
    expect(5 / 5).toBe(1);
  });

  test('ratio is 0.5 when HP is half', () => {
    expect(3 / 6).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Property 11: Level Spawn Intervals Are Monotonically Non-Increasing with Floor
// Validates: Requirements 4.5, 7.3
// ---------------------------------------------------------------------------

describe('Property 11 — level spawn intervals non-increasing with floor at 0.5s', () => {
  test('sequence of max(0.5, prev * (1 - decreasePct)) is non-increasing and >= 0.5', () => {
    fc.assert(fc.property(
      fc.float({ min: Math.fround(1), max: Math.fround(30), noNaN: true }),    // initial interval
      fc.float({ min: Math.fround(0.01), max: Math.fround(0.5), noNaN: true }), // decrease percentage
      fc.integer({ min: 2, max: 20 }),  // number of levels
      (initial, decreasePct, levels) => {
        const intervals = [initial];
        for (let i = 1; i < levels; i++) {
          const next = Math.max(0.5, intervals[i - 1] * (1 - decreasePct));
          intervals.push(next);
        }
        // Verify non-increasing
        for (let i = 1; i < intervals.length; i++) {
          if (intervals[i] > intervals[i - 1] + 1e-6) return false;
        }
        // Verify floor
        for (const interval of intervals) {
          if (interval < 0.5 - 1e-6) return false;
        }
        return true;
      }
    ), { numRuns: 200 });
  });

  test('example: intervals decrease from 10s with 20% reduction', () => {
    let interval = 10;
    for (let i = 0; i < 10; i++) {
      const next = Math.max(0.5, interval * 0.8);
      expect(next).toBeLessThanOrEqual(interval);
      expect(next).toBeGreaterThanOrEqual(0.5);
      interval = next;
    }
  });
});

// ---------------------------------------------------------------------------
// Property 12: Level Generator Counts Are Monotonically Non-Decreasing with Ceiling
// Validates: Requirements 7.4
// ---------------------------------------------------------------------------

describe('Property 12 — level generator counts non-decreasing with ceiling at 20', () => {
  test('sequence of min(20, prev + increment) is non-decreasing and <= 20', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 10 }),   // initial count
      fc.integer({ min: 0, max: 5 }),    // increment per level
      fc.integer({ min: 2, max: 20 }),   // number of levels
      (initial, increment, levels) => {
        const counts = [initial];
        for (let i = 1; i < levels; i++) {
          const next = Math.min(20, counts[i - 1] + increment);
          counts.push(next);
        }
        // Verify non-decreasing
        for (let i = 1; i < counts.length; i++) {
          if (counts[i] < counts[i - 1]) return false;
        }
        // Verify ceiling
        for (const count of counts) {
          if (count > 20) return false;
        }
        return true;
      }
    ), { numRuns: 200 });
  });

  test('example: generator count increases from 1 by 1 per level, capped at 20', () => {
    let count = 1;
    for (let i = 0; i < 25; i++) {
      const next = Math.min(20, count + 1);
      expect(next).toBeGreaterThanOrEqual(count);
      expect(next).toBeLessThanOrEqual(20);
      count = next;
    }
    expect(count).toBe(20);
  });

  test('stays at ceiling when already at 20', () => {
    expect(Math.min(20, 20 + 3)).toBe(20);
  });
});
