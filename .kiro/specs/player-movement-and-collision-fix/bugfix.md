# Bugfix Requirements Document

## Introduction

The Webtend game has two related bugs that undermine the intended bullet-hell gameplay experience. First, enemy ships survive contact with the player — they bounce off instead of being destroyed. Second, player movement uses a slow acceleration model with bouncy wall collisions and enemy knockback, making the ship feel sluggish and unpredictable instead of the tight, responsive control needed to dodge streams of enemy ships.

Together these bugs make the game feel like a pinball simulation rather than a bullet-hell dodger. The fix must deliver crisp, fast movement with slide-based wall handling, instant enemy destruction on contact, and no knockback — while preserving existing explosion mechanics, enemy AI wall-bounce behavior, and generator spawning.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an enemy ship contacts the player ship THEN the system deflects both ships away from each other and the enemy survives the collision

1.2 WHEN an enemy ship contacts the player ship THEN the system applies a velocity reflection (knockback) to the player ship, causing loss of control

1.3 WHEN the player presses a movement key THEN the system accelerates the ship at 20 units/s² up to a maximum of 50 units/s, which is too slow for bullet-hell gameplay

1.4 WHEN no movement keys are pressed THEN the system decelerates the ship over 0.5 seconds, causing a long uncontrolled slide

1.5 WHEN the player ship collides with a maze wall THEN the system reflects (bounces) the player's velocity off the wall normal, sending the ship in an unpredictable direction

1.6 WHEN the player ship collides with a wall at a shallow angle THEN the reflect behavior causes the ship to ricochet away from the wall instead of sliding along it

### Expected Behavior (Correct)

2.1 WHEN an enemy ship contacts the player ship THEN the system SHALL destroy the enemy (remove it from the scene) with NO chain explosion triggered, and reduce the player's power level by the configured decrement

2.2 WHEN an enemy ship contacts the player ship THEN the system SHALL NOT apply any knockback or velocity change to the player ship — the player retains full movement control

2.3 WHEN the player presses a movement key THEN the system SHALL accelerate the ship at 200 units/s² up to a maximum speed of 100 units/s, providing fast responsive movement

2.4 WHEN no movement keys are pressed THEN the system SHALL decelerate the ship to a full stop within 0.05 seconds (near-instant stop)

2.5 WHEN the player ship collides with a maze wall THEN the system SHALL zero out the velocity component perpendicular to the wall surface and preserve the velocity component parallel to the wall surface (slide behavior)

2.6 WHEN the player ship collides with a wall at any angle THEN the system SHALL push the ship out of the wall by the penetration depth and allow continued movement along the wall surface without bouncing

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an explosion radius intersects an enemy ship THEN the system SHALL CONTINUE TO destroy that enemy and trigger a chain explosion at its position

3.2 WHEN an enemy ship collides with a maze wall THEN the system SHALL CONTINUE TO reflect the enemy's heading off the wall normal (enemies still bounce off walls)

3.3 WHEN a chain reaction produces the qualifying number of sequential explosions THEN the system SHALL CONTINUE TO increase the player's power level by the configured increment

3.4 WHEN the player clicks the primary mouse button THEN the system SHALL CONTINUE TO trigger an explosion centered on the player ship with radius based on power level

3.5 WHEN a generator's hit points reach zero THEN the system SHALL CONTINUE TO cease spawning enemies and be removed from the scene

3.6 WHEN all generators on the current level are destroyed THEN the system SHALL CONTINUE TO display the level-complete screen and advance to the next level

3.7 WHEN the player's power level reaches zero THEN the system SHALL CONTINUE TO trigger game over (power level clamped to minimum of 1 per existing logic)

---

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition_EnemyContact(X)
  INPUT: X of type CollisionEvent (player-enemy sphere-sphere collision)
  OUTPUT: boolean

  // The bug triggers whenever an enemy ship overlaps the player ship
  RETURN checkSphereSphere(X.playerPos, X.playerRadius, X.enemyPos, X.enemyRadius).hit = true
END FUNCTION

FUNCTION isBugCondition_SlowMovement(X)
  INPUT: X of type MovementInput (key press + dt)
  OUTPUT: boolean

  // The bug condition is present for all player movement — the physics model is globally too slow
  RETURN X.playerAcceleration <= 20 OR X.playerMaxSpeed <= 50 OR X.decelerationTime >= 0.5
END FUNCTION

FUNCTION isBugCondition_WallBounce(X)
  INPUT: X of type WallCollisionEvent (player-wall AABB collision)
  OUTPUT: boolean

  // The bug triggers whenever the player ship collides with a wall
  RETURN checkSphereAABB(X.playerPos, X.playerRadius, X.wall).hit = true
END FUNCTION
```

### Property Specification — Fix Checking

```pascal
// Property: Fix Checking — Enemy Destruction on Contact
FOR ALL X WHERE isBugCondition_EnemyContact(X) DO
  result ← handleEnemyCollision'(X)
  ASSERT result.enemyDestroyed = true
    AND result.chainExplosionTriggered = false
    AND result.playerVelocityChanged = false
    AND result.powerLevel = max(1, previousPowerLevel - powerDecrement)
END FOR

// Property: Fix Checking — Fast Responsive Movement
FOR ALL X WHERE isBugCondition_SlowMovement(X) DO
  result ← applyAcceleration'(X.velocity, X.direction, 200, 100, X.dt)
  ASSERT magnitude(result) <= 100
    AND (X.dt >= 0.5 IMPLIES magnitude(result) >= 0.95 * 100)  // reaches near-max quickly
END FOR

// Property: Fix Checking — Wall Slide Instead of Bounce
FOR ALL X WHERE isBugCondition_WallBounce(X) DO
  result ← handleWallCollision'(X)
  ASSERT dotProduct(result.velocity, X.wallNormal) = 0  // no perpendicular component
    AND parallelComponent(result.velocity, X.wallNormal) = parallelComponent(X.velocity, X.wallNormal)
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking — Enemy wall bounce unchanged
FOR ALL X WHERE NOT isBugCondition_EnemyContact(X) AND isEnemyWallCollision(X) DO
  ASSERT EnemyAI.reflect(X) = EnemyAI.reflect'(X)
END FOR

// Property: Preservation Checking — Explosion mechanics unchanged
FOR ALL X WHERE isExplosionEvent(X) DO
  ASSERT ExplosionSystem.processExplosion(X) = ExplosionSystem.processExplosion'(X)
END FOR
```
