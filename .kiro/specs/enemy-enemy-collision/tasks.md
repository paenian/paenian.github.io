# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Enemy-Enemy Capsule Collision Not Detected
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate enemies pass through each other with no collision response
  - **Scoped PBT Approach**: Place two enemies on direct collision courses (head-on, perpendicular, glancing) and step the game loop. Assert that after the step, colliding enemies SHOULD have deflected headings and been pushed apart — this will FAIL on unfixed code because no enemy-enemy collision code exists.
  - Create test file: `tests/enemyEnemyCollision.test.js`
  - Test scenario 1: Two enemies facing each other 2 units apart with `capsuleHalfLength: 1.5`, `capsuleRadius: 0.8` — their capsules clearly overlap. Assert headings changed and positions separated after resolution. (Will FAIL — demonstrates bug)
  - Test scenario 2: Two enemies on perpendicular paths with capsules intersecting at the cross point. Assert at least one heading changed. (Will FAIL — demonstrates bug)
  - Test scenario 3: Five enemies stacked at same position with different headings. Assert they are pushed apart. (Will FAIL — demonstrates bug)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists: no enemy-enemy collision detection or response occurs)
  - Document counterexamples found: enemies pass through each other with zero heading or position modification
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Colliding Enemy Behaviors Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **IMPORTANT**: Write these tests BEFORE implementing the fix
  - Observe on UNFIXED code: enemies move in straight lines along their heading at `enemySpeed`
  - Observe on UNFIXED code: enemies bounce off walls via `EnemyAI.checkWallCollision()` with heading reflection
  - Observe on UNFIXED code: player-enemy collision decrements power and deflects both
  - Observe on UNFIXED code: explosion sphere-vs-enemy uses bounding sphere radius for hit detection
  - Write property-based tests in `tests/enemyEnemyCollision.test.js` (or separate file `tests/enemyPreservation.test.js`):
    - Property: For any pair of enemies whose capsules do NOT intersect, the collision system shall not modify either enemy's heading, position, or velocity
    - Property: Enemy wall reflection produces identical heading after fix (test EnemyAI.update with walls)
    - Property: Enemy straight-line movement at `enemySpeed` is unchanged for isolated enemies
  - Use fast-check or similar PBT library to generate random non-overlapping enemy configurations
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 3. Implement enemy-enemy collision fix

  - [ ] 3.1 Add capsule properties to Enemy typedef and spawn
    - Update `GameState.js` Enemy typedef JSDoc to include `capsuleHalfLength` (number) and `capsuleRadius` (number)
    - Update enemy spawn block in `Game.js` to set `capsuleHalfLength: 1.5` and `capsuleRadius: 0.8`
    - Update enemy spawn block in `Game.js` to set `radius: 2.3` (capsuleHalfLength + capsuleRadius) so bounding sphere fully encloses capsule for pre-filter soundness
    - _Bug_Condition: isBugCondition(input) requires capsule geometry on enemy entities_
    - _Expected_Behavior: Enemies have capsule properties available for collision detection_
    - _Preservation: Explosion hit detection continues using `enemy.radius` (bounding sphere) — unchanged_
    - _Requirements: 2.1, 2.7, 3.6_

  - [ ] 3.2 Implement `closestPointsOnSegments(p1, d1, p2, d2)` in Physics.js
    - Add new exported function to `Physics.js`
    - Implement classic segment-segment closest point algorithm using parametric representation
    - Each segment: `P(s) = p + s*d` for `s ∈ [0,1]`
    - Compute parameters `s` and `t` minimizing `|P1(s) - P2(t)|²`, clamping both to [0,1]
    - Handle degenerate case: parallel segments (cross product magnitude near zero) — project one endpoint onto the other segment
    - Return `{ point1, point2, distance }` — the two closest points and Euclidean distance between them
    - _Bug_Condition: No segment-segment distance function exists in Physics.js_
    - _Expected_Behavior: Correctly computes minimum distance between two 3D line segments_
    - _Preservation: Existing Physics.js functions unchanged_
    - _Requirements: 2.1, 2.7_

  - [ ] 3.3 Implement `checkCapsuleCapsule(pos1, heading1, halfLen1, radius1, pos2, heading2, halfLen2, radius2)` in Physics.js
    - Add new exported function to `Physics.js`
    - Build segment endpoints: `pos ± halfLen * heading` for each capsule
    - Call `closestPointsOnSegments` with the two segments
    - Intersection test: if `distance < radius1 + radius2`, return `{ hit: true, normal, depth }`
    - Normal: unit vector from closest point on seg1 toward closest point on seg2
    - Depth: `(radius1 + radius2) - distance`
    - Handle degenerate case: coincident closest points — use arbitrary fallback normal `{x:0, y:1, z:0}`
    - No-hit return: `{ hit: false, normal: {x:0, y:0, z:0}, depth: 0 }`
    - _Bug_Condition: No capsule-capsule intersection test exists_
    - _Expected_Behavior: Returns hit/normal/depth for intersecting capsules per design_
    - _Preservation: No existing functions modified_
    - _Requirements: 2.1, 2.7_

  - [ ] 3.4 Implement `computeDeflection(heading, contactNormal, enemySpeed)` in Physics.js
    - Add new exported function to `Physics.js`
    - Compute `noseFactor = Math.abs(dot(heading, contactNormal))`
    - Full reflection: `reflect(heading, contactNormal)` (standard v - 2(v·n)n)
    - Partial deflection: `normalize(heading + 0.3 * contactNormal)` (deflectionStrength = 0.3)
    - Blend: `newHeading = normalize(lerp(partialDeflection, fullReflection, noseFactor))`
    - Return `{ heading: newHeading, velocity: scale(newHeading, enemySpeed) }`
    - Guarantee: returned heading is always a unit vector, velocity magnitude is exactly `enemySpeed`
    - _Bug_Condition: No heading-dependent deflection logic exists_
    - _Expected_Behavior: noseFactor=1.0 gives full reflection, noseFactor=0.0 gives minimal deflection_
    - _Preservation: Existing `reflect()` function unchanged_
    - _Requirements: 2.2, 2.3, 2.5_

  - [ ] 3.5 Add enemy-enemy collision loop in Game.js `update(dt)`
    - Add nested loop after the existing `EnemyAI.update()` loop: `for (let i = 0; ...) for (let j = i+1; ...)`
    - Skip if either enemy has `pendingRemoval`
    - Bounding sphere pre-filter: `Physics.checkSphereSphere(enemy_i.position, enemy_i.radius, enemy_j.position, enemy_j.radius)` — skip pair if no hit
    - Capsule-capsule test: `Physics.checkCapsuleCapsule(...)` with both enemies' capsule parameters — skip if no hit
    - Apply deflection: call `Physics.computeDeflection(enemy_i.heading, normal, enemySpeed)` and `Physics.computeDeflection(enemy_j.heading, negatedNormal, enemySpeed)` — update both enemies' headings and velocities
    - Separation: push enemy_i by `-normal * (depth/2)` and enemy_j by `+normal * (depth/2)`
    - No explosions or damage triggered (requirement 2.6)
    - _Bug_Condition: No enemy-enemy collision loop exists in Game.js update()_
    - _Expected_Behavior: All overlapping capsule pairs detected, deflected, and separated per frame_
    - _Preservation: Player-enemy collision, wall collision, explosion, spawning loops unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Enemy-Enemy Capsule Collision Detected and Resolved
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (deflection + separation)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — enemies now deflect and separate)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Colliding Enemy Behaviors Still Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — wall bounce, movement, player collision all unchanged)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `cd /Users/paulchase/github/paenian.github.io/webtend && npx vitest --run`
  - Ensure all existing tests (physics, enemyAI, explosion, hud, inputHandler, levelLoader, generator) still pass
  - Ensure new enemy-enemy collision tests pass
  - Ensure preservation tests pass
  - Ask the user if questions arise

---

## Task Dependency Graph

```
Task 1 (Bug Condition Exploration Test)
  └── No dependencies — written first on UNFIXED code

Task 2 (Preservation Property Tests)
  └── No dependencies — written on UNFIXED code, can run in parallel with Task 1

Task 3.1 (Capsule properties on Enemy typedef + spawn)
  └── Depends on: Task 1 and Task 2 complete (tests written before fix)

Task 3.2 (closestPointsOnSegments)
  └── Depends on: Task 3.1 (enemy entities have capsule geometry)

Task 3.3 (checkCapsuleCapsule)
  └── Depends on: Task 3.2 (uses closestPointsOnSegments)

Task 3.4 (computeDeflection)
  └── Depends on: None (pure function, can implement alongside 3.2/3.3)

Task 3.5 (Enemy-enemy collision loop in Game.js)
  └── Depends on: Task 3.1, 3.2, 3.3, 3.4 (all primitives must exist)

Task 3.6 (Verify exploration test passes)
  └── Depends on: Task 3.5 (fix must be implemented)

Task 3.7 (Verify preservation tests pass)
  └── Depends on: Task 3.5 (fix must be implemented)

Task 4 (Checkpoint)
  └── Depends on: Task 3.6, 3.7 (all verifications complete)
```
