# Implementation Plan: Webtend Game

## Overview

Implement a browser-based 3D action game under `/webtend/` as pure ES modules served by GitHub Pages. No build step — a single `<script type="importmap">` in `index.html` maps `three` and `three/addons/` to jsDelivr. The implementation is ordered: scaffold → pure logic + property tests → rendering subsystem → gameplay systems → integration wiring.

## Tasks

- [x] 1. Scaffold project structure and entry-point HTML
  - Create `/webtend/` directory with `index.html` containing the Three.js import map pointing to jsDelivr CDN, a `<canvas id="game-canvas">`, and the HUD HTML skeleton (power bar, generator bar container, level display)
  - Create empty stub files for all 10 JS modules (`main.js`, `Game.js`, `GameState.js`, `Renderer.js`, `InputHandler.js`, `Physics.js`, `ExplosionSystem.js`, `EnemyAI.js`, `HUD.js`, `LevelLoader.js`) so relative imports resolve without errors
  - Create `/webtend/levels/` directory with placeholder `level1.json` through `level5.json` files, each with valid skeleton JSON matching the schema (id, walls, generators, playerStart, config)
  - Create `/webtend/tests/` directory with empty test files: `physics.test.js`, `explosion.test.js`, `generator.test.js`, `levelLoader.test.js`, `hud.test.js`
  - Create a `package.json` in `/webtend/tests/` (or `/webtend/`) enabling `"type": "module"` and listing `vitest` and `fast-check` as dev dependencies; confirm `npx vitest --run` resolves
  - _Requirements: 9.1_

- [x] 2. Implement pure Physics module and property tests
  - [x] 2.1 Implement `Physics.js` with all pure vector functions: `reflect(velocity, wallNormal)`, `applyAcceleration(vel, dir, accel, maxSpeed, dt)`, `applyDeceleration(vel, decelRate, dt)`, `clampSpeed(vel, maxSpeed)`, `checkSphereAABB(sphereCenter, sphereRadius, aabb)`, `checkSphereSphere(c1, r1, c2, r2)`, `snapSmallComponent(vel, threshold)` — all operating on plain `{x, y, z}` objects with no Three.js imports
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.8, 1.9, 3.3, 6.2, 6.3, 6.6_

  - [x] 2.2 Write property test — Property 1: Ship thrust never exceeds max speed
    - **Property 1: Ship Thrust Acceleration Never Exceeds Maximum Speed**
    - For any initial velocity and positive dt, `applyAcceleration` result magnitude ≤ `maxSpeed`
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.9**

  - [x] 2.3 Write property test — Property 2: Deceleration reaches zero within 0.5 s
    - **Property 2: Ship Deceleration Reaches Zero Within Time Limit**
    - For any initial velocity ≤ 50, simulating `applyDeceleration` for 0.5 s yields magnitude ≤ ε
    - **Validates: Requirements 1.8**

  - [x] 2.4 Write property test — Property 7: Wall reflection preserves speed and reverses normal component
    - **Property 7: Wall Reflection Preserves Speed and Reverses Normal Component**
    - `|reflect(v, n)| = |v|`; normal component negated; perpendicular component preserved
    - **Validates: Requirements 3.3, 6.2, 6.3**

  - [x] 2.5 Write property test — Property 8: Power level decrement bounded below by 1
    - **Property 8: Power Level Decrement Is Bounded Below by 1**
    - `max(1, p - d)` is always ≥ 1 for any p in [1, 100] and d in [1, 10]
    - **Validates: Requirements 3.4, 5.4, 5.6**

- [x] 3. Implement `GameState.js` and shared data models
  - Define and export the `GameState` object with all fields: `phase`, `levelIndex`, `powerLevel`, `maxPowerLevel`, `enemies`, `generators`, `walls`, `config`, `chainDepth`, `explosionQueue`
  - Define and export the entity model shapes (`Enemy`, `Generator`, `PlayerShip`, `AABB`, `ExplosionJob`) as JSDoc typedefs so other modules can import them for documentation
  - Implement `GameState.reset(levelData)` to initialize state from a loaded level config
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.5_

