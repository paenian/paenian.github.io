// ExplosionSystem.js — Click handler, radius calculation, and BFS chain reaction queue.

export class ExplosionSystem {
  /**
   * @param {import('./GameState.js').GameState} gameState
   * @param {import('./GameState.js').LevelConfig} config
   */
  constructor(gameState, config) {
    this.gameState = gameState;
    this.config = config;
  }

  /**
   * Enqueue the initial explosion centered on the player ship.
   * Resets chainDepth to 0 before the new chain begins.
   * @param {{ x: number, y: number, z: number }} shipPosition
   */
  onPlayerClick(shipPosition) {
    this.gameState.chainDepth = 0;
    this.gameState.explosionQueue.push({
      center: { ...shipPosition },
      radius: calcRadius(this.gameState.powerLevel, this.config),
      isChain: false,
      chainDepth: 0,
    });
  }

  /**
   * Collect all hits for a single explosion, flag enemies/generators, and
   * enqueue chain explosions for each destroyed enemy.
   * @param {{ x: number, y: number, z: number }} center
   * @param {number} radius
   */
  processExplosion(center, radius) {
    const { hitEnemies, hitGenerators } = collectHits(
      center,
      radius,
      this.gameState.enemies,
      this.gameState.generators,
    );

    // Destroy hit enemies and enqueue chain explosions at their positions.
    for (const enemy of hitEnemies) {
      enemy.pendingRemoval = true;
      this.gameState.explosionQueue.push({
        center: { ...enemy.position },
        radius,
        isChain: true,
        chainDepth: this.gameState.chainDepth + 1,
      });
    }

    // Decrement HP on hit generators; flag for removal when depleted.
    for (const generator of hitGenerators) {
      generator.currentHp -= 1;
      if (generator.currentHp <= 0) {
        generator.pendingRemoval = true;
      }
    }

    // Increment overall chain depth by the number of enemies destroyed this step.
    this.gameState.chainDepth += hitEnemies.length;
  }

  /**
   * Dequeue and process one explosion job (FIFO).
   * When the queue empties, apply the chain power-gain reward if the chain
   * depth met or exceeded the configured threshold.
   */
  step() {
    if (this.gameState.explosionQueue.length === 0) return;

    // Dequeue the next job (FIFO — shift from front).
    const job = this.gameState.explosionQueue.shift();
    this.processExplosion(job.center, job.radius);

    // After processing, check if the queue is now empty (chain resolved).
    if (this.gameState.explosionQueue.length === 0) {
      if (this.gameState.chainDepth >= this.config.chainThreshold) {
        this.gameState.powerLevel = Math.min(
          this.gameState.powerLevel + this.config.powerGainIncrement,
          this.config.maxPower,
        );
      }
      this.gameState.chainDepth = 0;
    }
  }

  /** @param {number} powerLevel @returns {number} */
  calcRadius(powerLevel) {
    return calcRadius(powerLevel, this.config);
  }

  countChainLength() { return this.gameState.chainDepth; }
}

/**
 * Pure function: calculate explosion radius.
 * @param {number} powerLevel
 * @param {{ baseExplosionRadius: number, radiusMultiplier: number }} config
 * @returns {number}
 */
export function calcRadius(powerLevel, config) {
  return config.baseExplosionRadius + powerLevel * config.radiusMultiplier;
}

/**
 * Returns the Euclidean distance between two 3D points.
 * @param {{ x: number, y: number, z: number }} a
 * @param {{ x: number, y: number, z: number }} b
 * @returns {number}
 */
function distance3d(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Pure function: collect all entities whose bounding sphere center is within
 * (radius + entity.radius) of the explosion center.
 * Entities flagged with pendingRemoval === true are excluded.
 * @param {{ x: number, y: number, z: number }} center
 * @param {number} radius
 * @param {Array<{ position: { x: number, y: number, z: number }, radius: number, pendingRemoval?: boolean }>} enemies
 * @param {Array<{ position: { x: number, y: number, z: number }, radius: number, pendingRemoval?: boolean }>} generators
 * @returns {{ hitEnemies: Array, hitGenerators: Array }}
 */
export function collectHits(center, radius, enemies, generators) {
  const isHit = (entity) =>
    entity.pendingRemoval !== true &&
    distance3d(center, entity.position) < radius + entity.radius;

  return {
    hitEnemies: enemies.filter(isHit),
    hitGenerators: generators.filter(isHit),
  };
}
