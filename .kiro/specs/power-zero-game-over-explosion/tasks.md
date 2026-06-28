# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Power Floor Prevents Zero and Explosions Have No Cost
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: power=1 with enemy collision (power should reach 0), and explosion click at any power level (power should decrement by 1)
  - Test file: `tests/powerZeroBugCondition.test.js`
  - Test 1: Set `GameState.powerLevel = 1`, simulate enemy collision via `Game.update()` collision logic → assert `GameState.powerLevel === 0` (will FAIL on unfixed code because `Math.max(1, ...)` floors at 1)
  - Test 2: Set `GameState.powerLevel = 5`, call `explosionSystem.onPlayerClick(shipPosition)` → assert `GameState.powerLevel === 4` (will FAIL on unfixed code because no deduction occurs)
  - Test 3: Set `GameState.powerLevel = 1`, call `explosionSystem.onPlayerClick(shipPosition)`, mock chain depth < threshold, drain queue → assert game-over is triggered (will FAIL on unfixed code)
  - Test 4: Trigger game-over → assert a death explosion is enqueued with radius = `config.baseExplosionRadius + config.maxPower * config.radiusMultiplier` (will FAIL on unfixed code, no death explosion exists)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bug exists)
  - Document counterexamples found: power stays at 1 after collision, power unchanged after click, no death explosion spawned
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Bug-Condition Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `tests/powerZeroPreservation.test.js`
  - Observe on UNFIXED code: collision at power=5 with decrement=1 → power becomes 4
  - Observe on UNFIXED code: collision at power=10 with decrement=3 → power becomes 7
  - Observe on UNFIXED code: explosion radius at power=5 with baseRadius=3, multiplier=0.5 → radius = 5.5
  - Observe on UNFIXED code: chain depth ≥ threshold awards powerGainIncrement
  - Write property-based test: for all power levels p where `p - decrement > 1`, collision result equals `p - decrement` (same behavior pre/post fix)
  - Write property-based test: for all power levels p ≥ 1, explosion radius equals `baseExplosionRadius + p × radiusMultiplier`
  - Write property-based test: for all chain depths d ≥ threshold with power > 0, power gain = `min(power + increment, maxPower)`
  - Write property-based test: enemy AI update, wall collisions, and level-complete logic are unaffected by power changes
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 3. Fix for power-zero game-over explosion

  - [ ] 3.1 Update GameState.js — Add DYING phase and update power clamp
    - Add `'DYING'` to the phase type documentation: `'LOADING'|'PLAYING'|'PAUSED'|'LEVEL_COMPLETE'|'GAME_OVER'|'DYING'`
    - In `reset()`, change `clamp(levelData.initialPowerLevel, 1, 100)` to `clamp(levelData.initialPowerLevel, 0, 100)` (levels still start ≥ 1 per config)
    - _Bug_Condition: isBugCondition(input) where power clamp prevents reaching 0_
    - _Expected_Behavior: Power level can represent 0; DYING phase exists in state machine_
    - _Preservation: All other GameState reset behavior unchanged_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.2 Update ExplosionSystem.js — Add explosion cost in onPlayerClick
    - In `onPlayerClick(shipPosition)`: guard against firing when `powerLevel === 0` (return early)
    - Store `preCostPower = this.gameState.powerLevel` before deducting
    - Deduct 1 from `this.gameState.powerLevel` (clamped to 0)
    - Calculate explosion radius using `preCostPower` (pre-deduction value) to avoid zero-radius explosion
    - _Bug_Condition: isBugCondition(input) where action = PLAYER_CLICK_EXPLOSION — no cost applied_
    - _Expected_Behavior: onPlayerClick deducts 1 power, uses pre-deduction power for radius_
    - _Preservation: Explosion radius formula unchanged, chain reactions unaffected_
    - _Requirements: 2.3, 2.4_

  - [ ] 3.3 Update ExplosionSystem.js — Add post-chain game-over evaluation in step()
    - After the queue drains and chain reward is evaluated in `step()`, check: if `this.gameState.powerLevel === 0` and `this.gameState.phase === 'PLAYING'`, set a flag `this.gameState.desperationFailed = true`
    - This flag is read by `Game.js` to trigger the death explosion sequence
    - _Bug_Condition: isBugCondition(input) where desperation shot fails but no game-over triggers_
    - _Expected_Behavior: Post-chain evaluation detects power=0 and signals game-over_
    - _Preservation: Chain reward logic unchanged for power > 0 scenarios_
    - _Requirements: 2.5, 2.6_

  - [ ] 3.4 Update Game.js — Change power floor from 1 to 0 and check for game-over after collision
    - In `update(dt)` enemy collision section: change `Math.max(1, GameState.powerLevel - config.powerDecrement)` to `Math.max(0, GameState.powerLevel - config.powerDecrement)`
    - After updating powerLevel, add check: if `GameState.powerLevel === 0`, call `this.onGameOver()`
    - _Bug_Condition: isBugCondition(input) where power floor of 1 prevents reaching 0_
    - _Expected_Behavior: Power reaches 0 on collision and triggers game-over sequence_
    - _Preservation: Collisions at power > 1 produce same result as before_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.5 Update Game.js — Rewrite onGameOver() to use DYING phase with death explosion
    - Set `GameState.phase = 'DYING'` instead of `'GAME_OVER'`
    - Enqueue death explosion into `GameState.explosionQueue` with center at `playerShip.position` and radius = `GameState.config.baseExplosionRadius + GameState.config.maxPower * GameState.config.radiusMultiplier`
    - Call `this.renderer.spawnDeathExplosionEffect(playerShip.position, maxRadius, 2500)` for the slow-expanding visual
    - Do NOT show game-over screen yet (that happens when DYING resolves)
    - _Bug_Condition: isBugCondition(input) where game-over shows static screen immediately_
    - _Expected_Behavior: DYING phase spawns max-radius death explosion, chains resolve before screen_
    - _Preservation: Game-over screen still shown eventually via HUD_
    - _Requirements: 2.7, 2.8, 2.9_

  - [ ] 3.6 Update Game.js — Handle DYING phase in update() and detect desperation-shot failure
    - Add handling at top of `update(dt)`: if `GameState.phase === 'DYING'`, skip normal input/movement/spawning but continue calling `this.explosionSystem.step()` and `this.renderer.render()`
    - During DYING: when `GameState.explosionQueue.length === 0`, transition to `GameState.phase = 'GAME_OVER'` and call `this.hud.showGameOver()`
    - After the existing `this.explosionSystem.step()` call in PLAYING phase: check if `GameState.desperationFailed === true`, and if so, reset the flag and call `this.onGameOver()`
    - _Bug_Condition: isBugCondition(input) where desperation shot failure not detected_
    - _Expected_Behavior: DYING phase processes explosions, then transitions to GAME_OVER; desperation failure triggers death sequence_
    - _Preservation: PLAYING phase logic unchanged for power > 0_
    - _Requirements: 2.6, 2.8, 2.9_

  - [ ] 3.7 Update Renderer.js — Add spawnDeathExplosionEffect method
    - Add new method `spawnDeathExplosionEffect(pos, maxRadius, durationMs)`
    - Create a sphere mesh starting at radius 0 that expands to `maxRadius` over `durationMs` (2500ms)
    - Use distinct color (white/bright red, e.g., 0xff2200) with higher opacity (0.7)
    - Animate expansion using a stored start time and updating geometry scale each render frame
    - Store reference to death effect mesh for cleanup; remove after duration completes
    - _Bug_Condition: isBugCondition(input) where no death explosion visual exists_
    - _Expected_Behavior: Slow-expanding dramatic sphere visual during DYING phase_
    - _Preservation: Existing spawnExplosionEffect unchanged_
    - _Requirements: 2.7_

  - [ ] 3.8 Update HUD.js — Add power-critical CSS class when power ≤ 1
    - In `updatePowerBar(current, max)`: add/remove CSS class `power-critical` on the power bar fill element when `current <= 1`
    - This provides a visual warning to the player that they are one hit or one shot away from game-over
    - _Bug_Condition: N/A (enhancement supporting the fix UX)_
    - _Expected_Behavior: Power bar visually indicates critical state_
    - _Preservation: Power bar display unchanged for power > 1_
    - _Requirements: 3.8_

  - [ ] 3.9 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Power Floor Prevents Zero and Explosions Have No Cost
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1: `cd /Users/paulchase/github/paenian.github.io/webtend && npx vitest --run tests/powerZeroBugCondition.test.js`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7_

  - [ ] 3.10 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Bug-Condition Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2: `cd /Users/paulchase/github/paenian.github.io/webtend && npx vitest --run tests/powerZeroPreservation.test.js`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `cd /Users/paulchase/github/paenian.github.io/webtend && npx vitest --run`
  - Ensure all tests pass including existing tests (enemyAI, explosion, generator, hud, inputHandler, levelLoader, physics)
  - Ensure new bug condition tests pass (power reaches 0, explosion costs 1, death explosion fires)
  - Ensure preservation tests pass (high-power collisions, radius formula, chain rewards unchanged)
  - Ask the user if questions arise