- [x] 4. Implement `LevelLoader.js` and level JSON files
  - [x] 4.1 Implement `loadLevel(index)` using `fetch` + JSON parse wrapped in try/catch; implement `validateLevelData(data)` that throws a typed `LevelConfigError` for missing or out-of-range fields (walls, generators, playerStart, config with all required keys and value ranges)
    - _Requirements: 7.1, 7.2, 9.6_

  - [x] 4.2 Author the five level JSON files with distinct, valid configurations differing in at least one of: maze layout (wall counts/positions), number of generators, generator placement, or spawn interval; ensure Level N+1 spawn interval ≤ Level N interval; add open area large enough for 5+ chained explosions at initial power
    - _Requirements: 6.4, 6.5, 7.3, 7.4, 7.6_

  - [x] 4.3 Write example-based tests in `levelLoader.test.js`: mock `fetch` to return invalid JSON, missing fields, and out-of-range values; verify `LevelConfigError` is thrown and no game state is altered
    - _Requirements: 7.2, 9.6_

- [x] 5. Implement explosion formula and hit collection; property tests
  - [x] 5.1 Implement the pure, DOM-free parts of `ExplosionSystem.js`: `calcRadius(powerLevel, config)` returning `base_radius + powerLevel × radius_multiplier`, and `collectHits(center, radius, enemies, generators)` returning all entities whose bounding-sphere center is within `radius + entity.radius` of center
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 5.2_

  - [x] 5.2 Write property test — Property 4: Explosion radius is monotonically non-decreasing with power level
    - **Property 4: Explosion Radius Formula Is Monotonically Increasing with Power Level**
    - For p1 < p2 in [1, 100], `calcRadius(p1) ≤ calcRadius(p2)`
    - **Validates: Requirements 2.1, 5.2**

  - [x] 5.3 Write property test — Property 5: All in-radius enemies captured, none out-of-radius included
    - **Property 5: Explosion Blast Collection — All In-Radius Enemies Captured**
    - `collectHits` result equals exactly the set of entities within range
    - **Validates: Requirements 2.3, 2.4, 2.8**

  - [x] 5.4 Write property test — Property 10: Generator HP decreases by exactly one per explosion hit
    - **Property 10: Generator HP Decreases by Exactly One Per Explosion Hit**
    - After one explosion hit, new HP = `max(0, currentHp - 1)`
    - **Validates: Requirements 2.5**

- [x] 6. Implement generator and level progression logic; property tests
  - [x] 6.1 Implement the chain reward and power cap logic in `ExplosionSystem.js`: after chain drains, if `chainDepth ≥ chainThreshold` then `powerLevel = min(powerLevel + increment, maxPower)`; implement generator HP decrement on explosion hit, setting `pendingRemoval = true` when HP reaches zero
    - _Requirements: 2.6, 4.5, 4.6, 5.3_

  - [x] 6.2 Write property test — Property 6: Chain reaction power gain obeys threshold and maximum
    - **Property 6: Chain Reaction Power Gain Obeys Threshold and Maximum**
    - If `d ≥ chainThreshold`: new power = `min(p + increment, 100)`; otherwise unchanged
    - **Validates: Requirements 2.6, 5.3**

  - [x] 6.3 Write property test — Property 9: Generator HP bar fill ratio always in [0, 1]
    - **Property 9: Generator HP Bar Fill Ratio Is Always in [0, 1]**
    - `currentHp / maxHp` ∈ [0.0, 1.0] for any valid currentHp and maxHp
    - **Validates: Requirements 4.2**

  - [x] 6.4 Write property test — Property 11: Level spawn intervals non-increasing with floor at 0.5 s
    - **Property 11: Level Spawn Intervals Are Monotonically Non-Increasing with Floor**
    - Sequence of `max(0.5, prev × (1 - decreasePct))` is non-increasing and ≥ 0.5
    - **Validates: Requirements 4.5, 7.3**

  - [x] 6.5 Write property test — Property 12: Level generator counts non-decreasing with ceiling at 20
    - **Property 12: Level Generator Counts Are Monotonically Non-Decreasing with Ceiling**
    - Sequence of `min(20, prev + increment)` is non-decreasing and ≤ 20
    - **Validates: Requirements 7.4**

