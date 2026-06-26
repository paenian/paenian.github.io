# Bug Log — Webtend Game

## BUG-1: Enemies follow the player instead of moving in a straight line

**Status:** Fixed  
**Reported:** 2025-06-23  
**User Story:** US-3 (Enemy Ships)  
**Severity:** Gameplay  

**Description:**  
Enemies use seek-steering toward the player's current position, causing them to constantly change direction and home in on the player. The intended behavior is that enemies move in a straight line from their spawn point (at a generator) outward.

**Root Cause:**  
`EnemyAI.update()` calls `this.seek(enemy, playerPos)` every frame, which computes a new velocity vector toward the player's current position. This creates homing behavior.

**Fix:**  
Changed enemy movement to use a fixed heading direction set at spawn time. When an enemy is spawned, it gets a `heading` property pointing from the generator toward the player's position at that moment. The `EnemyAI.update()` method now moves the enemy along this fixed heading at `enemySpeed`, only applying wall-avoidance (bounce/reflect) when hitting walls.

**Files Changed:**
- `EnemyAI.js` — Removed player-seeking, added straight-line movement with wall reflection
- `Game.js` — Set `enemy.heading` at spawn time (direction from generator toward player)
- `tests/enemyAI.test.js` — Updated tests to match new straight-line behavior


---

## BUG-2: Chain explosions have no visual effect

**Status:** Fixed  
**Reported:** 2025-06-23  
**User Story:** US-2 (Explosion & Chain Reactions)  
**Severity:** Gameplay / Visual  

**Description:**  
When the player clicks and the initial explosion hits an enemy, the enemy is destroyed and a chain explosion is enqueued at the enemy's position. However, no visual explosion effect is rendered for the chain explosions — only the initial player explosion gets a visual. This makes it appear that enemies simply vanish rather than exploding, and the chain reaction is invisible.

**Root Cause:**  
`renderer.spawnExplosionEffect()` is only called in `main.js` for the initial player click. The `ExplosionSystem.processExplosion()` method handles chain logic but has no reference to the renderer to spawn visual effects.

**Fix:**  
- Give `ExplosionSystem` an optional `renderer` reference (set via a setter after construction to avoid circular deps)
- In `processExplosion()`, call `renderer.spawnExplosionEffect()` for the current explosion being processed (both initial and chain)
- Remove the manual `spawnExplosionEffect` call from `main.js` (now handled automatically by the system)

**Files Changed:**
- `ExplosionSystem.js` — Added `setRenderer()` method; `processExplosion()` now spawns visual effects
- `main.js` — Calls `explosionSystem.setRenderer(renderer)` after construction; removed manual effect spawn from click handler
