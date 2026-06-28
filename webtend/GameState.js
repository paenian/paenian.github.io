/**
 * GameState.js
 * Shared mutable game state and entity model type definitions.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 7.5
 */

// ---------------------------------------------------------------------------
// JSDoc type definitions for entity models
// These are documentation-only — no runtime cost.
// ---------------------------------------------------------------------------

/**
 * @typedef {{ x: number, y: number, z: number }} Vec3
 */

/**
 * @typedef {Object} AABB
 * @property {Vec3} min   - Minimum corner of the axis-aligned bounding box.
 * @property {Vec3} max   - Maximum corner of the axis-aligned bounding box.
 * @property {Vec3} normal - Dominant face normal, pre-computed for quick reflection.
 */

/**
 * @typedef {Object} Enemy
 * @property {string}        id
 * @property {Vec3}          position
 * @property {Vec3}          velocity
 * @property {Vec3}          heading  - Fixed direction set at spawn time (unit vector).
 * @property {number}        radius   - Bounding sphere radius.
 * @property {number}        [capsuleHalfLength] - Half-length of oriented capsule axis (default 1.5).
 * @property {number}        [capsuleRadius]     - Radius of oriented capsule swept sphere (default 0.8).
 * @property {THREE.Mesh}    mesh     - Reference to the Three.js scene object.
 * @property {boolean}       [pendingRemoval] - Flagged true during mid-frame removal.
 */

/**
 * @typedef {Object} Generator
 * @property {string}        id
 * @property {Vec3}          position
 * @property {number}        currentHp
 * @property {number}        maxHp
 * @property {number}        spawnIntervalSeconds
 * @property {number}        lastSpawnTime  - Timestamp (seconds) of last spawn.
 * @property {number}        radius         - Bounding sphere radius.
 * @property {THREE.Mesh}    mesh
 * @property {HTMLElement}   hpBarElement
 * @property {boolean}       [pendingRemoval]
 */

/**
 * @typedef {Object} PlayerShip
 * @property {Vec3}          position
 * @property {Vec3}          velocity
 * @property {number}        radius
 * @property {THREE.Mesh}    mesh
 */

/**
 * @typedef {Object} ExplosionJob
 * @property {Vec3}    center
 * @property {number}  radius
 * @property {boolean} isChain
 * @property {number}  chainDepth
 */

/**
 * @typedef {Object} LevelConfig
 * @property {number} baseExplosionRadius
 * @property {number} radiusMultiplier
 * @property {number} chainThreshold
 * @property {number} powerGainIncrement
 * @property {number} powerDecrement
 * @property {number} maxPower
 * @property {number} enemySpeed
 * @property {number} playerMaxSpeed
 * @property {number} playerAcceleration
 * @property {number} decelerationTime
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a [x, y, z] array to a {x, y, z} object.
 * @param {number[]} arr
 * @returns {Vec3}
 */
function arrayToVec3(arr) {
  return { x: arr[0], y: arr[1], z: arr[2] };
}

/**
 * Clamp a value to the inclusive range [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Default generator bounding sphere radius (visual stand-in until mesh is assigned).
const GENERATOR_DEFAULT_RADIUS = 2.0;

// ---------------------------------------------------------------------------
// GameState
// ---------------------------------------------------------------------------

/**
 * Shared mutable state for the running game.
 *
 * All subsystems read from and write to this object; only `Game.js` should
 * call `reset()` to re-initialize between levels.
 *
 * @type {{
 *   phase: 'LOADING'|'PLAYING'|'PAUSED'|'LEVEL_COMPLETE'|'GAME_OVER'|'DYING',
 *   levelIndex: number,
 *   powerLevel: number,
 *   maxPowerLevel: number,
 *   enemies: Enemy[],
 *   generators: Generator[],
 *   walls: AABB[],
 *   config: LevelConfig|null,
 *   chainDepth: number,
 *   explosionQueue: ExplosionJob[],
 *   reset: function(Object): void,
 * }}
 */
