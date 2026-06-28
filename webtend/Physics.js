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

/**
 * Find the closest pair of points between two 3D line segments.
 * Segment 1: P(s) = p1 + s*d1 for s ∈ [0,1]
 * Segment 2: Q(t) = p2 + t*d2 for t ∈ [0,1]
 * @param {{ x,y,z }} p1 - Start of segment 1
 * @param {{ x,y,z }} d1 - Direction vector of segment 1 (end - start)
 * @param {{ x,y,z }} p2 - Start of segment 2
 * @param {{ x,y,z }} d2 - Direction vector of segment 2 (end - start)
 * @returns {{ point1: {x,y,z}, point2: {x,y,z}, distance: number }}
 */
export function closestPointsOnSegments(p1, d1, p2, d2) {
  const r = sub(p1, p2);
  const a = dot(d1, d1); // |d1|²
  const e = dot(d2, d2); // |d2|²
  const f = dot(d2, r);

  // Handle degenerate segments (zero-length)
  if (a < 1e-10 && e < 1e-10) {
    return { point1: { ...p1 }, point2: { ...p2 }, distance: magnitude(r) };
  }
  if (a < 1e-10) {
    const t = Math.max(0, Math.min(1, f / e));
    const point2 = add(p2, scale(d2, t));
    return { point1: { ...p1 }, point2, distance: magnitude(sub(p1, point2)) };
  }

  const c = dot(d1, r);
  if (e < 1e-10) {
    const s = Math.max(0, Math.min(1, -c / a));
    const point1 = add(p1, scale(d1, s));
    return { point1, point2: { ...p2 }, distance: magnitude(sub(point1, p2)) };
  }

  // General case: both segments non-degenerate
  const b = dot(d1, d2);
  const denom = a * e - b * b;

  let s, t;
  if (Math.abs(denom) < 1e-10) {
    // Segments are parallel — pick s=0, solve for t
    s = 0;
    t = f / e;
  } else {
    s = (b * f - c * e) / denom;
    t = (a * f - b * c) / denom;
  }

  // Clamp s to [0,1] and recompute t, then clamp t and recompute s
  s = Math.max(0, Math.min(1, s));
  t = (b * s + f) / e;

  if (t < 0) {
    t = 0;
    s = Math.max(0, Math.min(1, -c / a));
  } else if (t > 1) {
    t = 1;
    s = Math.max(0, Math.min(1, (b - c) / a));
  }

  const point1 = add(p1, scale(d1, s));
  const point2 = add(p2, scale(d2, t));
  return { point1, point2, distance: magnitude(sub(point1, point2)) };
}

/**
 * Check two oriented capsules for intersection.
 * Each capsule is defined by: center, heading (unit), halfLength, and radius.
 * The capsule axis runs from center - halfLength*heading to center + halfLength*heading.
 * @param {{ x,y,z }} pos1
 * @param {{ x,y,z }} heading1
 * @param {number} halfLen1
 * @param {number} radius1
 * @param {{ x,y,z }} pos2
 * @param {{ x,y,z }} heading2
 * @param {number} halfLen2
 * @param {number} radius2
 * @returns {{ hit: boolean, normal: {x,y,z}, depth: number }}
 */
export function checkCapsuleCapsule(pos1, heading1, halfLen1, radius1, pos2, heading2, halfLen2, radius2) {
  // Build segment endpoints
  const seg1Start = sub(pos1, scale(heading1, halfLen1));
  const seg1Dir = scale(heading1, halfLen1 * 2);
  const seg2Start = sub(pos2, scale(heading2, halfLen2));
  const seg2Dir = scale(heading2, halfLen2 * 2);

  // Find closest points between the two axis segments
  const { point1, point2, distance } = closestPointsOnSegments(seg1Start, seg1Dir, seg2Start, seg2Dir);

  const combinedRadius = radius1 + radius2;

  if (distance >= combinedRadius) {
    return { hit: false, normal: { x: 0, y: 0, z: 0 }, depth: 0 };
  }

  // Contact normal: from point1 toward point2
  let normal;
  if (distance < 1e-10) {
    // Coincident closest points — choose a normal perpendicular to the shared axis
    // Try cross product of headings to get a separation direction
    const cross = {
      x: heading1.y * heading2.z - heading1.z * heading2.y,
      y: heading1.z * heading2.x - heading1.x * heading2.z,
      z: heading1.x * heading2.y - heading1.y * heading2.x,
    };
    const crossMag = magnitude(cross);
    if (crossMag > 1e-6) {
      normal = { x: cross.x / crossMag, y: cross.y / crossMag, z: cross.z / crossMag };
    } else {
      // Headings are parallel — pick an arbitrary perpendicular direction
      // Find a vector not parallel to heading1
      const ref = Math.abs(heading1.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
      const perp = {
        x: heading1.y * ref.z - heading1.z * ref.y,
        y: heading1.z * ref.x - heading1.x * ref.z,
        z: heading1.x * ref.y - heading1.y * ref.x,
      };
      normal = normalize(perp);
    }
  } else {
    normal = normalize(sub(point2, point1));
  }

  return { hit: true, normal, depth: combinedRadius - distance };
}

/**
 * Compute heading-dependent deflection for an enemy-enemy collision.
 * @param {{ x,y,z }} heading - Current heading (unit vector)
 * @param {{ x,y,z }} contactNormal - Contact normal (points away from this enemy)
 * @param {number} enemySpeed - Constant enemy speed
 * @returns {{ heading: {x,y,z}, velocity: {x,y,z} }}
 */
export function computeDeflection(heading, contactNormal, enemySpeed) {
  const DEFLECTION_STRENGTH = 0.3;

  // noseFactor: how head-on is the contact? 1.0 = nose-on, 0.0 = side
  const noseFactor = Math.abs(dot(heading, contactNormal));

  // Full reflection: v - 2(v·n)n
  const fullReflection = reflect(heading, contactNormal);

  // Partial deflection: heading + strength * normal, then normalize
  const partial = normalize(add(heading, scale(contactNormal, DEFLECTION_STRENGTH)));

  // Blend based on noseFactor: lerp(partial, fullReflection, noseFactor)
  const blended = {
    x: partial.x * (1 - noseFactor) + fullReflection.x * noseFactor,
    y: partial.y * (1 - noseFactor) + fullReflection.y * noseFactor,
    z: partial.z * (1 - noseFactor) + fullReflection.z * noseFactor,
  };

  const newHeading = normalize(blended);
  const velocity = scale(newHeading, enemySpeed);

  return { heading: newHeading, velocity };
}

/**
 * Slide velocity along a wall surface by removing the perpendicular component.
 * result = velocity - (velocity · wallNormal) * wallNormal
 * This zeros the component perpendicular to the wall while preserving the parallel component.
 * @param {{ x: number, y: number, z: number }} velocity
 * @param {{ x: number, y: number, z: number }} wallNormal — must be a unit vector
 * @returns {{ x: number, y: number, z: number }}
 */
export function wallSlide(velocity, wallNormal) {
  const d = dot(velocity, wallNormal);
  return {
    x: velocity.x - d * wallNormal.x,
    y: velocity.y - d * wallNormal.y,
    z: velocity.z - d * wallNormal.z,
  };
}
