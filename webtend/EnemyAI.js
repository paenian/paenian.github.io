// EnemyAI.js — Steering behavior: seek player, avoid walls.
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
   * Compute desired velocity toward a target (seek steering).
   * Returns the desired velocity vector (direction × enemySpeed).
   * @param {{ position: {x,y,z} }} enemy
   * @param {{ x,y,z }} target
   * @returns {{ x,y,z }}
   */
  seek(enemy, target) {
    const diff = sub(target, enemy.position);
    const dir = normalize(diff);
    return scale(dir, this.config.enemySpeed);
  }

  /**
   * Compute wall-avoidance repulsion vector.
   * For each wall (AABB with min/max), find closest point to enemy;
   * if distance < avoidRadius, add repulsion away from wall scaled by
   * (avoidRadius - distance) / avoidRadius * enemySpeed.
   * @param {{ position: {x,y,z} }} enemy
   * @param {Array<{ min: {x,y,z}, max: {x,y,z} }>} walls
   * @returns {{ x,y,z }}
   */
  avoidWalls(enemy, walls) {
    const avoidRadius = this.config.avoidRadius;
    let repulsion = { x: 0, y: 0, z: 0 };

    for (const wall of walls) {
      const closest = closestPointOnAABB(enemy.position, wall);
      const diff = sub(enemy.position, closest);
      const distance = magnitude(diff);

      if (distance < avoidRadius && distance > 0) {
        // Repulsion direction: away from the wall (from closest point toward enemy)
        const dir = normalize(diff);
        const strength = ((avoidRadius - distance) / avoidRadius) * this.config.enemySpeed;
        repulsion = add(repulsion, scale(dir, strength));
      }
    }

    return repulsion;
  }

  /**
   * Update enemy velocity and position using seek + wall avoidance.
   * @param {{ position: {x,y,z}, velocity: {x,y,z} }} enemy — mutated in place
   * @param {{ x,y,z }} playerPos
   * @param {Array<{ min: {x,y,z}, max: {x,y,z} }>} walls
   * @param {number} dt — delta time in seconds
   */
  update(enemy, playerPos, walls, dt) {
    const seekVec = this.seek(enemy, playerPos);
    const avoidVec = this.avoidWalls(enemy, walls);

    const combined = add(seekVec, avoidVec);
    const combinedMag = magnitude(combined);

    let finalVelocity;
    if (combinedMag === 0) {
      finalVelocity = { x: 0, y: 0, z: 0 };
    } else {
      const speed = Math.min(combinedMag, this.config.enemySpeed);
      finalVelocity = scale(normalize(combined), speed);
    }

    enemy.velocity = finalVelocity;
    enemy.position = add(enemy.position, scale(enemy.velocity, dt));
  }
}