- [x] 7. Checkpoint — verify all pure-logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement `HUD.js` and CSS overlay
  - [x] 8.1 Implement `HUD.js` with all methods: `sync(gameState)`, `updatePowerBar(current, max)`, `updateGeneratorBars(generators)`, `updateLevel(levelIndex)`, `showLevelComplete()`, `hideLevelComplete()`, `showGameOver()`, `showWebGLError()`, `showAssetError(assetName)` — all using DOM manipulation only, no canvas drawing
    - _Requirements: 4.2, 4.3, 5.5, 8.1, 8.2, 8.3, 9.5_

  - [x] 8.2 Write CSS in `index.html` (or a linked stylesheet) for the HUD overlay: fixed-position container, power bar, generator bars list, level number; ensure legibility at 360–2560 px viewport widths with minimum 12 CSS px text and 6 CSS px bar height; use `width: X%` fill driven by JS
    - _Requirements: 8.4_

  - [x] 8.3 Write example-based tests in `hud.test.js`: verify `updatePowerBar` sets correct `width` percentage on the bar element; verify `showWebGLError` renders the correct message; verify `updateGeneratorBars` adds/removes bar elements to match the generator list
    - _Requirements: 5.5, 8.1, 8.2, 9.5_

- [x] 9. Implement `InputHandler.js`
  - Implement `InputHandler` class: maintain a `Set<string>` keyboard state via `keydown`/`keyup` events on `window`; implement `get keys()` returning `{w, a, s, d}` booleans; accumulate mouse deltas from `mousemove` events while pointer-locked into `{dx, dy}`; implement `get mouseDelta()` that returns the accumulated delta and resets it to `{0, 0}`; implement `requestPointerLock()` and `isPointerLocked()`
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 10. Implement `Renderer.js` with Three.js scene and camera rig
  - [x] 10.1 Implement `Renderer` constructor: create `THREE.WebGLRenderer` on the provided canvas, a `THREE.Scene`, and a `THREE.PerspectiveCamera`; build the two-level camera rig (`rigYaw` Object3D → `rigPitch` Object3D → camera at local offset `(0, 3, 10)`)
    - _Requirements: 1.7, 9.2, 9.3_

  - [x] 10.2 Implement `buildScene(levelData)`: generate `THREE.BoxGeometry` meshes for each wall AABB, `THREE.SphereGeometry` for generator meshes with HP bar `<div>` elements above them, and a distinct spaceship mesh for the player (simple geometry is fine); add ambient and directional lights
    - _Requirements: 1.1, 4.1, 6.1_

  - [x] 10.3 Implement `addEnemy(enemy)` and `removeEnemy(enemy)`: create a sphere mesh with surface dimple indicators for heading direction (normal-mapped or programmatic), add to/remove from scene, keep `enemy.mesh` reference in sync; implement `removeGenerator(generator)` to remove mesh and HP bar element
    - _Requirements: 3.1, 4.6_

  - [x] 10.4 Implement `spawnExplosionEffect(pos, radius, isChain)`: add a semi-transparent sphere mesh at `pos` with `radius` scale; use distinct material color/opacity for chain vs. initial explosions; schedule removal after 0.3 s using `setTimeout` or a timed list drained in `render()`
    - _Requirements: 2.2, 2.7_

  - [x] 10.5 Implement `updateCameraRig(shipPos, yaw, pitch)`: set `rigYaw.position` to `shipPos`, apply `yaw` rotation to `rigYaw`, apply `pitch` (clamped to ±80°) to `rigPitch`; add camera-clip check (raycast from ship to camera default offset, reposition camera to nearest unobstructed point, minimum 1 unit from ship)
    - _Requirements: 1.6, 1.7, 1.10_

  - [x] 10.6 Implement `render()`: call `renderer.render(scene, camera)`; batch-remove any entities flagged `pendingRemoval` from `gameState` arrays and the scene before the render call
    - _Requirements: 4.3, 4.6_

- [x] 11. Implement `EnemyAI.js`
  - Implement `EnemyAI` class with straight-line movement and wall reflection: `computeSpawnHeading(spawnPos, playerPos)` returns a unit heading vector from generator toward player at spawn time; `update(enemy, playerPos, walls, dt)` moves the enemy along its fixed `heading` at `enemySpeed`, checks sphere-AABB wall collisions, reflects heading on impact, and pushes position out of walls
  - Implement `reflect(velocity, normal)` and `checkWallCollision(pos, radius, aabb)` as helper methods on the class
  - _Requirements: 3.2_

