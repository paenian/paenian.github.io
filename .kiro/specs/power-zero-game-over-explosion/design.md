# Power-Zero Game-Over Explosion Bugfix Design

## Overview

The player's power level is artificially floored at 1, explosions cost no power, and game-over triggers with no visual payoff. This fix removes the power floor (allowing power to reach 0), adds a power cost of 1 per explosion click, introduces the "desperation shot" mechanic (fire at power 1, survive only if the chain reaction meets threshold), and implements a dramatic death explosion sequence that fully resolves its chain reactions before showing the game-over screen.

## Glossary

- **Bug_Condition (C)**: The set of game states where power should reach zero (enemy collision reducing power to ≤0, or desperation shot chain failing threshold) but the current code prevents it via `Math.max(1, ...)` or by not deducting explosion cost.
- **Property (P)**: Desired behavior — power can reach 0, explosions cost 1 power, desperation shots resolve before game-over evaluation, and game-over triggers a slow max-radius death explosion with chain resolution before the game-over screen.
- **Preservation**: All existing behaviors unrelated to the power floor, explosion cost, or game-over visuals must remain unchanged — chain threshold rewards, explosion radius formula, enemy AI, wall collisions, level progression, HUD rendering.
- **GameState.powerLevel**: The player's current power, stored in `GameState.js`. Currently clamped to [1, maxPower]; should be [0, maxPower].
- **GameState.phase**: The game phase state machine. Currently: `LOADING | PLAYING | PAUSED | LEVEL_COMPLETE | GAME_OVER`. Will add `DYING` for the death explosion sequence.
- **onPlayerClick(shipPosition)**: Entry point in `ExplosionSystem.js` that enqueues the initial explosion. Currently has no power cost.
- **config.powerDecrement**: The amount of power lost per enemy collision (currently floored to never reach 0).
- **config.chainThreshold**: The chain depth required to earn a power-gain increment.

## Bug Details

### Bug Condition

The bug manifests in three interconnected scenarios:

1. Enemy collision cannot reduce power to 0 because `Math.max(1, ...)` floors the result at 1.
2. Player explosion clicks have no power cost — risk/reward tension is absent.
3. Game-over (if reachable) shows a static screen with no dramatic explosion sequence.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type GameInput (action + current state)
  OUTPUT: boolean

  RETURN (input.action = ENEMY_COLLISION AND input.powerLevel - input.config.powerDecrement <= 0)
      OR (input.action = PLAYER_CLICK_EXPLOSION)
      OR (input.action = GAME_OVER_TRIGGERED)
