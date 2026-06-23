// Physics.js — Pure vector operations with no Three.js dependency.
// All vectors are plain { x, y, z } objects.

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function magnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v) {
  const m = magnitude(v);
  if (m === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reflect a velocity vector off a surface with the given unit normal.
 * v' = v - 2(v·n)n
 * @param {{ x: number, y: number, z: number }} velocity
 * @param {{ x: number, y: number, z: number }} wallNormal — must be a unit vector
 * @returns {{ x: number, y: number, z: number }}
 */
export function reflect(velocity, wallNormal) {
  const d = dot(velocity, wallNormal);
  return sub(velocity, scale(wallNormal, 2 * d));
}

/**
 * Apply thrust acceleration in a given direction, clamped to maxSpeed.
 * Normalizes dir first; if dir is zero-length returns current vel unchanged.
 * @param {{ x: number, y: number, z: number }} vel
 * @param {{ x: number, y: number, z: number }} dir — movement direction (need not be unit)
 * @param {number} accel — units per second squared
 * @param {number} maxSpeed — units per second
 * @param {number} dt — delta time in seconds
 * @returns {{ x: number, y: number, z: number }}
 */
export function applyAcceleration(vel, dir, accel, maxSpeed, dt) {
  const normDir = normalize(dir);
  // Zero direction means no thrust
  if (normDir.x === 0 && normDir.y === 0 && normDir.z === 0) {
    return { x: vel.x, y: vel.y, z: vel.z };
  }
  const newVel = add(vel, scale(normDir, accel * dt));
  return clampSpeed(newVel, maxSpeed);
}

/**
 * Apply uniform deceleration toward zero.
 * Reduces the speed by decelRate * dt, clamped so it never overshoots zero.
 * @param {{ x: number, y: number, z: number }} vel
 * @param {number} decelRate — units per second squared (e.g. maxSpeed / decelTime)
 * @param {number} dt — delta time in seconds
 * @returns {{ x: number, y: number, z: number }}
 */
export function applyDeceleration(vel, decelRate, dt) {
  const speed = magnitude(vel);
  if (speed === 0) return { x: 0, y: 0, z: 0 };
  const reduction = decelRate * dt;
  const newSpeed = Math.max(0, speed - reduction);
  if (newSpeed === 0) return { x: 0, y: 0, z: 0 };
  return scale(normalize(vel), newSpeed);
}

/**
 * Clamp a velocity vector so its magnitude does not exceed maxSpeed.
 * @param {{ x: number, y: number, z: number }} vel
 * @param {number} maxSpeed
 * @returns {{ x: number, y: number, z: number }}
 */
export function clampSpeed(vel, maxSpeed) {
  const speed = magnitude(vel);
  if (speed <= maxSpeed) return { x: vel.x, y: vel.y, z: vel.z };
  return scale(normalize(vel), maxSpeed);
}

/**
 * Test a sphere against an AABB. Returns hit info.
 * Handles the case where the sphere center is inside the AABB.
 * @param {{ x: number, y: number, z: number }} sphereCenter
 * @param {number} sphereRadius
 * @param {{ min: { x, y, z }, max: { x, y, z } }} aabb
 * @returns {{ hit: boolean, normal: { x, y, z }, depth: number }}
 */
export function checkSphereAABB(sphereCenter, sphereRadius, aabb) {
  const { min, max } = aabb;

  // Determine if center is inside AABB
  const insideX = sphereCenter.x >= min.x && sphereCenter.x <= max.x;
  const insideY = sphereCenter.y >= min.y && sphereCenter.y <= max.y;
  const insideZ = sphereCenter.z >= min.z && sphereCenter.z <= max.z;
  const inside = insideX && insideY && insideZ;

  if (inside) {
    // Center is inside — find the closest face and push out along that axis
    const distMinX = sphereCenter.x - min.x;
    const distMaxX = max.x - sphereCenter.x;
    const distMinY = sphereCenter.y - min.y;
    const distMaxY = max.y - sphereCenter.y;
    const distMinZ = sphereCenter.z - min.z;
    const distMaxZ = max.z - sphereCenter.z;

    const minDist = Math.min(distMinX, distMaxX, distMinY, distMaxY, distMinZ, distMaxZ);

    let normal;
    if (minDist === distMinX)      normal = { x: -1, y: 0, z: 0 };
    else if (minDist === distMaxX) normal = { x:  1, y: 0, z: 0 };
    else if (minDist === distMinY) normal = { x: 0, y: -1, z: 0 };
    else if (minDist === distMaxY) normal = { x: 0, y:  1, z: 0 };
    else if (minDist === distMinZ) normal = { x: 0, y: 0, z: -1 };
    else                           normal = { x: 0, y: 0, z:  1 };

    return { hit: true, normal, depth: sphereRadius + minDist };
  }

  // Find the closest point on the AABB to the sphere center
  const closest = {
    x: Math.max(min.x, Math.min(sphereCenter.x, max.x)),
    y: Math.max(min.y, Math.min(sphereCenter.y, max.y)),
    z: Math.max(min.z, Math.min(sphereCenter.z, max.z)),
  };

  const diff = sub(sphereCenter, closest);
  const distance = magnitude(diff);

  if (distance >= sphereRadius) {
    return { hit: false, normal: { x: 0, y: 0, z: 0 }, depth: 0 };
  }

  // Determine normal: from closest point on AABB toward sphere center
  let normal;
  if (distance < 1e-10) {
    // Degenerate: sphere center exactly on AABB surface — use +Y fallback
    normal = { x: 0, y: 1, z: 0 };
  } else {
    normal = normalize(diff);
  }

  return { hit: true, normal, depth: sphereRadius - distance };
}

/**
 * Test two spheres for overlap.
 * @param {{ x: number, y: number, z: number }} c1
 * @param {number} r1
 * @param {{ x: number, y: number, z: number }} c2
 * @param {number} r2
 * @returns {{ hit: boolean, normal: { x, y, z }, depth: number }}
 */
export function checkSphereSphere(c1, r1, c2, r2) {
  const diff = sub(c2, c1);
  const distance = magnitude(diff);
  const combinedRadius = r1 + r2;

  if (distance >= combinedRadius) {
    return { hit: false, normal: { x: 0, y: 0, z: 0 }, depth: 0 };
  }

  // Normal points from c1 toward c2 (direction to push c2 away)
  let normal;
  if (distance < 1e-10) {
    // Coincident centers — use arbitrary up axis
    normal = { x: 0, y: 1, z: 0 };
  } else {
    normal = normalize(diff);
  }

  return { hit: true, normal, depth: combinedRadius - distance };
}

/**
 * Set any velocity component whose absolute value is less than threshold * speed
 * to exactly zero, preventing floating-point micro-drift after wall reflections.
 * @param {{ x: number, y: number, z: number }} vel
 * @param {number} threshold — fraction of speed (e.g. 0.01 for 1%)
 * @returns {{ x: number, y: number, z: number }}
 */
export function snapSmallComponent(vel, threshold) {
  const speed = magnitude(vel);
  if (speed === 0) return { x: 0, y: 0, z: 0 };

  const limit = threshold * speed;
  return {
    x: Math.abs(vel.x) < limit ? 0 : vel.x,
    y: Math.abs(vel.y) < limit ? 0 : vel.y,
    z: Math.abs(vel.z) < limit ? 0 : vel.z,
  };
}
