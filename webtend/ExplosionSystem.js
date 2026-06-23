// ExplosionSystem.js — Click handler, radius calculation, and BFS chain reaction queue.

export class ExplosionSystem {
  constructor(_gameState, _config) {}

  onPlayerClick(_shipPosition) {}
  processExplosion(_center, _radius) {}
  step() {}

  /** @param {number} powerLevel @returns {number} */
  calcRadius(_powerLevel) { return 0; }

  countChainLength() { return 0; }
}

/**
 * Pure function: calculate explosion radius.
 * @param {number} powerLevel
 * @param {{ baseExplosionRadius: number, radiusMultiplier: number }} config
 * @returns {number}
 */
export function calcRadius(_powerLevel, _config) {
  return 0;
}

/**
 * Pure function: collect all entities whose bounding sphere center is within
 * (radius + entity.radius) of the explosion center.
 * @param {{ x: number, y: number, z: number }} center
 * @param {number} radius
 * @param {Array<{ position: { x,y,z }, radius: number }>} enemies
 * @param {Array<{ position: { x,y,z }, radius: number }>} generators
 * @returns {{ hitEnemies: Array, hitGenerators: Array }}
 */
export function collectHits(_center, _radius, _enemies, _generators) {
  return { hitEnemies: [], hitGenerators: [] };
}
