# Enemy-Enemy Collision Bugfix Design

## Overview

Enemy ships currently pass through each other with no physical interaction. The game loop in `Game.js` checks player-enemy and player-wall collisions, `EnemyAI.js` handles wall bouncing, but no code exists for enemy-enemy collision detection or response. This fix adds oriented capsule-capsule collision between enemies with heading-dependent deflection, giving enemy swarms emergent movement patterns while preserving all existing wall-bounce, player-collision, and explosion behaviors.

## Glossary

- **Bug_Condition (C)**: Two enemies whose oriented capsules intersect — the system currently ignores this overlap entirely
- **Property (P)**: When capsules intersect, both enemies are deflected based on contact geometry (nose hit = full reflection, side hit = partial deflection), pushed apart, and maintain constant speed
- **Preservation**: All existing behaviors (wall reflection, player-enemy collision, explosion hit detection, spawning, movement) remain unchanged
- **Oriented Capsule**: A swept sphere along a line segment — defined by a center position, a half-length along the heading axis, and a capsule radius. The line segment runs from `center - halfLength * heading` to `center + halfLength * heading`
- **capsuleHalfLength**: Half the length of the capsule's axis segment (e.g., 1.5 units)
- **capsuleRadius**: The radius of the swept sphere forming the capsule (e.g., 0.8 units)
- **noseFactor**: `abs(dot(enemy.heading, contactNormal))` — 1.0 means head-on contact, 0.0 means side contact
- **Closest-Point-on-Segment**: The classic algorithm to find the pair of points (one on each of two 3D line segments) with minimum Euclidean distance

## Bug Details

### Bug Condition

The bug manifests when two enemy ships occupy overlapping spatial volumes. The game loop in `Game.js` iterates enemies for player collision and calls `EnemyAI.update()` for wall collision, but never checks enemy-against-enemy. `Physics.js` has `checkSphereSphere` and `checkSphereAABB` but no capsule geometry functions. Enemies simply pass through each other as if the other does not exist.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type EnemyPair { enemy1: Enemy, enemy2: Enemy }
  OUTPUT: boolean

  // Fast pre-filter: bounding spheres must overlap
  LET dist = distance(input.enemy1.position, input.enemy2.position)
  LET combinedBounding = input.enemy1.boundingSphereRadius + input.enemy2.boundingSphereRadius
  IF dist >= combinedBounding THEN RETURN false

  // Expensive check: oriented capsule intersection
  LET seg1 = segment(
    input.enemy1.position - capsuleHalfLength * input.enemy1.heading,
    input.enemy1.position + capsuleHalfLength * input.enemy1.heading
  )
  LET seg2 = segment(
    input.enemy2.position - capsuleHalfLength * input.enemy2.heading,
    input.enemy2.position + capsuleHalfLength * input.enemy2.heading
  )
  LET closestDist = segmentSegmentDistance(seg1, seg2)
  RETURN closestDist < (input.enemy1.capsuleRadius + input.enemy2.capsuleRadius)
