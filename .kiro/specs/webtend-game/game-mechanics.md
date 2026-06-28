# Webtend — Game Mechanics Reference

## Overview

Webtend is a bullet-hell maze shooter with chain explosion mechanics. The player pilots a spaceship through a 3D maze, dodging streams of enemy ships while triggering chain-reaction explosions to destroy enemy generators. Power management creates risk/reward tension: every explosion costs power, every enemy hit drains power, and reaching zero triggers a dramatic death sequence.

The game is designed for fast, responsive movement with near-instant acceleration/deceleration, wall sliding (not bouncing), and no knockback from enemy contact. Enemies are destroyed on touching the player — they are projectiles to be dodged, not obstacles to be deflected.

## Core Loop

1. **Navigate** the maze using responsive directional movement
2. **Dodge** enemy ships streaming toward you from generators
3. **Fire** explosions to destroy nearby enemies (costs 1 power per shot)
4. **Build chains** — each destroyed enemy triggers a secondary explosion at its position
5. **Earn power** when a chain reaches the threshold length
6. **Destroy generators** by hitting them with explosions (reduce HP to 0)
7. **Complete the level** when all generators are destroyed
8. **Progress** to harder levels with more generators and faster spawn rates

## Player Ship

### Movement Model

The player ship uses a high-acceleration, near-instant-stop movement model designed for bullet-hell precision:

| Parameter | Value | Description |
|-----------|-------|-------------|
| Acceleration | 200 units/s² | Rate of speed increase when a direction key is held |
| Max Speed | 100 units/s | Absolute velocity cap in any direction |
| Deceleration Time | 0.05 s | Time from max speed to full stop when no input |

**Movement rules:**
- Input direction is derived from camera-relative WASD keys
- When multiple keys are held, the input direction is normalized before applying acceleration (diagonal speed = straight speed)
- Deceleration is uniform across all velocity components
- Velocity is clamped to max speed after acceleration is applied

### Wall Collision (Slide)

When the player ship contacts a maze wall:
1. Detect collision (sphere vs AABB)
2. Zero out the velocity component perpendicular to the wall surface
3. Preserve the velocity component parallel to the wall surface
4. Push the ship out of the wall by the penetration depth

The player never bounces off walls — they slide along them. This gives predictable movement near walls.

### Camera

Third-person camera with fixed offset:
- Position: 10 units behind, 3 units above the player ship (in local space)
- Horizontal rotation: unlimited, driven by mouse X delta
- Vertical rotation: clamped to [-80°, +80°] from horizontal, driven by mouse Y delta
- Wall clipping: if the camera's default position is inside a wall, reposition to the nearest unobstructed point along the line from ship to default offset (minimum 1 unit from ship)

## Power System

Power Level governs the player's offensive capability and survival:

| Parameter | Range | Description |
|-----------|-------|-------------|
| Power Level | [0, maxPower] | Current power; 0 = game-over |
| maxPower | 100 | Upper cap |
| Initial Power | [1, 100] | Per-level starting value (configurable) |
| Explosion Cost | 1 | Deducted per click |
| Enemy Contact Cost | [1, 10] | Configurable per level (powerDecrement) |
| Chain Reward | [1, 10] | Power gained when chain meets threshold |
| Chain Threshold | [3, 10] | Minimum chain length to earn reward |

### Explosion Cost

Each explosion click deducts 1 from Power_Level before the explosion is created. The explosion radius is calculated using the **pre-deduction** power level, so the player always gets the radius they see on the HUD.

If Power_Level is already 0, the player cannot fire.

### Desperation Shot

When Power_Level is exactly 1 and the player fires:
1. Power drops to 0 (explosion cost)
2. The explosion fires with radius based on power=1
3. The full chain reaction resolves
4. **IF** chain depth ≥ chainThreshold: power gain is awarded (bringing power ≥ 1), player survives
5. **IF** chain depth < chainThreshold: power remains 0, death explosion sequence triggers

### Death at Power 0

Power reaching 0 triggers game-over via the Death Explosion Sequence (see below). This can happen from:
- Enemy contact reducing power to 0
- Desperation shot where the chain fails to meet threshold

## Explosions & Chain Reactions

### Triggering an Explosion

- Player clicks → explosion at player ship position
- Radius = `baseExplosionRadius + powerLevel × radiusMultiplier`
- The explosion is a sphere centered on the ship's position at the moment of click

### Hit Detection

All entities (enemies, generators) within the explosion sphere are collected in a single pass:
- Enemy hit test: distance(explosionCenter, enemy.position) < explosionRadius + enemy.boundingSphereRadius
- Generator hit test: distance(explosionCenter, generator.position) < explosionRadius + generator.radius

All hits are collected before any chain reactions are processed (batch evaluation).

### Chain Propagation

