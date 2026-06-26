// EnemyAI.js — Enemy movement: straight-line with wall reflection.
// All vectors are plain { x, y, z } objects — no Three.js dependency.

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

function magnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v) {
  const m = magnitude(v);
  if (m === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

// ---------------------------------------------------------------------------
// Closest point on AABB to a given point
// ---------------------------------------------------------------------------

function closestPointOnAABB(point, aabb) {
  return {
    x: Math.max(aabb.min.x, Math.min(point.x, aabb.max.x)),
    y: Math.max(aabb.min.y, Math.min(point.y, aabb.max.y)),
    z: Math.max(aabb.min.z, Math.min(point.z, aabb.max.z)),
  };
}

// ---------------------------------------------------------------------------
// EnemyAI class
// ---------------------------------------------------------------------------

export class EnemyAI {
  /**
   * @param {object} config — must include at least:
   *   - enemySpeed: max speed for enemies
   *   - avoidRadius: distance at which walls start repelling (default 5)
   */
  constructor(config) {
    this.config = config;
    if (this.config.avoidRadius == null) {
      this.config.avoidRadius = 5;
    }
  }

  /**
   * Compute the initial heading for a newly spawned enemy.
   * Direction is from the spawn position toward the player's current position.
   * If spawn and player are at the same position, pick a random direction.
   * @param {{ x,y,z }} spawnPos
   * @param {{ x,y,z }} playerPos
   * @returns {{ x,y,z }} unit direction vector
   */
  computeSpawnHeading(spawnPos, playerPos) {
    const diff = sub(playerPos, spawnPos);
    const m = magnitude(diff);
    if (m < 1e-6) {
      // Random direction on XZ plane
      const angle = Math.random() * Math.PI * 2;
      return { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
    }
    return normalize(diff);
  }

  /**
   * Reflect a velocity vector off a wall normal.
   * v' = v - 2(v·n)n
   * @param {{ x,y,z }} velocity
   * @param {{ x,y,z }} normal — unit vector
   * @returns {{ x,y,z }}
   */
  reflect(velocity, normal) {
    const d = dot(velocity, normal);
    return {
      x: velocity.x - 2 * d * normal.x,
      y: velocity.y - 2 * d * normal.y,
      z: velocity.z - 2 * d * normal.z,
    };
  }

  /**
   * Check if enemy sphere overlaps an AABB wall.
   * @param {{ x,y,z }} pos — enemy center
   * @param {number} radius — enemy radius
   * @param {{ min: {x,y,z}, max: {x,y,z} }} aabb
   * @returns {{ hit: boolean, normal: {x,y,z}, depth: number }}
   */
  checkWallCollision(pos, radius, aabb) {
    const closest = closestPointOnAABB(pos, aabb);
    const diff = sub(pos, closest);
    const distance = magnitude(diff);

    if (distance >= radius) {
      return { hit: false, normal: { x: 0, y: 0, z: 0 }, depth: 0 };
    }

    let normal;
    if (distance < 1e-10) {
      normal = { x: 0, y: 1, z: 0 }; // fallback
    } else {
      normal = normalize(diff);
    }

    return { hit: true, normal, depth: radius - distance };
  }

  /**
   * Update enemy: move in a straight line along its heading, bounce off walls.
   * Enemy must have a `heading` property (unit vector) set at spawn time.
   * @param {{ position: {x,y,z}, velocity: {x,y,z}, heading: {x,y,z}, radius: number }} enemy — mutated in place
   * @param {{ x,y,z }} playerPos — not used for movement (kept for API compatibility)
   * @param {Array<{ min: {x,y,z}, max: {x,y,z} }>} walls
   * @param {number} dt — delta time in seconds
   */
  update(enemy, playerPos, walls, dt) {
    // Move along heading at enemySpeed
    enemy.velocity = scale(enemy.heading, this.config.enemySpeed);

    // Update position
    enemy.position = add(enemy.position, scale(enemy.velocity, dt));

    // Check wall collisions and bounce
    const enemyRadius = enemy.radius || 1.0;
    for (const wall of walls) {
      const result = this.checkWallCollision(enemy.position, enemyRadius, wall);
      if (result.hit) {
        // Reflect heading off the wall
        enemy.heading = normalize(this.reflect(enemy.heading, result.normal));
        // Push out of wall
        enemy.position = add(enemy.position, scale(result.normal, result.depth));
        // Update velocity to match new heading
        enemy.velocity = scale(enemy.heading, this.config.enemySpeed);
      }
    }
  }
}
