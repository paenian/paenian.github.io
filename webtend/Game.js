// Game.js — Top-level state machine and game loop.
// States: LOADING | PLAYING | PAUSED | LEVEL_COMPLETE | GAME_OVER
//
// Requirements: 1.2–1.9, 2.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.5, 4.7, 4.8,
//               5.4, 5.6, 6.2, 6.3, 6.6, 7.1, 7.2, 7.5, 9.2, 9.5, 9.6

import { GameState, playerShip } from './GameState.js';
import * as Physics from './Physics.js';
import { loadLevel } from './LevelLoader.js';

export class Game {
  /**
   * 13.0 — Constructor
   * Receives all dependencies via injection.
   * @param {{ renderer, hud, inputHandler, explosionSystem, enemyAI }} deps
   */
  constructor({ renderer, hud, inputHandler, explosionSystem, enemyAI }) {
    this.renderer = renderer;
    this.hud = hud;
    this.input = inputHandler;
    this.explosionSystem = explosionSystem;
    this.enemyAI = enemyAI;
    this.yaw = 0;
    this.pitch = 0;
    this.mouseSensitivity = 0.002;
  }

  /**
   * 13.1 — start()
   * Check WebGL support; on failure show error, on success load level 1.
   */
  start() {
    // WebGL capability check using an offscreen canvas
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    if (!gl) {
      this.hud.showWebGLError();
      return;
    }
    this.loadLevel(1);
  }

