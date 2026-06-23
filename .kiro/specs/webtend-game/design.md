# Design Document: Webtend Game

## Overview

Webtend is a browser-based 3D action game served as static files from GitHub Pages under the `/webtend/` path. It uses [Three.js](https://threejs.org/) for WebGL-accelerated 3D rendering with no build step — just an ES-module import map in the entry HTML pointing to a CDN-hosted Three.js bundle. The player pilots a spaceship in third-person perspective through a semi-open 3D maze, clicking to trigger chain-reaction explosions that destroy enemy generators.

All game logic runs in the browser main thread. There is no backend, no build pipeline, and no native dependencies. The project delivers a single self-contained folder that GitHub Pages serves directly.

### Key Research Findings

- **Three.js import maps (no bundler):** Modern Three.js (r150+) ships as ES modules. Static hosting works cleanly with an `<script type="importmap">` block mapping `"three"` and `"three/addons/"` to a CDN like [jsDelivr](https://cdn.jsdelivr.net/npm/three@0.168.0/), eliminating any build step. All game modules use `import` statements that resolve through the map.
- **Third-person camera:** Three.js does not have a built-in third-person controller, but building one from primitives (a `CameraRig` Object3D parented to the player position + `mousemove` events on the pointer-locked canvas) is straightforward and gives full control over the fixed-offset requirement.
- **Pointer Lock API:** `canvas.requestPointerLock()` / `document.exitPointerLock()` is the standard way to capture mouse deltas for look-around. The game enters pointer lock on first click-to-play and releases on Escape.
- **Collision detection:** Three.js provides `THREE.Box3` (AABB) and `THREE.Sphere` natively. For wall collision we store each wall as an AABB and test sphere-vs-AABB per frame. Velocity reflection is a pure vector operation: `v' = v - 2(v·n)n`. `THREE.Raycaster` handles explosion sphere overlaps against enemy bounding spheres efficiently.
- **Property-based testing:** [fast-check](https://fast-check.dev/) (MIT) is the standard PBT library for JavaScript. It runs in Vitest or Jest with no configuration. Physics and formula logic are pure functions that are ideal targets for PBT.

---

## Architecture

### Module Breakdown

The game is split into focused ES modules with no circular dependencies. Each module exports a plain object or class; there is no global state outside of `GameState`.

```
/webtend/
├── index.html           # Entry point: importmap + canvas + HUD markup
├── main.js              # Bootstrap: WebGL check, asset load, Game.start()
├── Game.js              # Top-level game loop and state machine
├── GameState.js         # Shared mutable state (power level, level, enemies, etc.)
├── Renderer.js          # Three.js scene, camera rig, render call
├── InputHandler.js      # Keyboard state map + pointer lock mouse delta
├── Physics.js           # Velocity update, wall reflection, sphere-sphere collision
├── ExplosionSystem.js   # Click handler, radius calc, BFS chain reaction queue
├── EnemyAI.js           # Steering behavior: seek player, wall avoidance
├── HUD.js               # DOM manipulation for power bar, generator bars, level
├── LevelLoader.js       # Fetch + validate JSON level configs
├── levels/
│   ├── level1.json
│   ├── level2.json
│   ├── level3.json
│   ├── level4.json
│   └── level5.json
└── assets/
    └── (textures, if any)
```

### File Structure Rationale

- `index.html` contains the `importmap`, HUD HTML skeleton, and a `<canvas id="game-canvas">`. No inline game logic.
- `main.js` is the only script tag (`type="module"`). It checks WebGL, kicks off `LevelLoader`, then calls `Game.start()`.
- `Game.js` owns the `requestAnimationFrame` loop and the game state machine. It coordinates the other subsystems without knowing their internals.
- Pure-logic modules (`Physics.js`, `ExplosionSystem.js`) have no Three.js imports — they operate on plain vectors (`{x, y, z}`) so they can be tested without a DOM or WebGL context.

### Data Flow

```
InputHandler  ──► Game.update(dt)
                      │
          ┌───────────┼──────────────┐
          ▼           ▼              ▼
      Physics     EnemyAI      ExplosionSystem
          │           │              │
          └───────────┴──────────────┘
                      │
                 GameState (mutated)
                      │
                  HUD.sync()
                  Renderer.render()
```

---

## Components and Interfaces

### Game.js — State Machine + Loop

```js
// States: LOADING | PLAYING | PAUSED | LEVEL_COMPLETE | GAME_OVER
class Game {
  start()                        // enter LOADING, then PLAYING
  update(deltaTime)              // called each frame; dispatches to subsystems
  onLevelComplete()              // transition to LEVEL_COMPLETE, schedule advance
  onGameOver()                   // transition to GAME_OVER
  loadLevel(levelIndex)          // call LevelLoader, rebuild scene objects
}
```

### Renderer.js — Three.js Scene

```js
class Renderer {
  constructor(canvas)
  buildScene(levelData)          // create maze meshes, generator meshes, lights
  addEnemy(enemy)                // add enemy mesh to scene
  removeEnemy(enemy)             // remove enemy mesh from scene
  removeGenerator(generator)     // remove generator mesh + HP bar
  spawnExplosionEffect(pos, radius, isChain)  // add temporary sphere mesh
  updateCameraRig(shipPos, yaw, pitch)        // reposition camera object
  render()                       // renderer.render(scene, camera)
}
```

The camera rig is a two-level hierarchy:
- `rigYaw` (Object3D at ship position) — rotated by mouse horizontal delta
- `rigPitch` (Object3D, child of rigYaw) — rotated by mouse vertical delta, clamped [-80°, +80°]
- `camera` (PerspectiveCamera, child of rigPitch) — positioned at offset `(0, 3, 10)` in local space

### InputHandler.js — Keyboard + Mouse

```js
class InputHandler {
  constructor(canvas)
  get keys()                     // { w, a, s, d } boolean state
  get mouseDelta()               // { dx, dy } accumulated since last frame, then reset
  requestPointerLock()
  isPointerLocked()
}
```

Keyboard state is maintained as a `Set<string>` updated by `keydown`/`keyup` events. Mouse delta is accumulated from `mousemove` events fired while pointer lock is active and reset to `{0, 0}` after each `update()` read.

### Physics.js — Pure Vector Operations

```js
// All vectors are plain { x, y, z } objects — no Three.js dependency

function reflect(velocity, wallNormal)       // returns reflected velocity vector
function applyAcceleration(vel, dir, accel, maxSpeed, dt)
function applyDeceleration(vel, decelRate, dt)
function clampSpeed(vel, maxSpeed)
function checkSphereAABB(sphereCenter, sphereRadius, aabb)  // returns { hit, normal, depth }
function checkSphereSphere(c1, r1, c2, r2)                  // returns { hit, normal, depth }
function snapSmallComponent(vel, threshold)  // set component to 0 if < threshold% of speed
```

Wall AABBs are stored as `{ min: {x,y,z}, max: {x,y,z} }` in the level data and pre-computed once on level load. Collision detection iterates the wall list per entity per frame (N walls × M entities). For levels with ≤ 200 walls and ≤ 50 enemies, this is comfortably within budget.

### ExplosionSystem.js — BFS Chain Reaction

```js
class ExplosionSystem {
  constructor(gameState, config)
  onPlayerClick(shipPosition)              // entry point: triggers initial explosion
  processExplosion(center, radius)         // collect all hits, enqueue chains
  step()                                   // process one chain link per frame
  calcRadius(powerLevel)                   // base_radius + powerLevel × radius_multiplier
  countChainLength()                       // returns current chain depth counter
}
```

Chain reaction processing uses a FIFO queue (plain array). `onPlayerClick` enqueues the first explosion. Each call to `processExplosion` collects all enemy and generator hits synchronously within the current explosion sphere, removes those entities, then enqueues a new explosion at each destroyed enemy's last position. The queue is drained one entry per frame to give the renderer time to show each visual effect.

**Chain length tracking:** A counter is incremented for each link beyond the first. When the queue drains (chain ends), if counter ≥ threshold, `GameState.powerLevel` is incremented.

### EnemyAI.js — Steering

```js
class EnemyAI {
  constructor(gameState, config)
  update(enemy, playerPos, walls, dt)  // mutates enemy.velocity
  seek(enemy, target)                  // returns normalized direction toward target
  avoidWalls(enemy, walls)             // apply repulsion from nearby walls
}
```

Steering is a simple seek behavior: desired velocity = normalize(player - enemy) × maxSpeed. Wall avoidance adds a repulsion vector away from any wall closer than `avoidRadius` units. The combined velocity is clamped to `maxSpeed`. This is intentionally simple — the maze structure naturally channels enemy movement.

### LevelLoader.js — Config Validation

```js
async function loadLevel(index)      // fetch levels/levelN.json, validate, return LevelData
function validateLevelData(data)     // throws on invalid config, returns validated object
```

Level JSON schema:
```json
{
  "id": 1,
  "initialPowerLevel": 5,
  "walls": [
    { "min": [-50, 0, -50], "max": [-45, 10, 50] }
  ],
  "generators": [
    { "id": "g1", "position": [10, 0, 10], "maxHp": 5, "spawnIntervalSeconds": 8.0 }
  ],
  "playerStart": [0, 0, 0],
  "config": {
    "baseExplosionRadius": 5,
    "radiusMultiplier": 0.5,
    "chainThreshold": 3,
    "powerGainIncrement": 1,
    "powerDecrement": 1,
    "maxPower": 100,
    "enemySpeed": 8,
    "playerMaxSpeed": 50,
    "playerAcceleration": 20,
    "decelerationTime": 0.5
  }
}
```

### HUD.js — DOM Overlay

```js
class HUD {
  sync(gameState)                   // called after every state mutation
  updatePowerBar(current, max)
  updateGeneratorBars(generators)
  updateLevel(levelIndex)
  showLevelComplete()
  hideLevelComplete()
  showGameOver()
  showWebGLError()
  showAssetError(assetName)
}
```

The HUD is a fixed-position CSS overlay rendered entirely in the DOM (no canvas drawing). Absolutely positioned `<div>` elements use `width: X%` for bar fills. This keeps HUD rendering fully separate from WebGL and naturally responsive.

---

## Data Models

### GameState

```js
{
  phase: 'LOADING' | 'PLAYING' | 'PAUSED' | 'LEVEL_COMPLETE' | 'GAME_OVER',
  levelIndex: number,          // 1-based
  powerLevel: number,          // [1, 100]
  maxPowerLevel: number,       // 100
  enemies: Enemy[],
  generators: Generator[],
  walls: AABB[],               // pre-computed from level JSON
  config: LevelConfig,
  chainDepth: number,          // tracks current chain reaction depth
  explosionQueue: ExplosionJob[],
}
```

### Entity Models

```js
// Enemy
{
  id: string,
  position: { x, y, z },
  velocity: { x, y, z },
  radius: number,              // bounding sphere radius
  mesh: THREE.Mesh,            // reference to scene object
}

// Generator
{
  id: string,
  position: { x, y, z },
  currentHp: number,
  maxHp: number,
  spawnIntervalSeconds: number,
  lastSpawnTime: number,       // timestamp
  radius: number,              // bounding sphere radius
  mesh: THREE.Mesh,
  hpBarElement: HTMLElement,
}

// PlayerShip
{
  position: { x, y, z },
  velocity: { x, y, z },
  radius: number,
  mesh: THREE.Mesh,
}

// AABB (wall)
{
  min: { x, y, z },
  max: { x, y, z },
  normal: { x, y, z },   // dominant face normal, pre-computed for quick reflection
}

// ExplosionJob (queue entry)
{
  center: { x, y, z },
  radius: number,
  isChain: boolean,
  chainDepth: number,
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

These properties are implemented using [fast-check](https://fast-check.dev/) with Vitest. Each property runs a minimum of 100 iterations with randomized inputs. Physics and formula modules are pure functions with no DOM or WebGL dependency, making them ideal for PBT.

---

### Property 1: Ship Thrust Acceleration Never Exceeds Maximum Speed

*For any* initial velocity vector and any positive delta time, applying thrust acceleration in any direction should result in a velocity whose magnitude does not exceed `maxSpeed` (50 units/s). When multiple keys are held, the input direction is normalized first so diagonal movement cannot exceed the speed cap.

**Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.9**

---

### Property 2: Ship Deceleration Reaches Zero Within Time Limit

*For any* initial velocity vector with magnitude ≤ 50, simulating deceleration over exactly 0.5 seconds with the configured deceleration rate should produce a velocity with magnitude ≤ ε (near-zero tolerance).

**Validates: Requirements 1.8**

---

### Property 3: Camera Pitch Is Always Clamped

*For any* sequence of vertical mouse delta values, the accumulated pitch angle should always remain within the inclusive range [-80°, +80°] regardless of the order or magnitude of inputs.

**Validates: Requirements 1.6**

---

### Property 4: Explosion Radius Formula Is Monotonically Increasing with Power Level

*For any* Power_Level `p` in [1, 100], `base_radius > 0`, and `radius_multiplier ≥ 0`, the computed explosion radius equals `base_radius + (p × radius_multiplier)`. For any two Power_Level values p1 < p2, the radius at p1 is strictly less than or equal to the radius at p2 (monotone non-decreasing).

**Validates: Requirements 2.1, 5.2**

---

### Property 5: Explosion Blast Collection — All In-Radius Enemies Captured

*For any* explosion center, radius, and list of enemy positions, the set of enemies returned by `collectHits(center, radius, enemies)` is exactly the set of enemies whose bounding sphere center is within `radius + enemy.radius` of the center. No enemy within range is missed; no enemy out of range is included.

**Validates: Requirements 2.3, 2.4, 2.8**

---

### Property 6: Chain Reaction Power Gain Obeys Threshold and Maximum

*For any* current Power_Level `p` in [1, 100], chain depth `d`, configured `chainThreshold` in [3, 10], `increment` in [1, 10], and `maxPower = 100`: after the chain resolves, if `d ≥ chainThreshold` then new Power_Level = `min(p + increment, 100)`; otherwise Power_Level is unchanged.

**Validates: Requirements 2.6, 5.3**

---

### Property 7: Wall Reflection Preserves Speed and Reverses Normal Component

*For any* velocity vector `v` (non-zero) and any unit wall normal `n`, the reflected vector `v' = reflect(v, n)` satisfies:
- `|v'| = |v|` (speed magnitude preserved, within floating-point tolerance)
- The component of `v'` along `n` equals the negative of the component of `v` along `n`
- The component of `v'` perpendicular to `n` equals the corresponding component of `v`

This covers player-wall, enemy-wall, and all reflection scenarios with the same function.

**Validates: Requirements 3.3, 6.2, 6.3**

---

### Property 8: Power Level Decrement Is Bounded Below by 1

*For any* current Power_Level `p` in [1, 100] and any configurable decrement `d` in [1, 10], after an enemy contact, new Power_Level = `max(1, p - d)`. The result is always ≥ 1.

**Validates: Requirements 3.4, 5.4, 5.6**

---

### Property 9: Generator HP Bar Fill Ratio Is Always in [0, 1]

*For any* generator with `currentHp` in [0, maxHp] and `maxHp` in [1, 1000], the bar fill ratio `currentHp / maxHp` is always in the closed interval [0.0, 1.0].

**Validates: Requirements 4.2**

---

### Property 10: Generator HP Decreases by Exactly One Per Explosion Hit

*For any* generator with `currentHp` in [1, maxHp], after one explosion intersection, the new `currentHp` equals `max(0, currentHp - 1)`.

**Validates: Requirements 2.5**

---

### Property 11: Level Spawn Intervals Are Monotonically Non-Increasing with Floor

*For any* sequence of level configs where each level's spawn interval is computed as `max(0.5, prev × (1 - decreasePct))` with `decreasePct` in [0.01, 0.50], the sequence of intervals is non-increasing and never falls below 0.5 seconds.

**Validates: Requirements 4.5, 7.3**

---

### Property 12: Level Generator Counts Are Monotonically Non-Decreasing with Ceiling

*For any* starting generator count `c` in [1, 20] and any sequence of per-level increments in [1, 5], the generator count at each level equals `min(20, prev + increment)`. The sequence is non-decreasing and never exceeds 20.

**Validates: Requirements 7.4**

---

## Error Handling

### WebGL Not Available (Requirement 9.5)

In `main.js`, before any Three.js import is used, call `document.createElement('canvas').getContext('webgl2') || getContext('webgl')`. If both return null, call `HUD.showWebGLError()` and return early — no renderer is constructed.

### Asset Load Failure (Requirement 9.6)

`LevelLoader.loadLevel()` uses `fetch()` wrapped in a try/catch. On network error or JSON parse failure, it calls `HUD.showAssetError(assetName)` and returns a rejected Promise. `Game.start()` catches this and stays in `LOADING` phase without starting the loop.

### Invalid Level Config (Requirement 7.2)

`validateLevelData()` checks all required fields and ranges. If validation fails, it throws a typed `LevelConfigError`. `Game.loadLevel()` catches this, shows the error UI, and leaves `GameState.levelIndex` unchanged.

### Floating-Point Velocity Micro-Drift (Requirement 6.6)

In `Physics.snapSmallComponent()`, after each reflection, any velocity component whose absolute value is less than `0.01 × |v|` (1% of pre-collision speed) is set to exactly 0. This prevents infinite micro-bounce on near-parallel wall grazes.

### Generator Destroyed Mid-Frame

Generators and enemies are flagged with `pendingRemoval = true` during `update()`, then batch-removed from `GameState` arrays and the Three.js scene at the end of the frame, before `render()`. This avoids mutating the iteration array mid-loop.

---

## Testing Strategy

### Approach

Webtend uses a dual-layer testing strategy:

1. **Property-based tests** (fast-check + Vitest) for all pure logic functions. These run against physics, explosion math, and level config logic without any DOM or WebGL dependency.
2. **Example-based unit tests** (Vitest) for specific scenarios: WebGL fallback, asset error handling, game-over trigger, level complete sequence.

### Test Runner Setup

```
/webtend/
└── tests/
    ├── physics.test.js          # Properties 1, 2, 7, 8
    ├── explosion.test.js        # Properties 4, 5, 6, 10
    ├── generator.test.js        # Properties 9, 11, 12
    ├── levelLoader.test.js      # Error handling examples
    └── hud.test.js              # HUD update examples
```

Run with: `npx vitest --run` (single pass, no watch mode).

### Property Test Configuration

Each property test uses `fc.assert(fc.property(...), { numRuns: 100 })`. Tests are tagged with a comment linking to the design property:

```js
// Feature: webtend-game, Property 7: Wall reflection preserves speed and angle
test('reflect preserves speed magnitude', () => {
  fc.assert(fc.property(
    fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),  // velocity
    fc.record({ x: fc.float(), y: fc.float(), z: fc.float() })   // normal (will be normalized)
      .filter(n => magnitude(n) > 0.001),
    (vel, rawNormal) => {
      const n = normalize(rawNormal);
      const reflected = reflect(vel, n);
      return Math.abs(magnitude(reflected) - magnitude(vel)) < 1e-5;
    }
  ), { numRuns: 100 });
});
```

### Pure Function Isolation

`Physics.js` and the pure parts of `ExplosionSystem.js` (radius calculation, hit collection) are written with **no imports** from Three.js or DOM APIs. This means property tests run in a Node.js environment (Vitest's default) without any jsdom or webgl mock.

### Example-Based Tests

Example tests cover:
- WebGL detection: mock `getContext` to return null, verify `HUD.showWebGLError()` is called
- Asset failure: mock `fetch` to reject, verify error UI shown and game does not start
- Level advance: mock level configs 1–5, verify state transitions correctly
- Game-over: reduce `powerLevel` to 0, verify game-over screen shown
- Generator removal: reduce generator HP to 0, verify mesh removed and spawning stops

### Integration (Manual / Not Automated)

- FPS benchmark: run the game in Chrome on target hardware, observe frame rate in DevTools
- Camera clip test: navigate player into a corner, observe camera repositioning
- Chain reaction visual: trigger a 5-enemy chain, observe distinct visual effects