- [x] 12. Implement `ExplosionSystem.js` full class with FIFO queue
  - Complete the `ExplosionSystem` class integrating the pure functions from task 5.1 with game state mutation: `onPlayerClick(shipPosition)` enqueues the initial `ExplosionJob`; `processExplosion(center, radius)` calls `collectHits`, flags hit entities `pendingRemoval`, enqueues chain explosions at each destroyed enemy's last position; `step()` dequeues one job per frame and calls `processExplosion`; increment `chainDepth` per link and apply the power gain from task 6.1 when the queue drains
  - Ensure all enemies within the current explosion radius are collected before any chain jobs are enqueued (one batch per explosion) per Requirement 2.8
  - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.8_

- [x] 13. Implement `Game.js` state machine and game loop
  - [x] 13.1 Implement `Game.start()`: check WebGL support (create offscreen canvas, call `getContext('webgl2') || getContext('webgl')`); on failure call `HUD.showWebGLError()` and return; otherwise begin `LevelLoader.loadLevel(1)` and on success enter `PLAYING` phase
    - _Requirements: 9.2, 9.5, 9.6_

  - [x] 13.2 Implement `Game.update(deltaTime)`: read `InputHandler`, compute normalized movement direction, call `Physics.applyAcceleration` / `applyDeceleration` for the player ship; call `Physics.checkSphereAABB` for player-wall collisions, `Physics.checkSphereSphere` for player-enemy collisions; apply `Physics.snapSmallComponent` after each reflection; update `playerShip.position` from velocity; call `EnemyAI.update` per enemy; call `ExplosionSystem.step()`; call `HUD.sync(gameState)`; call `Renderer.updateCameraRig`
    - _Requirements: 1.2–1.9, 3.2, 3.3, 3.4, 3.5, 3.6, 6.2, 6.3, 6.6_

  - [x] 13.3 Implement enemy collision resolution in `Game.update`: when player contacts an enemy, decrease `powerLevel` via `max(1, powerLevel - decrement)` (Requirement 5.6), deflect both ships away, do NOT trigger explosion; when power reaches minimum and decrement would push below 1, clamp to 1
    - _Requirements: 3.4, 3.5, 3.6, 5.4, 5.6_

  - [x] 13.4 Implement enemy spawn logic: for each generator with HP > 0, if `now - lastSpawnTime ≥ spawnIntervalSeconds`, call `Renderer.addEnemy(newEnemy)` and push to `gameState.enemies`
    - _Requirements: 3.2, 4.5_

  - [x] 13.5 Implement `Game.onLevelComplete()` and `Game.onGameOver()`: show appropriate HUD screen; for level complete, wait 2 seconds then call `Game.loadLevel(levelIndex + 1)`; reset `powerLevel` to `config.initialPowerLevel` on level advance; handle missing/invalid next level by showing error and remaining on current level
    - _Requirements: 3.7, 4.7, 4.8, 7.1, 7.2, 7.5_

- [x] 14. Implement `main.js` bootstrap and wire everything together
  - Implement `main.js`: instantiate `InputHandler`, `Renderer(canvas)`, `HUD`, `GameState`, `EnemyAI`, `ExplosionSystem`, `LevelLoader`, and `Game`; pass dependencies into `Game`; call `Game.start()`; register the `requestAnimationFrame` loop that calls `Game.update(dt)` then `Renderer.render()` each frame; wire the mouse-click event to `ExplosionSystem.onPlayerClick(playerShip.position)` only when `phase === 'PLAYING'`
  - _Requirements: 2.1, 9.1, 9.3, 9.4_

- [x] 15. Write remaining example-based tests
  - [x] 15.1 Write `levelLoader.test.js` tests: verify correct parsing of valid level JSON; verify `LevelConfigError` on missing required field; verify `LevelConfigError` on out-of-range `maxHp` (0 or 1001); verify `LevelConfigError` on spawn interval outside [1, 300]; verify rejected fetch leaves `GameState.levelIndex` unchanged
    - _Requirements: 7.2, 9.6_

  - [x] 15.2 Write `hud.test.js` tests: verify `showWebGLError` inserts correct message text; verify `updatePowerBar(30, 100)` sets bar element width to `30%`; verify `updateGeneratorBars` creates one bar per generator and removes bars for destroyed generators; verify `showGameOver` and `showLevelComplete` toggle the correct CSS classes
    - _Requirements: 5.5, 8.1, 8.2, 9.5_