END FUNCTION
```

### Examples

- **Head-on corridor collision**: Two enemies moving toward each other in a narrow corridor. Their capsule axes are nearly collinear. noseFactor ≈ 1.0 → both get full heading reflection, reversing course.
- **Perpendicular side-swipe**: One enemy crosses another's path at 90°. Contact is on the side of enemy1's capsule. noseFactor ≈ 0.0 for one enemy → small angular deflection rather than full reversal.
- **Glancing overlap**: Two enemies moving nearly parallel pass close enough for capsule overlap but with minimal penetration. Both get a small nudge apart with partial deflection.
- **Non-colliding pair (no bug)**: Two enemies 20 units apart — bounding spheres don't overlap, no capsule test is performed, both continue on their current headings unchanged.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Enemy-wall collision (heading reflection off wall normals, position push-out) continues to work exactly as before via `EnemyAI.checkWallCollision()`
- Player-enemy collision (power decrement, velocity deflection, position separation) continues working in `Game.update()`
- Explosion sphere-vs-enemy-bounding-sphere hit detection remains unchanged (uses `enemy.radius`, not capsule geometry)
- Enemy straight-line movement along heading at constant `enemySpeed` between collisions
- Generator enemy spawning with heading toward player at spawn time
- Chain reaction logic, power level mechanics, and all HUD updates

**Scope:**
All game state mutations for enemy pairs that do NOT have overlapping capsules should be completely unaffected by this fix. This includes:
- Enemies that are far apart (bounding spheres don't overlap)
- Enemies whose bounding spheres overlap but capsules do not (near-miss)
- All player interactions (movement, wall collision, explosions)
- All generator behaviors (spawning, HP, destruction)

## Hypothesized Root Cause

Based on the bug analysis, the issue is missing functionality rather than broken existing code:

1. **No capsule geometry in the data model**: The `Enemy` typedef in `GameState.js` defines only `radius` (bounding sphere). There is no `capsuleHalfLength` or `capsuleRadius` property, so capsule collision cannot be performed even if the detection code existed.

2. **No capsule-capsule intersection function in Physics.js**: `Physics.js` has `checkSphereAABB` and `checkSphereSphere` but no segment-segment closest point algorithm or capsule-capsule test. The mathematical primitives needed for oriented capsule collision are entirely absent.

3. **No enemy-enemy collision loop in Game.js**: The `update()` method iterates enemies only for player-enemy collision. There is no pairwise enemy loop (`for i, for j > i`) anywhere in the codebase. Even if the detection function existed, it would never be called.

4. **No heading-dependent deflection logic**: `EnemyAI.reflect()` does a simple `v - 2(v·n)n` reflection suitable for walls. Enemy-enemy collision requires a more nuanced response based on whether contact is nose-on or side-on, which doesn't exist.

## Correctness Properties

Property 1: Bug Condition - Enemy-Enemy Capsule Collision Detection and Deflection

_For any_ pair of enemies whose oriented capsules intersect (isBugCondition returns true), the collision resolution SHALL deflect both enemies' headings based on contact geometry, push both enemies apart by half the penetration depth each so their capsules no longer overlap, and preserve each enemy's speed at exactly `enemySpeed`. No explosions or damage shall be triggered.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - Non-Colliding Enemy Pairs Unchanged

_For any_ pair of enemies whose oriented capsules do NOT intersect (isBugCondition returns false), the enemy-enemy collision system SHALL not modify either enemy's heading, position, or velocity. All existing behaviors (wall reflection, player collision, movement, spawning, explosion detection) shall produce identical results to the original code.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

Property 3: Capsule-Capsule Intersection Correctness

_For any_ two oriented capsules defined by line segments and radii, the intersection test SHALL return `hit=true` if and only if the minimum distance between the two line segments is less than the sum of their capsule radii. The returned contact normal SHALL point from the closest point on segment 1 toward the closest point on segment 2, and penetration depth SHALL equal `(r1 + r2) - segmentDistance`.

**Validates: Requirements 2.1, 2.7**

Property 4: Heading-Dependent Deflection Preserves Speed

_For any_ collision resolution where noseFactor is computed as `abs(dot(heading, contactNormal))`, the resulting new heading SHALL be a unit vector, and the enemy's velocity magnitude after deflection SHALL equal `enemySpeed` exactly. The deflection angle SHALL increase monotonically with noseFactor (nose hits deflect more than side hits).

**Validates: Requirements 2.2, 2.3, 2.5**

Property 5: Bounding Sphere Pre-Filter Soundness

_For any_ pair of enemies, if their bounding spheres do NOT overlap (distance between centers ≥ sum of bounding sphere radii), then their capsules cannot overlap either (the bounding sphere fully contains the capsule). The pre-filter SHALL never produce false negatives — it may produce false positives (spheres overlap but capsules don't) which are resolved by the capsule test.

**Validates: Requirements 2.7, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `GameState.js`

**Change**: Add capsule properties to the Enemy typedef

**Specific Changes**:
1. **Enemy typedef update**: Add `capsuleHalfLength` (number) and `capsuleRadius` (number) to the JSDoc typedef
2. **Enemy spawn in Game.js**: Set `capsuleHalfLength: 1.5` and `capsuleRadius: 0.8` at spawn time alongside the existing `radius: 1.0` (bounding sphere remains separate for explosion detection)
3. **Bounding sphere radius**: Ensure the bounding sphere radius is at least `capsuleHalfLength + capsuleRadius` so the pre-filter is sound. Update spawn to set `radius` to a value that encloses the capsule (e.g., `Math.sqrt(capsuleHalfLength² + capsuleRadius²)` ≈ 1.7, or simply `capsuleHalfLength + capsuleRadius = 2.3` for a conservative bound)

---

**File**: `Physics.js`

**Function**: New — `closestPointsOnSegments(p1, d1, p2, d2)`

**Specific Changes**:
1. **Segment-segment closest point**: Implement the classic algorithm using parametric representation. Each segment is `P(s) = p + s*d` for `s ∈ [0,1]`. Compute the parameters `s` and `t` that minimize `|P1(s) - P2(t)|²`, clamping both to [0,1]. Return the two closest points and the distance between them.
2. **Degenerate cases**: Handle parallel segments (cross product near zero) by projecting one endpoint onto the other segment and picking the closest.

---

**File**: `Physics.js`

**Function**: New — `checkCapsuleCapsule(pos1, heading1, halfLen1, radius1, pos2, heading2, halfLen2, radius2)`

**Specific Changes**:
1. **Build segments**: Compute segment endpoints from position ± halfLength × heading for each capsule
2. **Call closestPointsOnSegments**: Get the closest pair of points and their distance
3. **Intersection test**: If distance < radius1 + radius2, return `{ hit: true, normal, depth }` where normal points from closest point on seg1 toward closest point on seg2, depth = (r1 + r2) - distance
4. **No-hit return**: `{ hit: false, normal: {x:0,y:0,z:0}, depth: 0 }`

---

**File**: `Physics.js`

**Function**: New — `computeDeflection(heading, contactNormal, enemySpeed)`

**Specific Changes**:
1. **Compute noseFactor**: `abs(dot(heading, contactNormal))`
2. **Full reflection**: `reflect(heading, contactNormal)` — standard v - 2(v·n)n
3. **Partial deflection**: `normalize(heading + deflectionStrength * contactNormal)` where deflectionStrength is a tunable constant (e.g., 0.3)
4. **Blend**: `newHeading = normalize(lerp(partialDeflection, fullReflection, noseFactor))`
5. **Return**: The new heading (unit vector) and the resulting velocity = `newHeading * enemySpeed`

---

**File**: `Game.js`

**Function**: Modified — `update(dt)`

**Specific Changes**:
1. **Add enemy-enemy collision loop**: After the existing `EnemyAI.update()` loop for all enemies, add a nested loop: `for (let i = 0; i < enemies.length; i++)` / `for (let j = i + 1; j < enemies.length; j++)`
2. **Bounding sphere pre-filter**: Check `checkSphereSphere(enemy_i.position, enemy_i.radius, enemy_j.position, enemy_j.radius)`. If no hit, skip (cheap early-out).
3. **Capsule-capsule test**: Call `Physics.checkCapsuleCapsule(...)` with both enemies' capsule parameters. If no hit, skip.
4. **Apply deflection**: Call `Physics.computeDeflection()` for each enemy with the contact normal (negated for the second enemy). Update both enemies' headings and velocities.
5. **Separation**: Push both enemies apart by `depth / 2` along the contact normal (enemy_i moves in -normal direction, enemy_j in +normal direction).

---

**File**: `Game.js`

**Function**: Modified — enemy spawn block

**Specific Changes**:
1. **Add capsule properties at spawn**: When creating the enemy object in the spawning section, add `capsuleHalfLength: 1.5` and `capsuleRadius: 0.8` (or read from config if made configurable)
2. **Adjust bounding sphere radius**: Set `radius` to a value that fully encloses the capsule for the pre-filter to be sound (e.g., `capsuleHalfLength + capsuleRadius = 2.3`)

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (enemies passing through each other), then verify the fix works correctly (deflection, separation) and preserves existing behavior (wall bounce, player collision, explosions).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that the system currently performs no enemy-enemy collision detection.

**Test Plan**: Create pairs of enemies on collision courses and step the game loop. Assert that after the step, enemies whose capsules overlap have NOT been deflected (demonstrating the bug exists). Run these on the UNFIXED code.

**Test Cases**:
1. **Head-on collision test**: Place two enemies facing each other 2 units apart. Step the loop. Verify they pass through each other (positions cross over) — this demonstrates the bug.
2. **Side-swipe test**: Place two enemies on perpendicular paths that intersect. Step until overlap. Verify no heading change occurs — demonstrates the bug.
3. **Multi-enemy pile-up**: Place 5 enemies at the same position with different headings. Step the loop. Verify all remain at the same position — demonstrates no collision response.
4. **Bounding sphere overlap but no capsule overlap**: Place two enemies close but with perpendicular headings so capsules don't quite touch. Verify nothing happens (this should also not trigger after the fix).

**Expected Counterexamples**:
- Enemies pass through each other with zero heading or position modification
- Multiple enemies stack on identical positions with no physical interaction
- Demonstrates that no enemy-enemy collision code path exists

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (capsules intersect), the fixed function deflects both enemies and separates them.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := resolveEnemyEnemyCollision(input.enemy1, input.enemy2)
  ASSERT capsules no longer overlap after resolution
  ASSERT magnitude(result.enemy1.velocity) == enemySpeed
  ASSERT magnitude(result.enemy2.velocity) == enemySpeed
  ASSERT at least one heading changed
  ASSERT no explosions triggered
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (capsules don't intersect), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT enemyAfterUpdate_original(input) == enemyAfterUpdate_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random enemy configurations (positions, headings, speeds) automatically
- It catches edge cases like near-miss capsule configurations that manual tests would miss
- It provides strong guarantees that non-colliding pairs pass through the new code path unchanged

**Test Plan**: Observe behavior on UNFIXED code for non-overlapping enemy pairs (they move in straight lines, bounce off walls, don't interact with each other). Write property-based tests that generate random non-overlapping enemy configurations and verify the fixed code produces identical position/heading/velocity updates.

**Test Cases**:
1. **Wall bounce preservation**: Generate random enemy positions near walls with no other enemy nearby. Verify wall reflection behaves identically after the fix.
2. **Straight-line movement preservation**: Generate random enemy positions far from each other. Verify they continue moving at `enemySpeed` along their heading with no deflection.
3. **Player-enemy collision preservation**: Generate a player-enemy collision scenario with no other enemies nearby. Verify power decrement and deflection behavior is unchanged.
4. **Explosion hit detection preservation**: Generate random explosion centers and enemy positions. Verify the explosion system uses bounding sphere radius (not capsule) and produces identical hit results.

### Unit Tests

- Test `closestPointsOnSegments` with known geometric configurations (parallel segments, perpendicular segments, skew segments, degenerate zero-length segments)
- Test `checkCapsuleCapsule` returns correct hit/miss for known capsule configurations
- Test `computeDeflection` produces unit-vector headings for various noseFactor values
- Test that noseFactor = 1.0 gives full reflection and noseFactor = 0.0 gives minimal deflection
- Test separation pushes enemies apart so capsules no longer overlap
- Test the bounding sphere pre-filter rejects far-apart pairs without calling capsule test

### Property-Based Tests

- Generate random pairs of capsules (random positions, headings, half-lengths, radii) and verify: if `checkCapsuleCapsule` returns `hit=true`, the contact normal points from seg1's closest point toward seg2's closest point
- Generate random non-intersecting capsule pairs and verify `hit=false`
- Generate random colliding enemy pairs and verify: after deflection, both velocities have magnitude exactly `enemySpeed` (within floating-point tolerance)
- Generate random colliding enemy pairs and verify: after separation, capsules no longer intersect
- Generate random non-colliding enemy pairs and verify: the collision loop does not modify their heading, position, or velocity

### Integration Tests

- Run the full game loop with 10+ enemies in a confined space and verify no enemy passes through another
- Run the full game loop and verify frame time stays under 33ms (30 FPS) with 50 enemies
- Verify that explosion chain reactions still correctly destroy enemies after the collision fix is in place
- Verify that player-enemy collisions still decrement power level when enemies are also colliding with each other