---

## Task Dependency Graph

```
Task 1 (Bug Condition Exploration Test)
  ↓
Task 2 (Preservation Property Tests)
  ↓
Task 3.1 (GameState.js — DYING phase + power clamp)
  ↓
Task 3.2 (ExplosionSystem.js — explosion cost) ←── depends on 3.1 (power can reach 0)
  ↓
Task 3.3 (ExplosionSystem.js — post-chain evaluation) ←── depends on 3.2 (cost creates power=0 scenario)
  ↓
Task 3.4 (Game.js — power floor 1→0 + game-over check) ←── depends on 3.1 (DYING phase exists)
  ↓
Task 3.5 (Game.js — rewrite onGameOver with DYING) ←── depends on 3.1, 3.7
  ↓
Task 3.6 (Game.js — DYING phase handler + desperation detection) ←── depends on 3.3, 3.5
  ↓
Task 3.7 (Renderer.js — spawnDeathExplosionEffect) ←── independent, but needed by 3.5
  ↓
Task 3.8 (HUD.js — power-critical class) ←── independent
  ↓
Task 3.9 (Verify bug condition test passes) ←── depends on 3.1–3.6
  ↓
Task 3.10 (Verify preservation tests pass) ←── depends on 3.1–3.8
  ↓
Task 4 (Checkpoint — full test suite)
```

**Parallel tracks:**
- Task 3.7 (Renderer) and Task 3.8 (HUD) can be implemented in parallel with each other
- Task 3.7 must complete before Task 3.5 (onGameOver uses spawnDeathExplosionEffect)
- Tasks 3.1–3.4 form a sequential dependency chain (each builds on the previous)