When an enemy is destroyed by an explosion:
1. A new explosion is enqueued at the destroyed enemy's last position (same radius)
2. The chain depth counter increments
3. One chain explosion is processed per frame (BFS/FIFO queue)
4. Each chain explosion repeats the hit detection and can destroy additional enemies/generators

### Chain Reward

When the explosion queue drains (chain ends):
- If chainDepth ≥ chainThreshold: `powerLevel = min(powerLevel + powerGainIncrement, maxPower)`
- Otherwise: no power change

### Death Explosion

When game-over triggers:
1. Game enters DYING phase (input/spawning disabled, explosions continue processing)
2. A death explosion spawns centered on the player ship
3. Radius = `baseExplosionRadius + maxPower × radiusMultiplier` (maximum possible)
4. The death explosion expands slowly over 2-3 seconds (visual only — hit detection uses full radius immediately)
5. Chain reactions from the death explosion resolve normally (enemies can be destroyed, further chains can trigger)
6. Only after all chains fully resolve does the game-over screen appear
7. Visual: distinct color (e.g., bright red/white), higher opacity, slower expansion than normal explosions

## Enemy Ships

### Spawning

- Each generator with HP > 0 spawns an enemy at its configured interval
- At spawn, the enemy receives a heading = normalize(playerPosition - generatorPosition)
- The enemy then moves in a straight line along that heading at constant `enemySpeed`
- Heading never changes except via wall reflection or enemy-enemy collision

### Movement

- Velocity = heading × enemySpeed (constant magnitude)
- No homing, no pathfinding — straight-line travel only

### Wall Collision (Bounce)

When an enemy contacts a maze wall:
1. Reflect the heading off the wall normal: `heading' = heading - 2(heading · normal) × normal`
2. Push the enemy out of the wall by the penetration depth
3. Speed magnitude is preserved

### Enemy-Enemy Collision

Enemies collide with each other using oriented capsule geometry:

**Collision Shape:**
Each enemy has an oriented capsule aligned along its heading:
- Center: enemy position
- Axis: heading direction
- Half-length: configurable (e.g., 1.5 units)
- Capsule radius: configurable (e.g., 0.8 units)
- Bounding sphere radius: must fully enclose the capsule (used as pre-filter)

**Detection (two-phase):**
1. **Bounding sphere pre-filter**: if distance(enemy1.pos, enemy2.pos) ≥ enemy1.boundingRadius + enemy2.boundingRadius → skip (no collision possible)
2. **Capsule-capsule test**: compute minimum distance between the two capsule axis segments. If distance < capsuleRadius1 + capsuleRadius2 → collision detected

**Resolution:**
- Compute contact normal (direction from closest point on seg1 to closest point on seg2)
- Compute noseFactor = |dot(heading, contactNormal)| for each enemy
- High noseFactor (nose hit): full heading reflection off contact normal
- Low noseFactor (side hit): small angular deflection
- Blend between full reflection and partial deflection based on noseFactor
- Push both enemies apart by half the penetration depth each
- Resulting heading is normalized; velocity = newHeading × enemySpeed (speed preserved exactly)

**No damage or explosions are triggered by enemy-enemy collisions.**

### Player Contact

When an enemy touches the player ship:
- The enemy is **destroyed** (removed from scene immediately)
- No chain explosion is triggered
- No knockback or velocity change is applied to the player
- Player's Power_Level decreases by `config.powerDecrement`
- If Power_Level reaches 0: death explosion sequence triggers

## Generators

### HP System

- Each generator has configurable maxHp in [1, 1000]
- Each explosion hit reduces HP by exactly 1
- HP is displayed as a bar above the generator (fill ratio = currentHp / maxHp)
- When HP reaches 0: generator is removed from scene, spawning stops

### Spawn Behavior

- Spawns one enemy at a fixed interval (configurable per level)
- Interval is measured from the last spawn time
- Only spawns while HP > 0

### Win Condition

When all generators on the current level reach HP = 0:
- Level-complete screen displays
- After 2 seconds, advance to next level

## Maze

### Structure

- Composed of axis-aligned bounding box (AABB) walls
- Walls are static — never move or change during gameplay
- 3D structure with corridors and open areas

### Collision Rules

| Entity | Wall Behavior |
|--------|---------------|
| Player Ship | Slide (zero perpendicular velocity, preserve parallel, push out) |
| Enemy Ship | Bounce (reflect heading off wall normal, preserve speed, push out) |

### Post-Collision Cleanup

If any velocity component is less than 1% of the pre-collision speed magnitude, set it to exactly 0 (prevents floating-point micro-drift).

### Level Validation

- No generator position may be inside a wall AABB
- Player start position must not be inside a wall AABB
- At least one open area must be large enough for 5+ chained explosions at initial power

## Level Progression

### Difficulty Scaling

| Parameter | Scaling Rule | Bounds |
|-----------|-------------|--------|
| Spawn Interval | Decreases by [1%, 50%] per level | Floor: 0.5 seconds |
| Generator Count | Increases by [1, 5] per level | Ceiling: 20 generators |

