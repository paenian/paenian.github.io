// Feature: enemy-enemy-collision
// Bug Condition Exploration Tests — Enemy-Enemy Collision
// Demonstrates that enemies currently pass through each other with no collision response.
// Validates: Requirements 1.1, 1.2, 1.3 from bugfix spec

import { describe, test, expect } from 'vitest';
import { EnemyAI } from '../EnemyAI.js';
import * as Physics from '../Physics.js';

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
// Bug Condition Tests — These demonstrate the bug EXISTS on unfixed code
// ---------------------------------------------------------------------------

describe('Enemy-Enemy Bug Condition: enemies pass through each other', () => {
  const config = { enemySpeed: 10, avoidRadius: 5 };
  const ai = new EnemyAI(config);

  test('Test 1: Two enemies facing each other 2 units apart pass through with NO heading change', () => {
    // Enemy A at x=-1 heading +x, Enemy B at x=+1 heading -x
    // They are 2 units apart, moving toward each other at speed 10
    const enemyA = makeEnemy({ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    const enemyB = makeEnemy({ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 });

    const headingA_before = { ...enemyA.heading };
    const headingB_before = { ...enemyB.heading };

    // Step both enemies forward (dt=0.1 → each moves 1 unit)
    ai.update(enemyA, { x: 0, y: 0, z: 0 }, [], 0.1);
    ai.update(enemyB, { x: 0, y: 0, z: 0 }, [], 0.1);

    // BUG DEMONSTRATION: headings are unchanged — no enemy-enemy collision detected
    expect(enemyA.heading.x).toBeCloseTo(headingA_before.x, 4);
    expect(enemyA.heading.y).toBeCloseTo(headingA_before.y, 4);
    expect(enemyA.heading.z).toBeCloseTo(headingA_before.z, 4);

    expect(enemyB.heading.x).toBeCloseTo(headingB_before.x, 4);
    expect(enemyB.heading.y).toBeCloseTo(headingB_before.y, 4);
    expect(enemyB.heading.z).toBeCloseTo(headingB_before.z, 4);

    // They have crossed each other's original positions (passed through)
    // enemyA started at x=-1, moved +1 → x=0
    // enemyB started at x=+1, moved -1 → x=0
    // Both are now at x=0, overlapping — no collision response occurred
    expect(enemyA.position.x).toBeCloseTo(0, 4);
    expect(enemyB.position.x).toBeCloseTo(0, 4);
  });

  test('Test 2: Two enemies at same position with different headings — no heading change', () => {
    // Both enemies at the origin but heading in different directions
    const enemyA = makeEnemy({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    const enemyB = makeEnemy({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

    const headingA_before = { ...enemyA.heading };
    const headingB_before = { ...enemyB.heading };

    // Step forward
    ai.update(enemyA, { x: 0, y: 0, z: 0 }, [], 0.016);
    ai.update(enemyB, { x: 0, y: 0, z: 0 }, [], 0.016);

    // BUG DEMONSTRATION: Despite being at the same position, no collision occurred
    expect(enemyA.heading.x).toBeCloseTo(headingA_before.x, 4);
    expect(enemyA.heading.y).toBeCloseTo(headingA_before.y, 4);
    expect(enemyA.heading.z).toBeCloseTo(headingA_before.z, 4);

    expect(enemyB.heading.x).toBeCloseTo(headingB_before.x, 4);
    expect(enemyB.heading.y).toBeCloseTo(headingB_before.y, 4);
    expect(enemyB.heading.z).toBeCloseTo(headingB_before.z, 4);
  });

  test('Test 3: After fix — overlapping capsules should cause at least one heading change (EXPECTED TO FAIL on unfixed code)', () => {
    // Set up two enemies with overlapping capsule regions
    // capsuleHalfLength=1.5, capsuleRadius=0.8
    // Place them 1.0 unit apart (well within capsule overlap range of r1+r2=1.6)
    const enemyA = makeEnemy({ x: -0.5, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    enemyA.capsuleHalfLength = 1.5;
    enemyA.capsuleRadius = 0.8;

    const enemyB = makeEnemy({ x: 0.5, y: 0, z: 0 }, { x: -1, y: 0, z: 0 });
    enemyB.capsuleHalfLength = 1.5;
    enemyB.capsuleRadius = 0.8;

    const headingA_before = { ...enemyA.heading };
    const headingB_before = { ...enemyB.heading };

    // Attempt to call the capsule collision resolution (doesn't exist yet)
    // This test exercises the EXPECTED behavior after the fix is applied
    const hasCapsuleCheck = typeof Physics.checkCapsuleCapsule === 'function';
    const hasDeflection = typeof Physics.computeDeflection === 'function';

    if (hasCapsuleCheck && hasDeflection) {
      const result = Physics.checkCapsuleCapsule(
        enemyA.position, enemyA.heading, enemyA.capsuleHalfLength, enemyA.capsuleRadius,
        enemyB.position, enemyB.heading, enemyB.capsuleHalfLength, enemyB.capsuleRadius
      );

      if (result.hit) {
        const newHeadingA = Physics.computeDeflection(enemyA.heading, result.normal, 10);
        const newHeadingB = Physics.computeDeflection(enemyB.heading, { x: -result.normal.x, y: -result.normal.y, z: -result.normal.z }, 10);

        // At least one heading must change
        const headingAChanged = 
          Math.abs(newHeadingA.heading.x - headingA_before.x) > 0.01 ||
          Math.abs(newHeadingA.heading.y - headingA_before.y) > 0.01 ||
          Math.abs(newHeadingA.heading.z - headingA_before.z) > 0.01;

        const headingBChanged =
          Math.abs(newHeadingB.heading.x - headingB_before.x) > 0.01 ||
          Math.abs(newHeadingB.heading.y - headingB_before.y) > 0.01 ||
          Math.abs(newHeadingB.heading.z - headingB_before.z) > 0.01;

        expect(headingAChanged || headingBChanged).toBe(true);
      }
    } else {
      // Physics.checkCapsuleCapsule or Physics.computeDeflection doesn't exist yet — FAIL to demonstrate bug
      expect(hasCapsuleCheck).toBe(true);
    }
  });
});
