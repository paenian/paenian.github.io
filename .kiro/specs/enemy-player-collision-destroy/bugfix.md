# Bugfix Requirements Document

## Introduction

When an enemy ship contacts the player's ship during gameplay, the enemy should be destroyed (removed from the scene) and the player should lose exactly 1 power level. Currently, the enemy survives the collision — both ships are deflected away from each other and the enemy continues moving. The power decrement also uses `config.powerDecrement` instead of a fixed value of 1. This bug contradicts the intended game design where enemy-player contact is a destructive event for the enemy, not a physics bounce.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an enemy ship contacts the player ship THEN the system deflects both ships away from each other and the enemy continues moving (survives the collision)

1.2 WHEN an enemy ship contacts the player ship THEN the system decrements power by `config.powerDecrement` instead of exactly 1 unit

1.3 WHEN an enemy ship contacts the player ship THEN the system does NOT flag the enemy with `pendingRemoval = true`, so the enemy is never removed from the scene

### Expected Behavior (Correct)

2.1 WHEN an enemy ship contacts the player ship THEN the system SHALL flag the enemy with `pendingRemoval = true` so it is destroyed (removed from the scene at end of frame)

2.2 WHEN an enemy ship contacts the player ship THEN the system SHALL decrement the player's power level by exactly 1 unit (not `config.powerDecrement`)

2.3 WHEN an enemy ship contacts the player ship THEN the system SHALL NOT trigger any chain explosion

2.4 WHEN an enemy ship contacts the player ship THEN the system SHALL deflect the player ship away from the collision point

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the player ship collides with a wall THEN the system SHALL CONTINUE TO reflect the player's velocity off the wall normal and push the player out of the wall

3.2 WHEN the player ship does NOT contact any enemy THEN the system SHALL CONTINUE TO update player position, enemy AI, and HUD normally

3.3 WHEN an explosion destroys an enemy (not player contact) THEN the system SHALL CONTINUE TO use the existing explosion system to flag enemies with `pendingRemoval = true`

3.4 WHEN power level would be reduced below 1 THEN the system SHALL CONTINUE TO clamp power level to a minimum of 1
