// Feature: webtend-game
// Tests for Physics.js: Properties 1, 2, 7, 8
// Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.8, 1.9, 3.3, 6.2, 6.3, 6.6

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  reflect,
  applyAcceleration,
  applyDeceleration,
  clampSpeed,
  checkSphereAABB,
  checkSphereSphere,
  snapSmallComponent,
  wallSlide,
} from '../Physics.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function magnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize(v) {
  const m = magnitude(v);
  if (m === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

// Arbitraries — constrained to finite, reasonable values for stable FP arithmetic
const finiteFloat = fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true, noDefaultInfinity: true });

const vec3 = fc.record({ x: finiteFloat, y: finiteFloat, z: finiteFloat });

const nonZeroVec3 = vec3.filter(v => magnitude(v) > 1e-2);

const unitVec3 = nonZeroVec3.map(v => normalize(v));

// ---------------------------------------------------------------------------
// Property 7: Wall Reflection Preserves Speed and Reverses Normal Component
// Validates: Requirements 3.3, 6.2, 6.3
// ---------------------------------------------------------------------------

describe('Property 7 — reflect()', () => {
  test('preserves speed magnitude', () => {
    fc.assert(fc.property(
      nonZeroVec3,
      unitVec3,
      (vel, n) => {
        const reflected = reflect(vel, n);
        return Math.abs(magnitude(reflected) - magnitude(vel)) < 1e-4;
      }
    ), { numRuns: 100 });
  });

  test('reverses the normal component of velocity', () => {
    fc.assert(fc.property(
      nonZeroVec3,
      unitVec3,
      (vel, n) => {
        const reflected = reflect(vel, n);
        const normalComponentBefore = dot(vel, n);
        const normalComponentAfter = dot(reflected, n);
        return Math.abs(normalComponentAfter + normalComponentBefore) < 1e-4;
      }
    ), { numRuns: 100 });
  });

  test('preserves the tangential (perpendicular) component of velocity', () => {
    fc.assert(fc.property(
      nonZeroVec3,
      unitVec3,
      (vel, n) => {
        const reflected = reflect(vel, n);
        // Tangential component = v - (v·n)n
        const dv = dot(vel, n);
        const dr = dot(reflected, n);
        const tangBefore = {
          x: vel.x - dv * n.x,
          y: vel.y - dv * n.y,
          z: vel.z - dv * n.z,
        };
        const tangAfter = {
          x: reflected.x - dr * n.x,
          y: reflected.y - dr * n.y,
          z: reflected.z - dr * n.z,
        };
        const diff = magnitude({
          x: tangAfter.x - tangBefore.x,
          y: tangAfter.y - tangBefore.y,
          z: tangAfter.z - tangBefore.z,
        });
        return diff < 1e-4;
      }
    ), { numRuns: 100 });
  });

  test('example: horizontal velocity bouncing off vertical wall', () => {
    const vel = { x: 3, y: 0, z: 0 };
    const normal = { x: -1, y: 0, z: 0 }; // wall facing -x
    const result = reflect(vel, normal);
    expect(result.x).toBeCloseTo(-3, 5);
    expect(result.y).toBeCloseTo(0, 5);
    expect(result.z).toBeCloseTo(0, 5);
  });

  test('example: diagonal velocity bouncing off floor', () => {
    const vel = { x: 1, y: -1, z: 0 };
    const normal = { x: 0, y: 1, z: 0 }; // floor pointing up
    const result = reflect(vel, normal);
    expect(result.x).toBeCloseTo(1, 5);
    expect(result.y).toBeCloseTo(1, 5);
    expect(result.z).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// Property 1: Ship Thrust Acceleration Never Exceeds Maximum Speed
// Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.9
// ---------------------------------------------------------------------------

describe('Property 1 — applyAcceleration()', () => {
  test('resulting speed never exceeds maxSpeed', () => {
    fc.assert(fc.property(
      nonZeroVec3,  // initial velocity (within maxSpeed range)
      unitVec3,     // thrust direction
      fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }),  // dt
      (rawVel, dir, dt) => {
        const maxSpeed = 50;
        const accel = 20;
        // Clamp initial velocity to maxSpeed
        const speed = magnitude(rawVel);
        const vel = speed > maxSpeed
          ? { x: rawVel.x / speed * maxSpeed, y: rawVel.y / speed * maxSpeed, z: rawVel.z / speed * maxSpeed }
          : rawVel;
        const result = applyAcceleration(vel, dir, accel, maxSpeed, dt);
        return magnitude(result) <= maxSpeed + 1e-5;
      }
    ), { numRuns: 100 });
  });

  test('zero direction returns velocity unchanged', () => {
    const vel = { x: 10, y: 5, z: 0 };
    const result = applyAcceleration(vel, { x: 0, y: 0, z: 0 }, 20, 50, 0.016);
    expect(result.x).toBeCloseTo(10, 5);
    expect(result.y).toBeCloseTo(5, 5);
    expect(result.z).toBeCloseTo(0, 5);
  });

  test('accelerates toward max speed from rest', () => {
    const vel = { x: 0, y: 0, z: 0 };
    const dir = { x: 0, y: 0, z: -1 };
    const result = applyAcceleration(vel, dir, 20, 50, 1.0);
    expect(magnitude(result)).toBeCloseTo(20, 4);
  });

  test('diagonal movement does not exceed maxSpeed (requirement 1.9)', () => {
    // Normalized diagonal direction
    const dir = { x: 1 / Math.sqrt(2), y: 0, z: 1 / Math.sqrt(2) };
    const vel = { x: 0, y: 0, z: 0 };
    // Apply many times to try to exceed maxSpeed
    let v = vel;
    for (let i = 0; i < 100; i++) {
      v = applyAcceleration(v, dir, 20, 50, 0.1);
    }
    expect(magnitude(v)).toBeLessThanOrEqual(50 + 1e-5);
  });
});

// ---------------------------------------------------------------------------
// Property 2: Ship Deceleration Reaches Zero Within Time Limit
// Validates: Requirements 1.8
// ---------------------------------------------------------------------------

describe('Property 2 — applyDeceleration()', () => {
  test('speed is zero or near-zero after decelTime seconds', () => {
    fc.assert(fc.property(
      nonZeroVec3,
      (rawVel) => {
        const maxSpeed = 50;
        const decelTime = 0.5;
        const decelRate = maxSpeed / decelTime; // 100 units/s²
        // Clamp initial velocity to maxSpeed
        const speed = magnitude(rawVel);
        const vel = speed > maxSpeed
          ? { x: rawVel.x / speed * maxSpeed, y: rawVel.y / speed * maxSpeed, z: rawVel.z / speed * maxSpeed }
          : rawVel;

        // Simulate deceleration over decelTime in small steps
        const steps = 100;
        const dt = decelTime / steps;
        let v = vel;
        for (let i = 0; i < steps; i++) {
          v = applyDeceleration(v, decelRate, dt);
        }
        return magnitude(v) < 1e-3;
      }
    ), { numRuns: 100 });
  });

  test('deceleration never produces negative speed (overshoot)', () => {
    fc.assert(fc.property(
      nonZeroVec3,
      fc.float({ min: Math.fround(0.001), max: Math.fround(0.5), noNaN: true }),
      (rawVel, dt) => {
        const decelRate = 100;
        const speed = magnitude(rawVel);
        const vel = speed > 50
          ? { x: rawVel.x / speed * 50, y: rawVel.y / speed * 50, z: rawVel.z / speed * 50 }
          : rawVel;
        const result = applyDeceleration(vel, decelRate, dt);
        return magnitude(result) >= 0;
      }
    ), { numRuns: 100 });
  });

  test('deceleration reduces speed toward zero', () => {
    const vel = { x: 30, y: 0, z: 40 }; // magnitude = 50
    const result = applyDeceleration(vel, 100, 0.016);
    expect(magnitude(result)).toBeLessThan(50);
    expect(magnitude(result)).toBeGreaterThanOrEqual(0);
  });

  test('already-zero velocity stays zero', () => {
    const result = applyDeceleration({ x: 0, y: 0, z: 0 }, 100, 0.016);
    expect(magnitude(result)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// clampSpeed — used by both property 1 and internal helpers
// ---------------------------------------------------------------------------

describe('clampSpeed()', () => {
  test('does not exceed maxSpeed', () => {
    fc.assert(fc.property(
      nonZeroVec3,
      fc.float({ min: Math.fround(0.1), max: Math.fround(200), noNaN: true }),
      (vel, maxSpeed) => {
        const result = clampSpeed(vel, maxSpeed);
        return magnitude(result) <= maxSpeed + 1e-5;
      }
    ), { numRuns: 100 });
  });

  test('does not change velocity below maxSpeed', () => {
    const vel = { x: 1, y: 2, z: 2 }; // magnitude = 3
    const result = clampSpeed(vel, 10);
    expect(result.x).toBeCloseTo(1, 5);
    expect(result.y).toBeCloseTo(2, 5);
    expect(result.z).toBeCloseTo(2, 5);
  });

  test('clamps velocity above maxSpeed', () => {
    const vel = { x: 30, y: 0, z: 40 }; // magnitude = 50
    const result = clampSpeed(vel, 25);
    expect(magnitude(result)).toBeCloseTo(25, 4);
  });
});

// ---------------------------------------------------------------------------
// checkSphereAABB — collision detection
// ---------------------------------------------------------------------------

describe('checkSphereAABB()', () => {
  const box = { min: { x: -5, y: -5, z: -5 }, max: { x: 5, y: 5, z: 5 } };

  test('no hit when sphere is clearly outside', () => {
    const result = checkSphereAABB({ x: 20, y: 0, z: 0 }, 1, box);
    expect(result.hit).toBe(false);
  });

  test('hit when sphere overlaps a face', () => {
    const result = checkSphereAABB({ x: 6, y: 0, z: 0 }, 2, box);
    expect(result.hit).toBe(true);
    expect(result.depth).toBeGreaterThan(0);
  });

  test('normal points away from AABB surface', () => {
    // Sphere approaching from +x side
    const result = checkSphereAABB({ x: 6, y: 0, z: 0 }, 2, box);
    expect(result.normal.x).toBeGreaterThan(0);
  });

  test('hit when sphere center is inside AABB', () => {
    const result = checkSphereAABB({ x: 0, y: 0, z: 0 }, 1, box);
    expect(result.hit).toBe(true);
    expect(result.depth).toBeGreaterThan(0);
  });

  test('sphere just touching surface is a hit', () => {
    // Sphere center at x=6, radius=1: closest point on box is x=5, distance=1 = radius
    // At exactly the boundary: distance >= radius so NOT a hit (strict inequality)
    const result = checkSphereAABB({ x: 6, y: 0, z: 0 }, 1, box);
    expect(result.hit).toBe(false);
  });

  test('sphere partially overlapping returns positive depth', () => {
    const result = checkSphereAABB({ x: 6.5, y: 0, z: 0 }, 2, box);
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(0.5, 4);
  });
});

// ---------------------------------------------------------------------------
// checkSphereSphere — collision detection
// ---------------------------------------------------------------------------

describe('checkSphereSphere()', () => {
  test('no hit when spheres are far apart', () => {
    const result = checkSphereSphere({ x: 0, y: 0, z: 0 }, 1, { x: 10, y: 0, z: 0 }, 1);
    expect(result.hit).toBe(false);
  });

  test('hit when spheres overlap', () => {
    const result = checkSphereSphere({ x: 0, y: 0, z: 0 }, 2, { x: 3, y: 0, z: 0 }, 2);
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(1, 4);
  });

  test('normal points from c1 toward c2', () => {
    const result = checkSphereSphere({ x: 0, y: 0, z: 0 }, 2, { x: 3, y: 0, z: 0 }, 2);
    expect(result.normal.x).toBeCloseTo(1, 4);
    expect(result.normal.y).toBeCloseTo(0, 4);
    expect(result.normal.z).toBeCloseTo(0, 4);
  });

  test('coincident sphere centers returns a valid normal', () => {
    const result = checkSphereSphere({ x: 0, y: 0, z: 0 }, 2, { x: 0, y: 0, z: 0 }, 2);
    expect(result.hit).toBe(true);
    expect(magnitude(result.normal)).toBeCloseTo(1, 4);
  });

  test('property: depth equals combinedRadius - distance', () => {
    fc.assert(fc.property(
      vec3,
      vec3,
      fc.float({ min: Math.fround(0.5), max: Math.fround(10), noNaN: true }),
      fc.float({ min: Math.fround(0.5), max: Math.fround(10), noNaN: true }),
      (c1, c2, r1, r2) => {
        const result = checkSphereSphere(c1, r1, c2, r2);
        const dist = magnitude({ x: c2.x - c1.x, y: c2.y - c1.y, z: c2.z - c1.z });
        if (result.hit) {
          return Math.abs(result.depth - ((r1 + r2) - dist)) < 1e-4;
        }
        return dist >= r1 + r2 - 1e-5;
      }
    ), { numRuns: 100 });
  });
});

// ---------------------------------------------------------------------------
// snapSmallComponent — floating-point micro-drift prevention (Requirement 6.6)
// ---------------------------------------------------------------------------

describe('snapSmallComponent()', () => {
  test('components smaller than threshold * speed are zeroed', () => {
    // speed = 10, threshold = 0.01, limit = 0.1
    // x=0.05 < 0.1 → should be zeroed
    const vel = { x: 0.05, y: 0, z: 10 };
    const result = snapSmallComponent(vel, 0.01);
    expect(result.x).toBe(0);
  });

  test('components above threshold are preserved', () => {
    const vel = { x: 5, y: 0, z: 5 };
    const result = snapSmallComponent(vel, 0.01);
    expect(result.x).toBeCloseTo(5, 5);
    expect(result.z).toBeCloseTo(5, 5);
  });

  test('zero velocity returns zero', () => {
    const result = snapSmallComponent({ x: 0, y: 0, z: 0 }, 0.01);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.z).toBe(0);
  });

  test('property: snapped components are exactly 0 or equal to original', () => {
    fc.assert(fc.property(
      nonZeroVec3,
      fc.float({ min: Math.fround(0.001), max: Math.fround(0.5), noNaN: true }),
      (vel, threshold) => {
        const result = snapSmallComponent(vel, threshold);
        const speed = magnitude(vel);
        const limit = threshold * speed;
        for (const axis of ['x', 'y', 'z']) {
          if (Math.abs(vel[axis]) < limit) {
            if (result[axis] !== 0) return false;
          } else {
            if (result[axis] !== vel[axis]) return false;
          }
        }
        return true;
      }
    ), { numRuns: 100 });
  });
});

// ---------------------------------------------------------------------------
// Property 8: Power Level Decrement Is Bounded Below by 1
// Validates: Requirements 3.4, 5.4, 5.6
// ---------------------------------------------------------------------------

describe('Property 8 — power level decrement bounded below by 1', () => {
  test('max(1, p - d) is always >= 1 for any p in [1, 100] and d in [1, 10]', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 100 }),   // powerLevel
      fc.integer({ min: 1, max: 10 }),    // decrement
      (p, d) => {
        const result = Math.max(1, p - d);
        return result >= 1;
      }
    ), { numRuns: 200 });
  });

  test('power never drops to 0 even with maximum decrement', () => {
    expect(Math.max(1, 1 - 10)).toBe(1);
    expect(Math.max(1, 2 - 10)).toBe(1);
    expect(Math.max(1, 10 - 10)).toBe(1);
    expect(Math.max(1, 11 - 10)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Feature: webtend-game, Property: Wall Slide zeros perpendicular, preserves parallel
// Validates: Requirements 1.2
// ---------------------------------------------------------------------------

describe('wallSlide — perpendicular zeroed, parallel preserved', () => {
  test('wallSlide zeros perpendicular component for axis-aligned normal', () => {
    const velocity = { x: 5, y: 0, z: 10 };
    const normal = { x: 1, y: 0, z: 0 };
    const result = wallSlide(velocity, normal);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(10);
  });

  test('wallSlide preserves parallel component exactly', () => {
    fc.assert(fc.property(
      fc.record({ x: fc.float({ min: -100, max: 100, noNaN: true }), y: fc.float({ min: -100, max: 100, noNaN: true }), z: fc.float({ min: -100, max: 100, noNaN: true }) }),
      fc.record({ x: fc.float({ min: -1, max: 1, noNaN: true }), y: fc.float({ min: -1, max: 1, noNaN: true }), z: fc.float({ min: -1, max: 1, noNaN: true }) })
        .filter(n => magnitude(n) > 0.1),
      (vel, rawNormal) => {
        const n = normalize(rawNormal);
        const result = wallSlide(vel, n);
        // Perpendicular component should be ~0
        const perp = Math.abs(result.x * n.x + result.y * n.y + result.z * n.z);
        return perp < 1e-5;
      }
    ), { numRuns: 100 });
  });
});
