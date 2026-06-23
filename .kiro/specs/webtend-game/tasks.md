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

  - [ ]* 2.2 Write property test — Property 1: Ship thrust never exceeds max speed
    - **Property 1: Ship Thrust Acceleration Never Exceeds Maximum Speed**
    - For any initial velocity and positive dt, `applyAcceleration` result magnitude ≤ `maxSpeed`
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.9**

  - [ ]* 2.3 Write property test — Property 2: Deceleration reaches zero within 0.5 s
    - **Property 2: Ship Deceleration Reaches Zero Within Time Limit**
    - For any initial velocity ≤ 50, simulating `applyDeceleration` for 0.5 s yields magnitude ≤ ε
    - **Validates: Requirements 1.8**

  - [ ]* 2.4 Write property test — Property 7: Wall reflection preserves speed and reverses normal component
    - **Property 7: Wall Reflection Preserves Speed and Reverses Normal Component**
    - `|reflect(v, n)| = |v|`; normal component negated; perpendicular component preserved
    - **Validates: Requirements 3.3, 6.2, 6.3**

  - [ ]* 2.5 Write property test — Property 8: Power level decrement bounded below by 1
    - **Property 8: Power Level Decrement Is Bounded Below by 1**
    - `max(1, p - d)` is always ≥ 1 for any p in [1, 100] and d in [1, 10]
    - **Validates: Requirements 3.4, 5.4, 5.6**

- [-] 3. Implement `GameState.js` and shared data models
  - Define and export the `GameState` object with all fields: `phase`, `levelIndex`, `powerLevel`, `maxPowerLevel`, `enemies`, `generators`, `walls`, `config`, `chainDepth`, `explosionQueue`
  - Define and export the entity model shapes (`Enemy`, `Generator`, `PlayerShip`, `AABB`, `ExplosionJob`) as JSDoc typedefs so other modules can import them for documentation
  - Implement `GameState.reset(levelData)` to initialize state from a loaded level config
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.5_

- [ ] 4. Implement `LevelLoader.js` and level JSON files
  - [-] 4.1 Implement `loadLevel(index)` using `fetch` + JSON parse wrapped in try/catch; implement `validateLevelData(data)` that throws a typed `LevelConfigError` for missing or out-of-range fields (walls, generators, playerStart, config with all required keys and value ranges)
    - _Requirements: 7.1, 7.2, 9.6_

  - [-] 4.2 Author the five level JSON files with distinct, valid configurations differing in at least one of: maze layout (wall counts/positions), number of generators, generator placement, or spawn interval; ensure Level N+1 spawn interval ≤ Level N interval; add open area large enough for 5+ chained explosions at initial power
    - _Requirements: 6.4, 6.5, 7.3, 7.4, 7.6_

  - [ ]* 4.3 Write example-based tests in `levelLoader.test.js`: mock `fetch` to return invalid JSON, missing fields, and out-of-range values; verify `LevelConfigError` is thrown and no game state is altered
    - _Requirements: 7.2, 9.6_

- [ ] 5. Implement explosion formula and hit collection; property tests
  - [~] 5.1 Implement the pure, DOM-free parts of `ExplosionSystem.js`: `calcRadius(powerLevel, config)` returning `base_radius + powerLevel × radius_multiplier`, and `collectHits(center, radius, enemies, generators)` returning all entities whose bounding-sphere center is within `radius + entity.radius` of center
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 5.2_

  - [ ]* 5.2 Write property test — Property 4: Explosion radius is monotonically non-decreasing with power level
    - **Property 4: Explosion Radius Formula Is Monotonically Increasing with Power Level**
    - For p1 < p2 in [1, 100], `calcRadius(p1) ≤ calcRadius(p2)`
    - **Validates: Requirements 2.1, 5.2**

  - [ ]* 5.3 Write property test — Property 5: All in-radius enemies captured, none out-of-radius included
    - **Property 5: Explosion Blast Collection — All In-Radius Enemies Captured**
    - `collectHits` result equals exactly the set of entities within range
    - **Validates: Requirements 2.3, 2.4, 2.8**

  - [ ]* 5.4 Write property test — Property 10: Generator HP decreases by exactly one per explosion hit
    - **Property 10: Generator HP Decreases by Exactly One Per Explosion Hit**
    - After one explosion hit, new HP = `max(0, currentHp - 1)`
    - **Validates: Requirements 2.5**