- [x] 16. Final checkpoint — all tests pass
  - Run `npx vitest --run` and ensure all tests pass. Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Tasks 2, 5, and 6 establish pure-logic foundations before any rendering work begins, enabling property tests to run in Node.js with no DOM or WebGL mock.
- The five level JSON files (task 4.2) should be authored to satisfy Requirement 7.6: each must differ from the others in at least one observable way (layout, generator count, placement, or spawn interval).
- The camera clip check (task 10.5) requires a `THREE.Raycaster` sweep against wall meshes — use `Renderer`'s own scene wall mesh list to avoid duplicating the wall AABB data.
- `pendingRemoval` batch-deletion (task 10.6) must happen before `renderer.render()` each frame so HP-bar DOM elements and scene meshes are removed atomically within one rendered frame (Requirements 4.3, 4.6).
- Each property test file should include a comment header linking to the design property number, e.g. `// Feature: webtend-game, Property 7: Wall reflection preserves speed and angle`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3", "4.1", "4.2", "9"] },
    { "id": 1, "tasks": ["2.2", "2.3", "2.4", "2.5", "5.1", "4.3"] },
    { "id": 2, "tasks": ["5.2", "5.3", "5.4", "6.1", "8.1", "8.2", "10.1", "11"] },
    { "id": 3, "tasks": ["6.2", "6.3", "6.4", "6.5", "8.3", "10.2", "10.3", "12"] },
    { "id": 4, "tasks": ["10.4", "10.5", "10.6", "13.1", "13.2"] },
    { "id": 5, "tasks": ["13.3", "13.4", "13.5"] },
    { "id": 6, "tasks": ["14"] },
    { "id": 7, "tasks": ["15.1", "15.2"] }
  ]
}
```


---

## Bugfix: Player Movement and Collision Overhaul (Bullet-Hell Style)

_Spec: `.kiro/specs/player-movement-and-collision-fix/bugfix.md`_

Fixes: Enemies survive player contact (should be destroyed), slow acceleration-based movement (should be fast/responsive), wall bounce (should slide), enemy knockback (should have none).

- [x] 17. Write bug condition exploration tests for movement/collision
  - Test file: `tests/movementCollisionBugCondition.test.js`
  - Test 1: Enemy contacts player → assert enemy is destroyed (pendingRemoval=true) — will FAIL on unfixed code
  - Test 2: Enemy contacts player → assert player velocity is unchanged (no knockback) — will FAIL
  - Test 3: Player movement with acceleration=200, maxSpeed=100 reaches near-max in 0.5s — will FAIL with current config (accel=20, max=50)
  - Test 4: Player wall collision → assert perpendicular velocity component is 0 (slide) — will FAIL (currently reflects/bounces)
  - Test 5: Deceleration from max speed to stop in ≤0.05s — will FAIL (currently 0.5s)
  - **EXPECTED**: Tests FAIL on unfixed code
  - _Requirements: 1.1–1.6 from bugfix spec_

- [x] 18. Write preservation tests for movement/collision
  - Test file: `tests/movementCollisionPreservation.test.js`
  - Test: Explosion chain reactions still destroy enemies and trigger chains
  - Test: Enemy wall bounce (heading reflection) still works
  - Test: Generator spawning and HP decrement unchanged
  - Test: Power level gain from chain threshold unchanged
  - **EXPECTED**: Tests PASS on unfixed code
  - _Requirements: 3.1–3.7 from bugfix spec_

- [x] 19. Implement player movement and collision fixes
  - [x] 19.1 Add `wallSlide(velocity, wallNormal)` to Physics.js — zeros perpendicular component, preserves parallel
  - [x] 19.2 Update Game.js wall collision: replace `Physics.reflect()` with `Physics.wallSlide()` for player only; push out by penetration depth
  - [x] 19.3 Update Game.js enemy collision: destroy enemy on contact (set `pendingRemoval=true`), decrement power, do NOT deflect player velocity, do NOT deflect enemy
  - [x] 19.4 Update level configs (levels/level1-5.json): set `playerAcceleration: 200`, `playerMaxSpeed: 100`, `decelerationTime: 0.05`
  - [x] 19.5 Update Physics property tests: add Property for wall slide (perpendicular=0, parallel preserved) alongside existing reflect tests
  - [x] 19.6 Verify bug condition tests (task 17) now pass
  - [x] 19.7 Verify preservation tests (task 18) still pass

- [x] 20. Checkpoint — movement/collision fix tests all pass
  - Run full test suite: `cd /Users/paulchase/github/paenian.github.io/webtend && npx vitest --run`

---

## Bugfix: Power-Zero Game-Over Explosion

_Spec: `.kiro/specs/power-zero-game-over-explosion/bugfix.md` + `design.md`_

Fixes: Power clamped to min 1 (should allow 0), explosions have no cost (should cost 1 power), game-over has no visual payoff (should have dramatic death explosion with chain resolution).

- [x] 21. Write bug condition exploration tests for power-zero
  - Test file: `tests/powerZeroBugCondition.test.js`
  - Test 1: Power=1, enemy collision → assert power=0 — will FAIL (floors at 1)
  - Test 2: Power=5, click explosion → assert power=4 — will FAIL (no cost)
  - Test 3: Power=1, click, chain fails threshold → assert game-over — will FAIL
  - Test 4: Game-over → assert death explosion enqueued with max radius — will FAIL
  - **EXPECTED**: Tests FAIL on unfixed code
  - _Requirements: 1.1–1.4 from bugfix spec_

- [x] 22. Write preservation tests for power-zero
  - Test file: `tests/powerZeroPreservation.test.js`
  - Test: Collision at power>1 still decrements correctly
  - Test: Explosion radius formula unchanged
  - Test: Chain reward at threshold unchanged
  - Test: Level-complete logic unaffected
  - **EXPECTED**: Tests PASS on unfixed code
  - _Requirements: 3.1–3.8 from bugfix spec_

- [x] 23. Implement power-zero and game-over explosion
  - [x] 23.1 GameState.js — Add 'DYING' phase; change power clamp from max(1,...) to max(0,...)
  - [x] 23.2 ExplosionSystem.js — Add explosion cost: deduct 1 power in onPlayerClick (guard at 0); use pre-deduction power for radius
  - [x] 23.3 ExplosionSystem.js — Post-chain evaluation: if power=0 and phase=PLAYING, set desperationFailed flag
  - [x] 23.4 Game.js — Change power floor from 1 to 0; check for game-over after collision
  - [x] 23.5 Game.js — Rewrite onGameOver(): set phase=DYING, enqueue death explosion (max radius), call renderer.spawnDeathExplosionEffect()
  - [x] 23.6 Game.js — Handle DYING phase in update(): skip input/movement/spawning, continue explosion steps; transition to GAME_OVER when queue empties; detect desperationFailed flag
  - [x] 23.7 Renderer.js — Add spawnDeathExplosionEffect(pos, maxRadius, durationMs): slow-expanding sphere (0 → maxRadius over 2500ms), distinct color (0xff2200), opacity 0.7
  - [x] 23.8 HUD.js — Add 'power-critical' CSS class on power bar when power ≤ 1
  - [x] 23.9 Verify bug condition tests (task 21) now pass
  - [x] 23.10 Verify preservation tests (task 22) still pass

- [x] 24. Checkpoint — power-zero fix tests all pass
  - Run full test suite: `cd /Users/paulchase/github/paenian.github.io/webtend && npx vitest --run`

---

## Bugfix: Enemy-Enemy Collision (Oriented Capsule)

_Spec: `.kiro/specs/enemy-enemy-collision/bugfix.md` + `design.md`_

Fixes: Enemies pass through each other (should collide with oriented capsule geometry and heading-dependent deflection).

- [x] 25. Write bug condition exploration tests for enemy-enemy collision
  - Test file: `tests/enemyEnemyBugCondition.test.js`
  - Test 1: Two enemies facing each other 2 units apart → step → assert positions cross (pass-through) — demonstrates bug
  - Test 2: Two enemies at same position → step → assert no heading change — demonstrates bug
  - Test 3: After fix, overlapping capsules must deflect — set up for later verification
  - **EXPECTED**: Tests FAIL on unfixed code (showing enemies pass through)
  - _Requirements: 1.1–1.3 from bugfix spec_

- [x] 26. Write preservation tests for enemy-enemy collision
  - Test file: `tests/enemyEnemyPreservation.test.js`
  - Test: Enemy wall bounce unchanged
  - Test: Straight-line movement at enemySpeed preserved for isolated enemies
  - Test: Player-enemy collision unchanged
  - Test: Explosion hit detection uses bounding sphere (not capsule)
  - **EXPECTED**: Tests PASS on unfixed code
  - _Requirements: 3.1–3.7 from bugfix spec_

- [x] 27. Implement enemy-enemy collision
  - [x] 27.1 GameState.js — Add capsuleHalfLength and capsuleRadius to Enemy typedef
  - [x] 27.2 Physics.js — Implement `closestPointsOnSegments(p1, d1, p2, d2)`: segment-segment closest point algorithm with clamping
  - [x] 27.3 Physics.js — Implement `checkCapsuleCapsule(pos1, heading1, halfLen1, radius1, pos2, heading2, halfLen2, radius2)`: returns { hit, normal, depth }
  - [x] 27.4 Physics.js — Implement `computeDeflection(heading, contactNormal, enemySpeed)`: noseFactor-based blend between full reflect and partial deflection
  - [x] 27.5 Game.js — Add enemy-enemy collision loop after EnemyAI.update(): nested i/j loop with bounding sphere pre-filter → capsule test → deflection + separation
  - [x] 27.6 Game.js — Update enemy spawn: add capsuleHalfLength=1.5, capsuleRadius=0.8; adjust bounding sphere radius to enclose capsule (2.3)
  - [x] 27.7 Write unit tests for closestPointsOnSegments (parallel, perpendicular, skew, degenerate segments)
  - [x] 27.8 Write unit tests for checkCapsuleCapsule (known hit/miss configurations)
  - [x] 27.9 Write property-based tests: deflection preserves speed; separation resolves overlap; non-colliding pairs unaffected
  - [x] 27.10 Verify bug condition tests (task 25) now pass
  - [x] 27.11 Verify preservation tests (task 26) still pass

- [x] 28. Checkpoint — enemy-enemy collision tests all pass
  - Run full test suite: `cd /Users/paulchase/github/paenian.github.io/webtend && npx vitest --run`

---

## Bugfix Execution Order

The three bugfix sets should be implemented in this order due to dependencies:

1. **Movement/Collision (tasks 17–20)** — Changes wall collision to slide and enemy contact to destroy. Must be done first because power-zero spec assumes enemies are destroyed on contact.
2. **Power-Zero (tasks 21–24)** — Changes power floor to 0 and adds death explosion. Depends on enemy-destroy-on-contact from step 1.
3. **Enemy-Enemy Collision (tasks 25–28)** — Adds oriented capsule collision between enemies. Independent of player mechanics but should be done last to avoid test conflicts.

```json
{
  "bugfix_waves": [
    { "id": "BF1", "tasks": ["17", "18"], "label": "Movement/Collision exploration + preservation tests" },
    { "id": "BF2", "tasks": ["19.1", "19.2", "19.3", "19.4", "19.5"], "label": "Movement/Collision implementation" },
    { "id": "BF3", "tasks": ["19.6", "19.7", "20"], "label": "Movement/Collision verification" },
    { "id": "BF4", "tasks": ["21", "22"], "label": "Power-Zero exploration + preservation tests" },
    { "id": "BF5", "tasks": ["23.1", "23.2", "23.3", "23.4", "23.7", "23.8"], "label": "Power-Zero implementation (parallel tracks)" },
    { "id": "BF6", "tasks": ["23.5", "23.6"], "label": "Power-Zero Game.js integration (depends on 23.1-23.4, 23.7)" },
    { "id": "BF7", "tasks": ["23.9", "23.10", "24"], "label": "Power-Zero verification" },
    { "id": "BF8", "tasks": ["25", "26"], "label": "Enemy-Enemy exploration + preservation tests" },
    { "id": "BF9", "tasks": ["27.1", "27.2", "27.3", "27.4"], "label": "Enemy-Enemy Physics implementation" },
    { "id": "BF10", "tasks": ["27.5", "27.6"], "label": "Enemy-Enemy Game.js integration" },
    { "id": "BF11", "tasks": ["27.7", "27.8", "27.9"], "label": "Enemy-Enemy unit + property tests" },
    { "id": "BF12", "tasks": ["27.10", "27.11", "28"], "label": "Enemy-Enemy verification" }
  ]
}
```