const GameState = {
  phase: 'LOADING',
  levelIndex: 1,
  powerLevel: 1,
  maxPowerLevel: 100,

  /** @type {Enemy[]} */
  enemies: [],

  /** @type {Generator[]} */
  generators: [],

  /** @type {AABB[]} */
  walls: [],

  /** @type {LevelConfig|null} */
  config: null,

  chainDepth: 0,

  desperationFailed: false,

  /** @type {ExplosionJob[]} */
  explosionQueue: [],

  /**
   * Initialize (or re-initialize) game state from a loaded level config object.
   *
   * @param {Object} levelData  - Validated object returned by `LevelLoader.loadLevel()`.
   * @param {number} levelData.id
   * @param {number} levelData.initialPowerLevel
   * @param {Object[]} levelData.walls          - Raw wall objects with min/max as arrays.
   * @param {Object[]} levelData.generators     - Raw generator descriptors.
   * @param {LevelConfig} levelData.config
   */
  reset(levelData) {
    this.phase = 'LOADING';
    this.levelIndex = levelData.id;

    // Clamp initial power level to [0, 100] (Requirement 5.1)
    this.powerLevel = clamp(levelData.initialPowerLevel, 0, 100);
    this.maxPowerLevel = (levelData.config && levelData.config.maxPower) || 100;

    // Convert walls from JSON array format to {min,max,normal} objects (Requirement 6.1)
    this.walls = (levelData.walls || []).map((w) => ({
      min: arrayToVec3(w.min),
      max: arrayToVec3(w.max),
      // Pre-compute a dominant face normal for fast reflection.
      // The normal is derived from the largest dimension extent; callers may
      // override this with a precise normal after scene construction.
      normal: _computeDominantNormal(w),
    }));

    // Convert generators from JSON to Generator objects (Requirements 4.1–4.6)
    this.generators = (levelData.generators || []).map((g) => ({
      id: g.id,
      position: arrayToVec3(g.position),
      currentHp: g.maxHp,
      maxHp: g.maxHp,
      spawnIntervalSeconds: g.spawnIntervalSeconds,
      lastSpawnTime: 0,
      radius: GENERATOR_DEFAULT_RADIUS,
      mesh: null,          // assigned by Renderer.buildScene()
      hpBarElement: null,  // assigned by HUD
      pendingRemoval: false,
    }));

    // Clear runtime arrays
    this.enemies = [];

    // Store the level configuration (Requirement 5.2)
    this.config = levelData.config;

    // Reset chain tracking (Requirement 2.6)
    this.chainDepth = 0;
    this.desperationFailed = false;
    this.explosionQueue = [];
  },
};

/**
 * Compute a dominant face normal for a wall AABB.
 * Returns the axis unit vector corresponding to the wall's thinnest dimension,
 * pointing in the positive direction. This heuristic works well for axis-aligned
 * maze walls where one dimension is clearly smaller (the "thickness").
 *
 * @param {{ min: number[], max: number[] }} rawWall
 * @returns {Vec3}
 */
function _computeDominantNormal(rawWall) {
  const dx = rawWall.max[0] - rawWall.min[0];
  const dy = rawWall.max[1] - rawWall.min[1];
  const dz = rawWall.max[2] - rawWall.min[2];

  // The thinnest axis is the normal axis.
  if (dx <= dy && dx <= dz) return { x: 1, y: 0, z: 0 };
  if (dy <= dx && dy <= dz) return { x: 0, y: 1, z: 0 };
  return { x: 0, y: 0, z: 1 };
}

// ---------------------------------------------------------------------------
// PlayerShip — mutable singleton, managed separately from GameState
// ---------------------------------------------------------------------------

/**
 * The player's ship state.  Kept separate from `GameState` so subsystems that
 * only need ship data don't have to import the full state.
 *
 * `mesh` and `radius` are assigned by `Renderer.buildScene()`.
 *
 * @type {PlayerShip}
 */
const playerShip = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  radius: 1.0,
  mesh: null,
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { GameState, playerShip };