### On Level Advance

- Load new maze configuration
- Reset Power_Level to the level's configured initial value
- If the next level config is missing or invalid: show error, remain on current level

### Level Count

Minimum 5 distinct level configurations, each differing in at least one of: maze layout, generator count, generator placement, or spawn interval.

## Game State Machine

```
LOADING → PLAYING → LEVEL_COMPLETE → (next level) → PLAYING
                  → DYING → GAME_OVER
                  → PAUSED → PLAYING
```

**States:**
- **LOADING**: Fetching level data, building scene. No input accepted.
- **PLAYING**: Normal gameplay. All systems active.
- **PAUSED**: Input and physics frozen. Display paused overlay.
- **LEVEL_COMPLETE**: All generators destroyed. Show level-complete screen for 2s, then advance.
- **DYING**: Game-over triggered. Input/spawning disabled. Death explosion and chain reactions resolve. Transition to GAME_OVER when explosion queue empties.
- **GAME_OVER**: Final state. Display game-over screen.

## Configuration Parameters

| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| baseExplosionRadius | float | > 0 | 5 | Base explosion sphere radius |
| radiusMultiplier | float | ≥ 0 | 0.5 | Power-level contribution to radius |
| chainThreshold | int | [3, 10] | 3 | Min chain length for power reward |
| powerGainIncrement | int | [1, 10] | 1 | Power gained on successful chain |
| powerDecrement | int | [1, 10] | 1 | Power lost per enemy contact |
| maxPower | int | 100 | 100 | Upper bound on Power_Level |
| initialPowerLevel | int | [1, 100] | 5 | Starting power per level |
| enemySpeed | float | > 0 | 8 | Constant enemy movement speed |
| playerMaxSpeed | float | > 0 | 100 | Player velocity cap |
| playerAcceleration | float | > 0 | 200 | Player acceleration rate |
| decelerationTime | float | > 0 | 0.05 | Time from max speed to stop |
| capsuleHalfLength | float | > 0 | 1.5 | Enemy capsule axis half-length |
| capsuleRadius | float | > 0 | 0.8 | Enemy capsule swept-sphere radius |
| enemyBoundingSphereRadius | float | > 0 | 2.3 | Must fully enclose capsule |
| generatorMaxHp | int | [1, 1000] | 5 | Per-generator max hit points |
| spawnIntervalSeconds | float | [0.5, 300] | 10 | Time between enemy spawns |
| deathExplosionDurationMs | int | [2000, 3000] | 2500 | Death explosion expand time |

## Correctness Properties

The following invariants must hold in any correct implementation:

1. **Speed Cap**: For any input and delta time, the player ship's velocity magnitude never exceeds playerMaxSpeed.
2. **Deceleration Guarantee**: From any speed ≤ playerMaxSpeed with no input, the ship reaches full stop within decelerationTime.
3. **Camera Pitch Clamp**: The camera's vertical angle always remains in [-80°, +80°] regardless of accumulated mouse input.
4. **Explosion Radius Monotonicity**: For power levels p1 < p2, the explosion radius at p1 is ≤ the radius at p2.
5. **Blast Collection Completeness**: Every entity within explosion range is included in the hit set; no entity outside range is included.
6. **Chain Reward Correctness**: Power gain occurs if and only if chainDepth ≥ chainThreshold, and the result never exceeds maxPower.
7. **Wall Reflection Preserves Speed**: For enemy wall bounces, the reflected velocity magnitude equals the incoming velocity magnitude.
8. **Power Floor at Zero**: Power_Level is never negative. Enemy contact floors at 0, not below.
9. **Generator HP Bar Ratio**: The displayed fill ratio is always in [0.0, 1.0].
10. **Generator HP Decrement**: Each explosion hit reduces HP by exactly 1.
11. **Spawn Interval Non-Increasing**: Across levels, spawn intervals form a non-increasing sequence with floor 0.5s.
12. **Generator Count Non-Decreasing**: Across levels, generator counts form a non-decreasing sequence with ceiling 20.
13. **Enemy-Enemy Speed Preservation**: After enemy-enemy collision deflection, both enemies maintain exactly enemySpeed.
14. **Capsule Separation**: After enemy-enemy collision resolution, the two capsules no longer overlap.
15. **Wall Slide Zero-Perpendicular**: After player-wall collision, the player's velocity component perpendicular to the wall is exactly 0.
16. **Desperation Shot Evaluation**: If power is 0 after a chain resolves and chain depth < threshold, death explosion triggers. If chain depth ≥ threshold, power is restored.
17. **Death Explosion Max Radius**: The death explosion radius equals baseExplosionRadius + maxPower × radiusMultiplier.
18. **Death Chains Resolve Before Screen**: The game-over screen only appears after all death-explosion chains fully drain.
