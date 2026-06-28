# Bugfix Requirements Document

## Introduction

The player's power level is clamped to a minimum of 1, which means power can never reach zero and the game-over condition (Requirement 3.7) can never trigger through normal gameplay. Additionally, player-triggered explosions have no power cost, removing risk from the core mechanic. When game-over does eventually occur (if it were possible), there is no dramatic visual payoff — just a static screen transition. This bugfix addresses three interconnected issues: removing the power floor so game-over is reachable, making explosions cost power to create risk/reward tension, and adding a dramatic death explosion sequence when game-over triggers.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an Enemy_Ship contacts the Player_Ship and Power_Level is at any value, THEN the system clamps power to a minimum of 1 via `Math.max(1, GameState.powerLevel - config.powerDecrement)`, preventing Power_Level from ever reaching zero.

1.2 WHEN the Player clicks to trigger an explosion at any Power_Level, THEN the system fires the explosion at no power cost — Power_Level remains unchanged regardless of the click.

1.3 WHEN Power_Level would logically reach zero (if the floor were removed), THEN the system does not trigger game-over because the floor prevents zero from being reached.

1.4 WHEN game-over triggers, THEN the system immediately displays a static game-over screen with no explosion visual, no chain reaction opportunity, and no dramatic payoff.

### Expected Behavior (Correct)

2.1 WHEN an Enemy_Ship contacts the Player_Ship and Power_Level is at any value, THEN the system SHALL decrement Power_Level by `config.powerDecrement` with a minimum floor of 0 (not 1), allowing Power_Level to reach zero.

2.2 WHEN Power_Level reaches zero due to an enemy collision, THEN the system SHALL immediately trigger the game-over sequence including the death explosion.

2.3 WHEN the Player clicks to trigger an explosion, THEN the system SHALL deduct 1 from Power_Level as the cost of firing the explosion before the explosion is created.

2.4 WHEN the Player clicks to trigger an explosion and Power_Level is 1, THEN the system SHALL deduct 1 (reducing Power_Level to 0), fire the explosion normally, and allow the full chain reaction to resolve before evaluating game-over.

2.5 WHEN a chain reaction resolves after a desperation shot (Power_Level is 0) and the chain depth meets or exceeds `config.chainThreshold`, THEN the system SHALL award the power gain increment, bringing Power_Level back to 1 or higher, and the player SHALL survive.

2.6 WHEN a chain reaction resolves after a desperation shot (Power_Level is 0) and the chain depth does NOT meet `config.chainThreshold`, THEN the system SHALL trigger the game-over sequence including the death explosion.

2.7 WHEN game-over triggers, THEN the system SHALL spawn a death explosion centered on the Player_Ship with maximum radius (calculated as if Power_Level were `config.maxPower`) that expands slowly over 2-3 seconds.

2.8 WHEN the death explosion fires, THEN the system SHALL allow it to trigger chain reactions on any enemies within its radius, and those chain reactions SHALL fully resolve before the game-over screen appears.

2.9 WHEN all death-explosion chain reactions have resolved, THEN the system SHALL display the game-over screen.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN Power_Level is above 1 and an enemy collision occurs, THEN the system SHALL CONTINUE TO decrement Power_Level by `config.powerDecrement` and deflect both ships apart.

3.2 WHEN a normal explosion (non-desperation) fires, THEN the system SHALL CONTINUE TO calculate explosion radius using `base_radius + (Power_Level × radius_multiplier)`.

3.3 WHEN a chain reaction meets or exceeds `config.chainThreshold`, THEN the system SHALL CONTINUE TO award `config.powerGainIncrement` up to `config.maxPower`.

3.4 WHEN an explosion hits an Enemy_Ship, THEN the system SHALL CONTINUE TO destroy it and trigger a chain explosion at its position.

3.5 WHEN an explosion hits a Generator, THEN the system SHALL CONTINUE TO reduce its HP by one.

3.6 WHEN all Generators on the current Level are destroyed, THEN the system SHALL CONTINUE TO display the level-complete screen and advance to the next level.

3.7 WHEN Enemy_Ships collide with walls, THEN the system SHALL CONTINUE TO reflect their velocity off the wall normal.

3.8 WHEN the HUD displays Power_Level, THEN the system SHALL CONTINUE TO update the display within one rendered frame, now showing 0 as a valid value.

---

## Bug Condition

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type GameInput (player action + current state)
  OUTPUT: boolean

  // The bug manifests in three scenarios:
  // 1. Enemy collision when power would reach 0 (floor prevents it)
  // 2. Player explosion costs nothing (no power deduction)
  // 3. Game-over has no dramatic death explosion
  RETURN (X.action = ENEMY_COLLISION AND X.powerLevel - X.powerDecrement <= 0)
      OR (X.action = PLAYER_CLICK_EXPLOSION)
      OR (X.action = GAME_OVER_TRIGGERED)
END FUNCTION
```

### Property Specification — Fix Checking

```pascal
// Property: Fix Checking — Power can reach zero
FOR ALL X WHERE X.action = ENEMY_COLLISION AND X.powerLevel - X.powerDecrement <= 0 DO
  result ← applyCollision'(X)
  ASSERT result.powerLevel = 0
  ASSERT result.gameOverTriggered = true
END FOR

// Property: Fix Checking — Explosion costs 1 power
FOR ALL X WHERE X.action = PLAYER_CLICK_EXPLOSION DO
  result ← onPlayerClick'(X)
  ASSERT result.powerLevel = X.powerLevel - 1
END FOR

// Property: Fix Checking — Desperation shot survival
FOR ALL X WHERE X.action = PLAYER_CLICK_EXPLOSION AND X.powerLevel = 1 DO
  result ← resolveChain'(X)
  IF result.chainDepth >= X.config.chainThreshold THEN
    ASSERT result.powerLevel >= 1
    ASSERT result.gameOverTriggered = false
  ELSE
    ASSERT result.powerLevel = 0
    ASSERT result.gameOverTriggered = true
  END IF
END FOR

// Property: Fix Checking — Death explosion uses max radius
FOR ALL X WHERE X.action = GAME_OVER_TRIGGERED DO
  result ← triggerGameOver'(X)
  ASSERT result.deathExplosionRadius = X.config.baseExplosionRadius + (X.config.maxPower × X.config.radiusMultiplier)
  ASSERT result.deathExplosionDuration >= 2.0
  ASSERT result.gameOverScreenShownAfterChainsResolve = true
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR

// Specifically:
// - Normal collisions at power > 1 still decrement by config.powerDecrement
// - Chain reactions still award power at threshold
// - Explosion radius formula unchanged
// - Enemy AI, wall collisions, level progression all identical
```
