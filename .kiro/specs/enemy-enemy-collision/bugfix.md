# Bugfix Requirements Document

## Introduction

Enemy ships in the Webtend game have no collision detection with other enemy ships. They pass directly through each other as if the other doesn't exist. The game loop (Game.js) only checks player-enemy and player-wall collisions, EnemyAI only handles wall collisions, and Physics.js has no capsule-capsule collision function. This bug makes enemy movement look unrealistic and removes a layer of emergent gameplay where enemies deflecting off each other would create unpredictable swarm patterns.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN two enemy ships occupy overlapping positions THEN the system performs no collision detection between them and they pass through each other unimpeded

1.2 WHEN multiple enemies converge on the same corridor THEN the system allows all enemies to stack on the same position without any physical interaction

1.3 WHEN an enemy's oriented capsule shape (elongated along its heading) would intersect another enemy's capsule THEN the system ignores the intersection entirely because no capsule geometry or capsule-capsule test exists

### Expected Behavior (Correct)

2.1 WHEN two enemies' bounding spheres overlap (pre-filter pass) AND their oriented capsules intersect THEN the system SHALL detect the collision and deflect both enemies away from each other based on the contact point on their capsule geometry

2.2 WHEN an enemy-enemy capsule collision is detected with contact near the nose (high dot product between heading and contact normal) THEN the system SHALL apply a full heading reflection (aggressive reversal) to both enemies

2.3 WHEN an enemy-enemy capsule collision is detected with contact on the side (low dot product between heading and contact normal) THEN the system SHALL apply a smaller angular deflection to both enemies' headings

2.4 WHEN two enemies collide THEN the system SHALL push both enemies apart by half the penetration depth each, preventing sustained overlap

2.5 WHEN two enemies collide THEN the system SHALL preserve each enemy's speed (enemySpeed constant) while only changing their heading directions

2.6 WHEN two enemies collide THEN the system SHALL NOT trigger explosions, chain reactions, or any damage to either enemy

2.7 WHEN the level contains up to 50 enemies THEN the system SHALL perform enemy-enemy collision detection efficiently using a bounding sphere pre-filter before the more expensive oriented capsule-capsule intersection test (N² pair checks with early-out)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an enemy collides with a maze wall THEN the system SHALL CONTINUE TO reflect the enemy's heading off the wall normal and push the enemy out of the wall

3.2 WHEN an enemy contacts the player ship THEN the system SHALL CONTINUE TO reduce the player's power level and deflect both ships apart without triggering an explosion

3.3 WHEN an enemy moves between collisions THEN the system SHALL CONTINUE TO move it in a straight line along its heading at the constant enemySpeed

3.4 WHEN a generator spawns an enemy THEN the system SHALL CONTINUE TO assign it a heading toward the player's current position at spawn time

3.5 WHEN an explosion radius intersects an enemy THEN the system SHALL CONTINUE TO destroy that enemy and trigger a chain reaction explosion at its position

3.6 WHEN the explosion system checks enemy positions THEN the system SHALL CONTINUE TO use the enemy's bounding sphere radius for hit detection (capsule geometry is for enemy-enemy collision only)

3.7 WHEN the game runs with up to 50 enemies THEN the system SHALL CONTINUE TO maintain at least 30 FPS without frame drops caused by collision detection overhead

---

## Bug Condition

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type EnemyPair (two enemies with positions, headings, and capsule geometries)
  OUTPUT: boolean

  // Returns true when two enemies' oriented capsules overlap
  // First check: bounding spheres overlap (fast pre-filter)
  LET dist = distance(X.enemy1.position, X.enemy2.position)
  LET combinedBoundingRadius = X.enemy1.boundingSphereRadius + X.enemy2.boundingSphereRadius
  IF dist >= combinedBoundingRadius THEN RETURN false

  // Second check: oriented capsule-capsule intersection
  LET capsule1 = orientedCapsule(X.enemy1.position, X.enemy1.heading, halfLength, capsuleRadius)
  LET capsule2 = orientedCapsule(X.enemy2.position, X.enemy2.heading, halfLength, capsuleRadius)
  RETURN capsuleIntersects(capsule1, capsule2)
END FUNCTION
```

### Property Specification — Fix Checking

```pascal
// Property: Fix Checking — Enemy-Enemy Capsule Collision Deflection
FOR ALL X WHERE isBugCondition(X) DO
  result ← resolveEnemyEnemyCollision(X.enemy1, X.enemy2)

  // Both enemies are deflected (headings changed)
  ASSERT result.enemy1.heading ≠ X.enemy1.heading OR result.enemy2.heading ≠ X.enemy2.heading

  // Speed is preserved for both
  ASSERT magnitude(result.enemy1.velocity) = enemySpeed
  ASSERT magnitude(result.enemy2.velocity) = enemySpeed

  // Enemies are pushed apart (no longer overlapping after resolution)
  ASSERT NOT capsuleIntersects(
    orientedCapsule(result.enemy1.position, result.enemy1.heading, halfLength, capsuleRadius),
    orientedCapsule(result.enemy2.position, result.enemy2.heading, halfLength, capsuleRadius)
  )

  // No explosions or damage triggered
  ASSERT result.explosionsTriggered = 0
  ASSERT result.enemy1.destroyed = false
  ASSERT result.enemy2.destroyed = false
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking — Non-colliding enemy pairs behave identically
FOR ALL X WHERE NOT isBugCondition(X) DO
  // Enemies that don't collide with each other continue unchanged
  ASSERT F(X) = F'(X)
  // Wall collisions, player collisions, movement, spawning all unchanged
END FOR
```