- [ ] 6. Implement generator and level progression logic; property tests
  - [~] 6.1 Implement the chain reward and power cap logic in `ExplosionSystem.js`: after chain drains, if `chainDepth ≥ chainThreshold` then `powerLevel = min(powerLevel + increment, maxPower)`; implement generator HP decrement on explosion hit, setting `pendingRemoval = true` when HP reaches zero
    - _Requirements: 2.6, 4.5, 4.6, 5.3_

  - [ ]* 6.2 Write property test — Property 6: Chain reaction power gain obeys threshold and maximum
    - **Property 6: Chain Reaction Power Gain Obeys Threshold and Maximum**
    - If `d ≥ chainThreshold`: new power = `min(p + increment, 100)`; otherwise unchanged
    - **Validates: Requirements 2.6, 5.3**

  - [ ]* 6.3 Write property test — Property 9: Generator HP bar fill ratio always in [0, 1]
    - **Property 9: Generator HP Bar Fill Ratio Is Always in [0, 1]**
    - `currentHp / maxHp` ∈ [0.0, 1.0] for any valid currentHp and maxHp
    - **Validates: Requirements 4.2**

  - [ ]* 6.4 Write property test — Property 11: Level spawn intervals non-increasing with floor at 0.5 s
    - **Property 11: Level Spawn Intervals Are Monotonically Non-Increasing with Floor**
    - Sequence of `max(0.5, prev × (1 - decreasePct))` is non-increasing and ≥ 0.5
    - **Validates: Requirements 4.5, 7.3**

  - [ ]* 6.5 Write property test — Property 12: Level generator counts non-decreasing with ceiling at 20
    - **Property 12: Level Generator Counts Are Monotonically Non-Decreasing with Ceiling**
    - Sequence of `min(20, prev + increment)` is non-decreasing and ≤ 20
    - **Validates: Requirements 7.4**

- [~] 7. Checkpoint — verify all pure-logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement `HUD.js` and CSS overlay
  - [~] 8.1 Implement `HUD.js` with all methods: `sync(gameState)`, `updatePowerBar(current, max)`, `updateGeneratorBars(generators)`, `updateLevel(levelIndex)`, `showLevelComplete()`, `hideLevelComplete()`, `showGameOver()`, `showWebGLError()`, `showAssetError(assetName)` — all using DOM manipulation only, no canvas drawing
    - _Requirements: 4.2, 4.3, 5.5, 8.1, 8.2, 8.3, 9.5_

  - [~] 8.2 Write CSS in `index.html` (or a linked stylesheet) for the HUD overlay: fixed-position container, power bar, generator bars list, level number; ensure legibility at 360–2560 px viewport widths with minimum 12 CSS px text and 6 CSS px bar height; use `width: X%` fill driven by JS
    - _Requirements: 8.4_

  - [ ]* 8.3 Write example-based tests in `hud.test.js`: verify `updatePowerBar` sets correct `width` percentage on the bar element; verify `showWebGLError` renders the correct message; verify `updateGeneratorBars` adds/removes bar elements to match the generator list
    - _Requirements: 5.5, 8.1, 8.2, 9.5_

- [~] 9. Implement `InputHandler.js`
  - Implement `InputHandler` class: maintain a `Set<string>` keyboard state via `keydown`/`keyup` events on `window`; implement `get keys()` returning `{w, a, s, d}` booleans; accumulate mouse deltas from `mousemove` events while pointer-locked into `{dx, dy}`; implement `get mouseDelta()` that returns the accumulated delta and resets it to `{0, 0}`; implement `requestPointerLock()` and `isPointerLocked()`
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 10. Implement `Renderer.js` with Three.js scene and camera rig
  - [~] 10.1 Implement `Renderer` constructor: create `THREE.WebGLRenderer` on the provided canvas, a `THREE.Scene`, and a `THREE.PerspectiveCamera`; build the two-level camera rig (`rigYaw` Object3D → `rigPitch` Object3D → camera at local offset `(0, 3, 10)`)
    - _Requirements: 1.7, 9.2, 9.3_

  - [~] 10.2 Implement `buildScene(levelData)`: generate `THREE.BoxGeometry` meshes for each wall AABB, `THREE.SphereGeometry` for generator meshes with HP bar `<div>` elements above them, and a distinct spaceship mesh for the player (simple geometry is fine); add ambient and directional lights
    - _Requirements: 1.1, 4.1, 6.1_

  - [~] 10.3 Implement `addEnemy(enemy)` and `removeEnemy(enemy)`: create a sphere mesh with surface dimple indicators for heading direction (normal-mapped or programmatic), add to/remove from scene, keep `enemy.mesh` reference in sync; implement `removeGenerator(generator)` to remove mesh and HP bar element
    - _Requirements: 3.1, 4.6_

  - [~] 10.4 Implement `spawnExplosionEffect(pos, radius, isChain)`: add a semi-transparent sphere mesh at `pos` with `radius` scale; use distinct material color/opacity for chain vs. initial explosions; schedule removal after 0.3 s using `setTimeout` or a timed list drained in `render()`
    - _Requirements: 2.2, 2.7_

  - [~] 10.5 Implement `updateCameraRig(shipPos, yaw, pitch)`: set `rigYaw.position` to `shipPos`, apply `yaw` rotation to `rigYaw`, apply `pitch` (clamped to ±80°) to `rigPitch`; add camera-clip check (raycast from ship to camera default offset, reposition camera to nearest unobstructed point, minimum 1 unit from ship)
    - _Requirements: 1.6, 1.7, 1.10_

  - [~] 10.6 Implement `render()`: call `renderer.render(scene, camera)`; batch-remove any entities flagged `pendingRemoval` from `gameState` arrays and the scene before the render call
    - _Requirements: 4.3, 4.6_