END FUNCTION
```

### Examples

- **Enemy collision at power 1**: `powerLevel=1, powerDecrement=1` → Currently stays at 1 (should become 0 and trigger game-over).
- **Explosion click at power 5**: `powerLevel=5` → Currently stays at 5 after click (should become 4).
- **Desperation shot succeeds**: `powerLevel=1`, click fires explosion, chain depth ≥ threshold → Power gains increment, player survives. Currently impossible since power never changes on click.
- **Desperation shot fails**: `powerLevel=1`, click fires explosion, chain depth < threshold → Power stays 0, death explosion triggers. Currently impossible.
- **Game-over triggered**: Currently shows static game-over screen immediately. Should spawn a slow max-radius explosion, resolve chains, then show screen.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Normal collisions at power > 1 still decrement by `config.powerDecrement` and deflect both ships apart
- Explosion radius formula remains `baseExplosionRadius + powerLevel × radiusMultiplier` (using power level at time of click, before deduction)
- Chain reactions still award `config.powerGainIncrement` when chain depth ≥ `config.chainThreshold`
- Enemy destruction triggers chain explosion at enemy position
- Generator HP decreases by 1 per explosion hit
- All generators destroyed → level-complete screen and advance
- Enemy AI, wall collisions, spawning logic unchanged
- HUD continues to update within one rendered frame (now showing 0 as valid)

**Scope:**
All inputs where power level is above 1 after an enemy collision, or where no click/game-over is involved, should be completely unaffected by this fix. This includes:
- Normal movement and physics
- Enemy spawning and AI behavior
- Level loading and validation
- Camera rig operation

## Hypothesized Root Cause

Based on code analysis, the confirmed issues are:

1. **Power Floor Too High** (`Game.js` line ~113): `Math.max(1, GameState.powerLevel - config.powerDecrement)` prevents power from reaching 0. Should be `Math.max(0, ...)`.

2. **No Explosion Cost** (`ExplosionSystem.js` `onPlayerClick`): The method immediately enqueues an explosion without deducting power. Should deduct 1 from `GameState.powerLevel` before enqueuing.

3. **No Post-Chain Game-Over Evaluation** (`ExplosionSystem.js` `step()`): When the explosion queue drains, the system only checks for chain threshold reward. It does not check if power is 0 after resolution (desperation shot failure).

4. **No Death Explosion Phase** (`Game.js` `onGameOver()`): The method immediately sets phase to `GAME_OVER` and shows the overlay. There is no intermediate `DYING` phase with a slow max-radius explosion.

5. **No Slow-Expand Explosion Visual** (`Renderer.js` `spawnExplosionEffect()`): The existing method creates a fixed-size sphere for 300ms. A death explosion needs a sphere that expands from 0 to max radius over 2-3 seconds.

## Correctness Properties

Property 1: Bug Condition - Power Can Reach Zero on Enemy Collision

_For any_ game state where `powerLevel - config.powerDecrement <= 0` and an enemy collision occurs, the fixed collision handler SHALL set `powerLevel` to 0 and trigger the game-over/death-explosion sequence.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - Explosion Click Costs 1 Power

_For any_ game state where the player clicks to fire an explosion, the fixed `onPlayerClick` function SHALL deduct 1 from `powerLevel` before enqueuing the explosion, and the explosion radius SHALL be calculated using the power level before deduction.

**Validates: Requirements 2.3**

Property 3: Bug Condition - Desperation Shot Survival

_For any_ game state where `powerLevel` is 1 and the player clicks to fire an explosion (reducing power to 0), IF the resulting chain depth meets or exceeds `config.chainThreshold`, THEN the power gain increment SHALL be applied (bringing power ≥ 1) and the player SHALL survive. IF the chain depth does NOT meet the threshold, THEN the death explosion sequence SHALL trigger.

**Validates: Requirements 2.4, 2.5, 2.6**

Property 4: Bug Condition - Death Explosion Uses Max Radius and Resolves Chains

_For any_ game-over trigger, the fixed system SHALL spawn a death explosion centered on the player with radius equal to `config.baseExplosionRadius + config.maxPower × config.radiusMultiplier`, allow all resulting chain reactions to fully resolve, and only THEN display the game-over screen.

**Validates: Requirements 2.7, 2.8, 2.9**

Property 5: Preservation - Non-Zero Power Collision Behavior

_For any_ enemy collision where `powerLevel - config.powerDecrement > 0`, the fixed collision handler SHALL produce the same result as the original — decrement power by `config.powerDecrement`, deflect both ships — preserving all existing high-power gameplay.

**Validates: Requirements 3.1, 3.7**

Property 6: Preservation - Chain Reaction and Explosion Mechanics

_For any_ explosion where the player's power level is above 0 after chain resolution (non-desperation scenario), the fixed system SHALL produce the same chain reaction behavior, radius calculation, and power gain logic as the original code.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `Game.js`

**Function**: `update(dt)` — Enemy collision section

**Specific Changes**:
1. **Remove power floor of 1**: Change `Math.max(1, GameState.powerLevel - config.powerDecrement)` to `Math.max(0, GameState.powerLevel - config.powerDecrement)`.
2. **Check for game-over after collision**: After updating `powerLevel`, if `GameState.powerLevel === 0`, call `this.onGameOver()` (which will be updated to trigger the death explosion).

---

**File**: `ExplosionSystem.js`

**Function**: `onPlayerClick(shipPosition)`

**Specific Changes**:
3. **Add explosion cost**: Before enqueuing the explosion, deduct 1 from `this.gameState.powerLevel` (clamped to 0). Calculate explosion radius using the power level *before* deduction to avoid a zero-radius explosion.
4. **Guard against firing at power 0**: If `this.gameState.powerLevel` is already 0 (player is in DYING phase or already dead), do not fire.

---

**File**: `ExplosionSystem.js`

**Function**: `step()`

**Specific Changes**:
5. **Post-chain game-over evaluation**: After the queue drains and chain reward is evaluated, if `this.gameState.powerLevel === 0` and `this.gameState.phase === 'PLAYING'`, emit a callback or set a flag indicating desperation-shot failure. The `Game.js` update loop will detect this and trigger the death explosion sequence.

---

**File**: `GameState.js`

**Specific Changes**:
6. **Add DYING phase**: Extend the phase type to include `'DYING'`. This phase is active during the death explosion animation and chain resolution.
7. **Update power level clamp**: In `reset()`, change the power clamp from `clamp(levelData.initialPowerLevel, 1, 100)` to `clamp(levelData.initialPowerLevel, 0, 100)` (though levels will still start at ≥1 per level config).

---

**File**: `Game.js`

**Function**: `onGameOver()` (rewrite)

**Specific Changes**:
8. **Introduce DYING phase**: Instead of immediately showing game-over, set `GameState.phase = 'DYING'`, spawn the death explosion into the explosion queue with max radius (`config.baseExplosionRadius + config.maxPower * config.radiusMultiplier`), and let the update loop continue processing the explosion queue.
9. **Update `update(dt)` to handle DYING phase**: During `DYING`, skip normal input/movement/spawning but continue calling `this.explosionSystem.step()` and `this.renderer.render()`. When the explosion queue is empty during `DYING`, transition to `GAME_OVER` and show the overlay.

---

**File**: `Renderer.js`

**Function**: New `spawnDeathExplosionEffect(pos, maxRadius, durationMs)`

**Specific Changes**:
10. **Slow-expand death explosion visual**: Create a sphere mesh that starts at radius 0 and expands to `maxRadius` over `durationMs` (2000–3000ms) using an animation loop (requestAnimationFrame or a tween approach within the render cycle). Use a distinct color (e.g., white/bright red) and higher opacity to differentiate from normal explosions.

---

**File**: `HUD.js`

**Function**: `updatePowerBar(current, max)`

**Specific Changes**:
11. **Handle power level 0 display**: The existing implementation already handles 0 correctly (width: "0.0%", text: "0"). No code change needed, but add a visual indicator (e.g., CSS class `power-critical`) when power is 0 or 1 to warn the player.

---

**File**: `Game.js`

**Function**: `update(dt)` — Explosion system step section

**Specific Changes**:
12. **Detect desperation-shot failure**: After calling `this.explosionSystem.step()`, check if the explosion queue just emptied AND `GameState.powerLevel === 0` AND `GameState.phase === 'PLAYING'`. If so, call `this.onGameOver()` to trigger the death explosion.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that exercise the collision handler at power level 1, the explosion click with power tracking, and the game-over transition. Run these tests on the UNFIXED code to observe failures and confirm root causes.

**Test Cases**:
1. **Collision at Power 1 Test**: Set `powerLevel=1`, simulate enemy collision → assert power becomes 0 (will fail on unfixed code, power stays 1)
2. **Explosion Cost Test**: Set `powerLevel=5`, call `onPlayerClick()` → assert power becomes 4 (will fail on unfixed code, power stays 5)
3. **Desperation Shot Chain Success Test**: Set `powerLevel=1`, fire explosion, mock chain depth ≥ threshold → assert power ≥ 1 and no game-over (will fail on unfixed code)
4. **Desperation Shot Chain Failure Test**: Set `powerLevel=1`, fire explosion, mock chain depth < threshold → assert game-over triggers (will fail on unfixed code)
5. **Death Explosion Radius Test**: Trigger game-over → assert death explosion uses max radius formula (will fail on unfixed code, no death explosion exists)

**Expected Counterexamples**:
- Power level never reaches 0 due to `Math.max(1, ...)` floor
- `onPlayerClick` does not modify `powerLevel`
- No death explosion is spawned; game-over screen appears immediately

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
// Power reaches zero on collision
FOR ALL input WHERE input.action = ENEMY_COLLISION AND input.powerLevel - input.powerDecrement <= 0 DO
  result := applyCollision_fixed(input)
  ASSERT result.powerLevel = 0
  ASSERT result.phase = 'DYING' OR result.gameOverTriggered = true
END FOR

// Explosion costs 1 power
FOR ALL input WHERE input.action = PLAYER_CLICK AND input.powerLevel >= 1 DO
  result := onPlayerClick_fixed(input)
  ASSERT result.powerLevel = input.powerLevel - 1
  ASSERT result.explosionRadius = baseExplosionRadius + input.powerLevel × radiusMultiplier
END FOR

// Desperation shot evaluation
FOR ALL input WHERE input.powerLevel = 0 AND explosionQueue empties DO
  IF chainDepth >= chainThreshold THEN
    ASSERT powerLevel >= 1
    ASSERT phase = 'PLAYING'
  ELSE
    ASSERT phase = 'DYING'
    ASSERT deathExplosionEnqueued = true
  END IF
END FOR

// Death explosion uses max radius
FOR ALL input WHERE phase transitions to 'DYING' DO
  result := triggerDeathExplosion(input)
  ASSERT result.explosionRadius = config.baseExplosionRadius + config.maxPower × config.radiusMultiplier
  ASSERT gameOverScreenShown = false UNTIL explosionQueue is empty
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT F(input) = F'(input)
END FOR

// Specifically:
FOR ALL collision WHERE powerLevel - powerDecrement > 0 DO
  ASSERT applyCollision_fixed(input).powerLevel = Math.max(0, powerLevel - powerDecrement)
  // This equals the original Math.max(1, ...) when result > 1
  ASSERT applyCollision_fixed(input).powerLevel = applyCollision_original(input).powerLevel
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various power levels, decrement values)
- It catches edge cases at boundaries (power level 2 → 1 behavior must stay unchanged)
- It provides strong guarantees that non-buggy scenarios are unaffected

**Test Plan**: Observe behavior on UNFIXED code first for collisions at power > 1 and normal explosions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **High-Power Collision Preservation**: For all power levels p where p - decrement > 0, verify collision result equals `p - decrement` (same as original for p > 1+decrement).
2. **Explosion Radius Preservation**: For all power levels p ≥ 1, verify explosion radius formula unchanged: `baseExplosionRadius + p × radiusMultiplier`.
3. **Chain Reward Preservation**: For all chain depths d ≥ threshold and power p > 0, verify power gain is `min(p + increment, maxPower)`.
4. **Level Progression Preservation**: Verify all generators destroyed still triggers level-complete, unaffected by power changes.

### Unit Tests

- Test `Math.max(0, ...)` collision behavior at power levels 0, 1, 2, 5, 100
- Test `onPlayerClick` deducts exactly 1 power and uses pre-deduction power for radius
- Test `onPlayerClick` does not fire when power is already 0
- Test DYING phase prevents normal game input but allows explosion steps
- Test death explosion uses `config.baseExplosionRadius + config.maxPower × config.radiusMultiplier`
- Test game-over screen only shown after explosion queue empties during DYING phase
- Test desperation-shot survival (chain threshold met) restores power and stays PLAYING
- Test desperation-shot failure (chain threshold missed) transitions to DYING

### Property-Based Tests

- Generate random power levels [1, 100] and random decrements [1, 10]; verify collision never produces negative power and correctly evaluates game-over condition
- Generate random power levels [1, 100]; verify explosion cost always reduces by exactly 1 and radius uses original level
- Generate random chain depths and thresholds; verify desperation-shot evaluation is correct (survive if depth ≥ threshold, die otherwise)
- Generate random non-bug-condition inputs; verify preservation — output matches original function

### Integration Tests

- Test full desperation shot flow: power=1 → click → chain resolves above threshold → power restored → game continues
- Test full death sequence: power=1 → click → chain fails threshold → DYING phase → death explosion → chains resolve → game-over screen
- Test enemy collision death: power=1 → enemy hits → power=0 → DYING → death explosion → game-over screen
- Test that death explosion can destroy enemies/generators during DYING phase (chain reactions resolve)
- Test HUD displays power=0 correctly during DYING phase