  /**
   * 13.2 / 13.3 / 13.4 — update(dt)
   * Main per-frame update: input, physics, collisions, enemy AI, spawning, HUD.
   * @param {number} dt — delta time in seconds
   */
  update(dt) {
    if (GameState.phase === 'DYING') {
      // During DYING: skip input/movement/spawning, continue explosion processing
      this.explosionSystem.step();
      
      // When explosion queue empties, transition to GAME_OVER
      if (GameState.explosionQueue.length === 0) {
        GameState.phase = 'GAME_OVER';
        this.hud.showGameOver();
      }
      return;
    }

    if (GameState.phase !== 'PLAYING') return;

    const config = GameState.config;

    // --- Input reading ---
    const { w, a, s, d } = this.input.keys;
    const { dx, dy } = this.input.mouseDelta;

    // --- Mouse look ---
    this.yaw -= dx * this.mouseSensitivity;
    this.pitch -= dy * this.mouseSensitivity;

    // --- Compute movement direction relative to yaw ---
    let dirX = 0, dirZ = 0;
    if (w) dirZ -= 1;
    if (s) dirZ += 1;
    if (a) dirX -= 1;
    if (d) dirX += 1;

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const worldDirX = dirX * cosY + dirZ * sinY;
    const worldDirZ = -dirX * sinY + dirZ * cosY;
    const moveDir = { x: worldDirX, y: 0, z: worldDirZ };

    // --- Acceleration / deceleration ---
    const hasMoveInput = moveDir.x !== 0 || moveDir.y !== 0 || moveDir.z !== 0;
    if (hasMoveInput) {
      playerShip.velocity = Physics.applyAcceleration(
        playerShip.velocity, moveDir,
        config.playerAcceleration, config.playerMaxSpeed, dt
      );
    } else {
      playerShip.velocity = Physics.applyDeceleration(
        playerShip.velocity,
        config.playerMaxSpeed / config.decelerationTime,
        dt
      );
    }

    // --- Wall collisions ---
    for (const wall of GameState.walls) {
      const result = Physics.checkSphereAABB(playerShip.position, playerShip.radius, wall);
      if (result.hit) {
        // Slide along wall (zero perpendicular component, preserve parallel)
        playerShip.velocity = Physics.wallSlide(playerShip.velocity, result.normal);
        // Snap small components to prevent micro-drift
        playerShip.velocity = Physics.snapSmallComponent(playerShip.velocity, 0.01);
        // Push position out of wall by penetration depth
        playerShip.position = {
          x: playerShip.position.x + result.normal.x * result.depth,
          y: playerShip.position.y + result.normal.y * result.depth,
          z: playerShip.position.z + result.normal.z * result.depth,
        };
      }
    }

    // --- Enemy collisions (13.3) ---
    for (const enemy of GameState.enemies) {
      if (enemy.pendingRemoval) continue;
      const hitResult = Physics.checkSphereSphere(
        playerShip.position, playerShip.radius,
        enemy.position, enemy.radius
      );
      if (hitResult.hit) {
        // Power decrement on collision (floor at 0 — power-zero fix)
        GameState.powerLevel = Math.max(0, GameState.powerLevel - config.powerDecrement);

        // Check for game-over after collision
        if (GameState.powerLevel === 0) {
          this.onGameOver();
          return; // Stop processing this frame
        }

        // Enemy is DESTROYED on contact — no chain explosion, no knockback to player
        enemy.pendingRemoval = true;

        // Push player out of enemy by penetration depth (no velocity change)
        playerShip.position = {
          x: playerShip.position.x - hitResult.normal.x * hitResult.depth,
          y: playerShip.position.y - hitResult.normal.y * hitResult.depth,
          z: playerShip.position.z - hitResult.normal.z * hitResult.depth,
        };
      }
    }

    // --- Update player position ---
    playerShip.position = {
      x: playerShip.position.x + playerShip.velocity.x * dt,
      y: playerShip.position.y + playerShip.velocity.y * dt,
      z: playerShip.position.z + playerShip.velocity.z * dt,
    };

    // --- Update enemies via AI ---
    for (const enemy of GameState.enemies) {
      if (!enemy.pendingRemoval) {
        this.enemyAI.update(enemy, playerShip.position, GameState.walls, dt);
      }
    }

    // --- Enemy-enemy collisions (oriented capsule) ---
    for (let i = 0; i < GameState.enemies.length; i++) {
      const ei = GameState.enemies[i];
      if (ei.pendingRemoval) continue;
      for (let j = i + 1; j < GameState.enemies.length; j++) {
        const ej = GameState.enemies[j];
        if (ej.pendingRemoval) continue;

        // Bounding sphere pre-filter
        const preFilter = Physics.checkSphereSphere(ei.position, ei.radius, ej.position, ej.radius);
        if (!preFilter.hit) continue;

        // Oriented capsule-capsule test
        const capsuleResult = Physics.checkCapsuleCapsule(
          ei.position, ei.heading, ei.capsuleHalfLength || 1.5, ei.capsuleRadius || 0.8,
          ej.position, ej.heading, ej.capsuleHalfLength || 1.5, ej.capsuleRadius || 0.8
        );
        if (!capsuleResult.hit) continue;

        // Apply heading-dependent deflection
        const deflectI = Physics.computeDeflection(ei.heading, { x: -capsuleResult.normal.x, y: -capsuleResult.normal.y, z: -capsuleResult.normal.z }, config.enemySpeed);
        const deflectJ = Physics.computeDeflection(ej.heading, capsuleResult.normal, config.enemySpeed);

        ei.heading = deflectI.heading;
        ei.velocity = deflectI.velocity;
        ej.heading = deflectJ.heading;
        ej.velocity = deflectJ.velocity;

        // Separate by penetration depth
        const halfDepth = capsuleResult.depth / 2;
        ei.position = {
          x: ei.position.x - capsuleResult.normal.x * halfDepth,
          y: ei.position.y - capsuleResult.normal.y * halfDepth,
          z: ei.position.z - capsuleResult.normal.z * halfDepth,
        };
        ej.position = {
          x: ej.position.x + capsuleResult.normal.x * halfDepth,
          y: ej.position.y + capsuleResult.normal.y * halfDepth,
          z: ej.position.z + capsuleResult.normal.z * halfDepth,
        };
      }
    }

    // --- Explosion system step ---
    this.explosionSystem.step();

    // Detect desperation-shot failure
    if (GameState.desperationFailed) {
      GameState.desperationFailed = false;
      this.onGameOver();
      return;
    }

    // --- Enemy spawning (13.4) ---
    const now = performance.now() / 1000;
    for (const gen of GameState.generators) {
      if (gen.currentHp > 0 && !gen.pendingRemoval && (now - gen.lastSpawnTime >= gen.spawnIntervalSeconds)) {
        const enemy = {
          id: `enemy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          position: { ...gen.position },
          velocity: { x: 0, y: 0, z: 0 },
          heading: this.enemyAI.computeSpawnHeading(gen.position, playerShip.position),
          radius: 2.3,
          capsuleHalfLength: 1.5,
          capsuleRadius: 0.8,
          mesh: null,
          pendingRemoval: false,
        };
        GameState.enemies.push(enemy);
        this.renderer.addEnemy(enemy);
        gen.lastSpawnTime = now;
      }
    }

    // --- HUD sync ---
    this.hud.sync(GameState);

    // --- Camera update ---
    this.renderer.updateCameraRig(playerShip.position, this.yaw, this.pitch);

    // --- Check level complete ---
    const allGeneratorsDown = GameState.generators.every(
      (g) => g.pendingRemoval === true || g.currentHp <= 0
    );
    if (allGeneratorsDown) {
      this.onLevelComplete();
    }
  }

  /**
   * 13.5 — onLevelComplete()
   * Transition to LEVEL_COMPLETE, show overlay, then advance to next level.
   */
  onLevelComplete() {
    GameState.phase = 'LEVEL_COMPLETE';
    this.hud.showLevelComplete();
    setTimeout(() => {
      this.hud.hideLevelComplete();
      this.loadLevel(GameState.levelIndex + 1);
    }, 2000);
  }

  /**
   * 13.5 — onGameOver()
   * Transition to DYING phase, spawn death explosion, then wait for chain resolution.
   */
  onGameOver() {
    GameState.phase = 'DYING';
    
    // Calculate max-radius death explosion
    const maxRadius = GameState.config.baseExplosionRadius + 
      GameState.config.maxPower * GameState.config.radiusMultiplier;
    
    // Enqueue death explosion into the explosion queue
    GameState.explosionQueue.push({
      center: { ...playerShip.position },
      radius: maxRadius,
      isChain: false,
      chainDepth: 0,
    });
    
    // Spawn the slow-expanding visual effect
    if (this.renderer.spawnDeathExplosionEffect) {
      this.renderer.spawnDeathExplosionEffect(playerShip.position, maxRadius, 2500);
    }
  }

  /**
   * 13.5 — loadLevel(index)
   * Fetch level data, reset state, position player, and build the 3D scene.
   * @param {number} index — 1-based level index
   */
  async loadLevel(index) {
    GameState.phase = 'LOADING';
    try {
      const levelData = await loadLevel(index);
      GameState.reset(levelData);

      // Set player start position
      playerShip.position = {
        x: levelData.playerStart[0],
        y: levelData.playerStart[1],
        z: levelData.playerStart[2],
      };
      playerShip.velocity = { x: 0, y: 0, z: 0 };

      // Update explosion system config reference
      this.explosionSystem.config = GameState.config;

      // Build the 3D scene
      this.renderer.buildScene(levelData);

      GameState.phase = 'PLAYING';
    } catch (err) {
      this.hud.showAssetError(err.message || `Level ${index}`);
    }
  }
}
