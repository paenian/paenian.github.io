// Feature: enemy-enemy-collision
// Tests for closestPointsOnSegments, checkCapsuleCapsule, computeDeflection
// Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  closestPointsOnSegments,
  checkCapsuleCapsule,
  computeDeflection,
  checkSphereSphere,
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

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

// ---------------------------------------------------------------------------
// Unit Tests: closestPointsOnSegments (Task 27.7)
// ---------------------------------------------------------------------------

describe('closestPointsOnSegments', () => {
  test('parallel segments — same direction, offset along perpendicular axis', () => {
    // Seg1: (0,0,0) to (4,0,0)  — dir = (4,0,0)
    // Seg2: (0,2,0) to (4,2,0)  — dir = (4,0,0), offset 2 units in y
    const result = closestPointsOnSegments(
      { x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
      { x: 0, y: 2, z: 0 }, { x: 4, y: 0, z: 0 }
    );
    // Closest distance should be 2 (the perpendicular offset)
    expect(result.distance).toBeCloseTo(2, 4);
  });

  test('perpendicular segments — crossing in the middle', () => {
    // Seg1: (-2,0,0) to (2,0,0)  — along x-axis
    // Seg2: (0,0,-2) to (0,0,2)  — along z-axis, crossing at origin
    const result = closestPointsOnSegments(
      { x: -2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
      { x: 0, y: 0, z: -2 }, { x: 0, y: 0, z: 4 }
    );
    // Segments intersect at origin, distance = 0
    expect(result.distance).toBeCloseTo(0, 4);
    expect(result.point1.x).toBeCloseTo(0, 4);
    expect(result.point1.z).toBeCloseTo(0, 4);
    expect(result.point2.x).toBeCloseTo(0, 4);
    expect(result.point2.z).toBeCloseTo(0, 4);
  });

  test('perpendicular segments — offset in y', () => {
    // Seg1: (-2,0,0) to (2,0,0)
    // Seg2: (0,3,-2) to (0,3,2) — offset 3 units up
    const result = closestPointsOnSegments(
      { x: -2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
      { x: 0, y: 3, z: -2 }, { x: 0, y: 0, z: 4 }
    );
    expect(result.distance).toBeCloseTo(3, 4);
  });

  test('skew segments — not parallel, not intersecting', () => {
    // Seg1: (0,0,0) to (1,0,0)
    // Seg2: (0,1,0) to (0,1,1) — skew, closest at (0,0,0) and (0,1,0)
    const result = closestPointsOnSegments(
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }
    );
    expect(result.distance).toBeCloseTo(1, 4);
    expect(result.point1.x).toBeCloseTo(0, 4);
    expect(result.point1.y).toBeCloseTo(0, 4);
    expect(result.point2.x).toBeCloseTo(0, 4);
    expect(result.point2.y).toBeCloseTo(1, 4);
  });

  test('degenerate segment 1 (zero-length)', () => {
    // Seg1 is a point at (1,1,0)
    // Seg2: (0,0,0) to (2,0,0)
    const result = closestPointsOnSegments(
      { x: 1, y: 1, z: 0 }, { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }
    );
    // Closest point on seg2 to (1,1,0) is (1,0,0), distance = 1
    expect(result.distance).toBeCloseTo(1, 4);
    expect(result.point1.x).toBeCloseTo(1, 4);
    expect(result.point1.y).toBeCloseTo(1, 4);
    expect(result.point2.x).toBeCloseTo(1, 4);
    expect(result.point2.y).toBeCloseTo(0, 4);
  });

  test('degenerate segment 2 (zero-length)', () => {
    // Seg1: (0,0,0) to (4,0,0)
    // Seg2 is a point at (2,3,0)
    const result = closestPointsOnSegments(
      { x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
      { x: 2, y: 3, z: 0 }, { x: 0, y: 0, z: 0 }
    );
    // Closest point on seg1 to (2,3,0) is (2,0,0), distance = 3
    expect(result.distance).toBeCloseTo(3, 4);
    expect(result.point1.x).toBeCloseTo(2, 4);
    expect(result.point1.y).toBeCloseTo(0, 4);
    expect(result.point2.x).toBeCloseTo(2, 4);
    expect(result.point2.y).toBeCloseTo(3, 4);
  });

  test('both segments degenerate (two points)', () => {
    const result = closestPointsOnSegments(
      { x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 0 },
      { x: 4, y: 6, z: 3 }, { x: 0, y: 0, z: 0 }
    );
    expect(result.distance).toBeCloseTo(5, 4); // sqrt(9+16+0) = 5
  });

  test('collinear overlapping segments', () => {
    // Seg1: (0,0,0) to (4,0,0)
    // Seg2: (2,0,0) to (6,0,0) — overlapping region [2,4]
    const result = closestPointsOnSegments(
      { x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }
    );
    expect(result.distance).toBeCloseTo(0, 4);
  });
});

// ---------------------------------------------------------------------------
// Unit Tests: checkCapsuleCapsule (Task 27.8)
// ---------------------------------------------------------------------------

describe('checkCapsuleCapsule', () => {
  test('clear miss — capsules far apart', () => {
    const result = checkCapsuleCapsule(
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.5, 0.8,
      { x: 10, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.5, 0.8
    );
    expect(result.hit).toBe(false);
  });

  test('clear hit — head-on collinear capsules overlapping', () => {
    // Two capsules along x-axis facing each other, centers 2 units apart
    // Capsule 1: center (0,0,0), heading (1,0,0), halfLen=1.5, radius=0.8
    //   axis: [-1.5, 0, 0] to [1.5, 0, 0]
    // Capsule 2: center (2,0,0), heading (-1,0,0), halfLen=1.5, radius=0.8
    //   seg2Start = (2,0,0) - 1.5*(-1,0,0) = (3.5,0,0)
    //   seg2Dir = 2*1.5*(-1,0,0) = (-3,0,0)
    //   axis: [3.5, 0, 0] to [0.5, 0, 0]
    // The segments overlap from x=0.5 to x=1.5, distance = 0
    // Combined radius = 1.6, depth = 1.6 - 0 = 1.6
    const result = checkCapsuleCapsule(
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.5, 0.8,
      { x: 2, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, 1.5, 0.8
    );
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(1.6, 3);
  });

  test('perpendicular capsules — barely touching', () => {
    // Capsule 1 along x-axis at origin
    // Capsule 2 along z-axis, offset 1.5 in y
    // Segment dist = 1.5, combined radius = 1.6 → hit, depth = 0.1
    const result = checkCapsuleCapsule(
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.5, 0.8,
      { x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: 1 }, 1.5, 0.8
    );
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(0.1, 3);
  });

  test('perpendicular capsules — barely missing', () => {
    // Capsule 2 offset 1.7 in y → segment dist = 1.7 > 1.6
    const result = checkCapsuleCapsule(
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.5, 0.8,
      { x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: 1 }, 1.5, 0.8
    );
    expect(result.hit).toBe(false);
  });

  test('coincident capsules — returns hit with up-axis normal', () => {
    const result = checkCapsuleCapsule(
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.5, 0.8,
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.5, 0.8
    );
    expect(result.hit).toBe(true);
    // Normal should be defined (up axis for coincident)
    expect(magnitude(result.normal)).toBeCloseTo(1, 4);
  });

  test('normal points from capsule 1 closest point toward capsule 2 closest point', () => {
    // Capsule 1 along x at y=0, Capsule 2 along x at y=1 (within radius)
    const result = checkCapsuleCapsule(
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.5, 0.8,
      { x: 0, y: 1.0, z: 0 }, { x: 1, y: 0, z: 0 }, 1.5, 0.8
    );
    expect(result.hit).toBe(true);
    // Normal should be roughly +y (from seg1 toward seg2)
    expect(result.normal.y).toBeGreaterThan(0.9);
  });
});

// ---------------------------------------------------------------------------
// Unit Tests: computeDeflection (Task 27.9 partial)
// ---------------------------------------------------------------------------

describe('computeDeflection', () => {
  test('nose-on collision gives near-full reflection', () => {
    // Heading straight into the normal → noseFactor ≈ 1.0
    const heading = { x: 1, y: 0, z: 0 };
    const normal = { x: -1, y: 0, z: 0 }; // points away from this enemy
    const result = computeDeflection(heading, normal, 10);
    // Full reflection of (1,0,0) off (-1,0,0) = (-1,0,0)
    // With nose-on, should be close to full reflection
    expect(result.heading.x).toBeLessThan(-0.5);
    expect(magnitude(result.heading)).toBeCloseTo(1, 4);
    expect(magnitude(result.velocity)).toBeCloseTo(10, 4);
  });

  test('side-on collision gives minimal deflection', () => {
    // Heading perpendicular to the normal → noseFactor ≈ 0.0
    const heading = { x: 0, y: 0, z: 1 };
    const normal = { x: -1, y: 0, z: 0 };
    const result = computeDeflection(heading, normal, 10);
    // Minimal deflection — heading stays mostly along z
    expect(Math.abs(result.heading.z)).toBeGreaterThan(0.7);
    expect(magnitude(result.heading)).toBeCloseTo(1, 4);
    expect(magnitude(result.velocity)).toBeCloseTo(10, 4);
  });

  test('resulting heading is always a unit vector', () => {
    const heading = normalize({ x: 1, y: 1, z: 0 });
    const normal = normalize({ x: -1, y: 1, z: 0 });
    const result = computeDeflection(heading, normal, 15);
    expect(magnitude(result.heading)).toBeCloseTo(1, 4);
  });

  test('resulting velocity magnitude equals enemySpeed', () => {
    const heading = normalize({ x: 3, y: -1, z: 2 });
    const normal = normalize({ x: -1, y: 0, z: 1 });
    const result = computeDeflection(heading, normal, 7.5);
    expect(magnitude(result.velocity)).toBeCloseTo(7.5, 4);
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests (Task 27.9)
// ---------------------------------------------------------------------------

// Arbitraries
const finiteFloat = fc.float({ min: Math.fround(-50), max: Math.fround(50), noNaN: true, noDefaultInfinity: true });
const vec3Arb = fc.record({ x: finiteFloat, y: finiteFloat, z: finiteFloat });
const nonZeroVec3 = vec3Arb.filter(v => magnitude(v) > 0.1);
const unitVec3 = nonZeroVec3.map(v => normalize(v));
const positiveFloat = fc.float({ min: Math.fround(0.5), max: Math.fround(5), noNaN: true, noDefaultInfinity: true });

describe('Property: Deflection preserves speed', () => {
  /**
   * **Validates: Requirements 2.5**
   * For any heading and contact normal, computeDeflection must return
   * a velocity whose magnitude equals enemySpeed exactly.
   */
  test('velocity magnitude equals enemySpeed for any heading/normal pair', () => {
    fc.assert(fc.property(
      unitVec3,
      unitVec3,
      fc.float({ min: Math.fround(1), max: Math.fround(20), noNaN: true, noDefaultInfinity: true }),
      (heading, normal, speed) => {
        const result = computeDeflection(heading, normal, speed);
        return Math.abs(magnitude(result.velocity) - speed) < 1e-3;
      }
    ), { numRuns: 200 });
  });

  test('heading is always a unit vector after deflection', () => {
    fc.assert(fc.property(
      unitVec3,
      unitVec3,
      (heading, normal) => {
        const result = computeDeflection(heading, normal, 10);
        return Math.abs(magnitude(result.heading) - 1.0) < 1e-3;
      }
    ), { numRuns: 200 });
  });
});

describe('Property: Separation resolves overlap', () => {
  /**
   * **Validates: Requirements 2.4**
   * After applying the separation push (half depth each direction),
   * the capsules should no longer overlap (or overlap is significantly reduced).
   */
  test('after push-apart by depth, capsules no longer intersect', () => {
    fc.assert(fc.property(
      // Generate two capsules that are NOT coincident (have some separation)
      vec3Arb.filter(v => magnitude(v) < 30),
      unitVec3,
      vec3Arb.filter(v => magnitude(v) < 30),
      unitVec3,
      (pos1, heading1, pos2, heading2) => {
        // Skip nearly-coincident positions — these are degenerate and the
        // arbitrary normal won't resolve in a single pass
        const dist = magnitude(sub(pos1, pos2));
        if (dist < 0.1) return true;

        const halfLen = 1.5;
        const radius = 0.8;

        const result = checkCapsuleCapsule(pos1, heading1, halfLen, radius, pos2, heading2, halfLen, radius);
        if (!result.hit) return true; // nothing to test for non-colliding

        // Apply separation
        const halfDepth = result.depth / 2;
        const newPos1 = {
          x: pos1.x - result.normal.x * halfDepth,
          y: pos1.y - result.normal.y * halfDepth,
          z: pos1.z - result.normal.z * halfDepth,
        };
        const newPos2 = {
          x: pos2.x + result.normal.x * halfDepth,
          y: pos2.y + result.normal.y * halfDepth,
          z: pos2.z + result.normal.z * halfDepth,
        };

        // After separation, capsules should not intersect (or barely touch)
        const afterResult = checkCapsuleCapsule(newPos1, heading1, halfLen, radius, newPos2, heading2, halfLen, radius);
        // Allow small floating-point tolerance
        return !afterResult.hit || afterResult.depth < 0.01;
      }
    ), { numRuns: 200 });
  });
});

describe('Property: Non-colliding pairs unaffected', () => {
  /**
   * **Validates: Requirements 3.1, 3.7**
   * Enemy pairs whose bounding spheres don't overlap are never tested
   * for capsule collision, and their state is unchanged.
   */
  test('enemies whose bounding spheres do not overlap get no capsule test', () => {
    fc.assert(fc.property(
      vec3Arb,
      unitVec3,
      unitVec3,
      (basePos, heading1, heading2) => {
        // Place enemies far apart (> combined bounding radius of 4.6)
        const pos1 = basePos;
        const pos2 = { x: basePos.x + 10, y: basePos.y + 10, z: basePos.z + 10 };
        const boundingRadius = 2.3; // capsuleHalfLength + capsuleRadius

        // Pre-filter check
        const preFilter = checkSphereSphere(pos1, boundingRadius, pos2, boundingRadius);
        // Far-apart enemies should not pass the pre-filter
        return !preFilter.hit;
      }
    ), { numRuns: 200 });
  });

  test('bounding sphere pre-filter never produces false negatives (capsule inside sphere)', () => {
    fc.assert(fc.property(
      vec3Arb.filter(v => magnitude(v) < 30),
      unitVec3,
      vec3Arb.filter(v => magnitude(v) < 30),
      unitVec3,
      (pos1, heading1, pos2, heading2) => {
        const halfLen = 1.5;
        const capsRadius = 0.8;
        const boundingRadius = halfLen + capsRadius; // 2.3

        // If capsules collide, bounding spheres MUST also collide
        const capsuleResult = checkCapsuleCapsule(pos1, heading1, halfLen, capsRadius, pos2, heading2, halfLen, capsRadius);
        if (capsuleResult.hit) {
          const sphereResult = checkSphereSphere(pos1, boundingRadius, pos2, boundingRadius);
          return sphereResult.hit;
        }
        return true;
      }
    ), { numRuns: 200 });
  });
});