- [~] 11. Implement `EnemyAI.js`
  - Implement `EnemyAI.update(enemy, playerPos, walls, dt)`: compute seek direction as `normalize(playerPos - enemy.position) × enemySpeed`; add wall-avoidance repulsion for any wall within `avoidRadius`; clamp combined velocity to `maxSpeed`; mutate `enemy.velocity` with the result
  - Implement `EnemyAI.seek(enemy, target)` and `EnemyAI.avoidWalls(enemy, walls)` as separate helpers
  - _Requirements: 3.2_

- [~] 12. Implement `ExplosionSystem.js` full class with FIFO queue
  - Complete the `ExplosionSystem` class integrating the pure functions from task 5.1 with game state mutation: `onPlayerClick(shipPosition)` enqueues the initial `ExplosionJob`; `processExplosion(center, radius)` calls `collectHits`, flags hit entities `pendingRemoval`, enqueues chain explosions at each destroyed enemy's last position; `step()` dequeues one job per frame and calls `processExplosion`; increment `chainDepth` per link and apply the power gain from task 6.1 when the queue drains
  - Ensure all enemies within the current explosion radius are collected before any chain jobs are enqueued (one batch per explosion) per Requirement 2.8
  - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.8_

- [ ] 13. Implement `Game.js` state machine and game loop
  - [~] 13.1 Implement `Game.start()`: check WebGL support (create offscreen canvas, call `getContext('webgl2') || getContext('webgl')`); on failure call `HUD.showWebGLError()` and return; otherwise begin `LevelLoader.loadLevel(1)` and on success enter `PLAYING` phase
    - _Requirements: 9.2, 9.5, 9.6_

  - [~] 13.2 Implement `Game.update(deltaTime)`: read `InputHandler`, compute normalized movement direction, call `Physics.applyAcceleration` / `applyDeceleration` for the player ship; call `Physics.checkSphereAABB` for player-wall collisions, `Physics.checkSphereSphere` for player-enemy collisions; apply `Physics.snapSmallComponent` after each reflection; update `playerShip.position` from velocity; call `EnemyAI.update` per enemy; call `ExplosionSystem.step()`; call `HUD.sync(gameState)`; call `Renderer.updateCameraRig`
    - _Requirements: 1.2–1.9, 3.2, 3.3, 3.4, 3.5, 3.6, 6.2, 6.3, 6.6_

  - [~] 13.3 Implement enemy collision resolution in `Game.update`: when player contacts an enemy, decrease `powerLevel` via `max(1, powerLevel - decrement)` (Requirement 5.6), deflect both ships away, do NOT trigger explosion; when power reaches minimum and decrement would push below 1, clamp to 1
    - _Requirements: 3.4, 3.5, 3.6, 5.4, 5.6_

  - [~] 13.4 Implement enemy spawn logic: for each generator with HP > 0, if `now - lastSpawnTime ≥ spawnIntervalSeconds`, call `Renderer.addEnemy(newEnemy)` and push to `gameState.enemies`
    - _Requirements: 3.2, 4.5_

  - [~] 13.5 Implement `Game.onLevelComplete()` and `Game.onGameOver()`: show appropriate HUD screen; for level complete, wait 2 seconds then call `Game.loadLevel(levelIndex + 1)`; reset `powerLevel` to `config.initialPowerLevel` on level advance; handle missing/invalid next level by showing error and remaining on current level
    - _Requirements: 3.7, 4.7, 4.8, 7.1, 7.2, 7.5_

- [~] 14. Implement `main.js` bootstrap and wire everything together
  - Implement `main.js`: instantiate `InputHandler`, `Renderer(canvas)`, `HUD`, `GameState`, `EnemyAI`, `ExplosionSystem`, `LevelLoader`, and `Game`; pass dependencies into `Game`; call `Game.start()`; register the `requestAnimationFrame` loop that calls `Game.update(dt)` then `Renderer.render()` each frame; wire the mouse-click event to `ExplosionSystem.onPlayerClick(playerShip.position)` only when `phase === 'PLAYING'`
  - _Requirements: 2.1, 9.1, 9.3, 9.4_

- [ ] 15. Write remaining example-based tests
  - [ ]* 15.1 Write `levelLoader.test.js` tests: verify correct parsing of valid level JSON; verify `LevelConfigError` on missing required field; verify `LevelConfigError` on out-of-range `maxHp` (0 or 1001); verify `LevelConfigError` on spawn interval outside [1, 300]; verify rejected fetch leaves `GameState.levelIndex` unchanged
    - _Requirements: 7.2, 9.6_

  - [ ]* 15.2 Write `hud.test.js` tests: verify `showWebGLError` inserts correct message text; verify `updatePowerBar(30, 100)` sets bar element width to `30%`; verify `updateGeneratorBars` creates one bar per generator and removes bars for destroyed generators; verify `showGameOver` and `showLevelComplete` toggle the correct CSS classes
    - _Requirements: 5.5, 8.1, 8.2, 9.5_

- [~] 16. Final checkpoint — all tests pass
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
