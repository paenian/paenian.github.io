# Requirements Document

## Introduction

Webtend is a browser-based 3D action game hosted on GitHub Pages. The player pilots a spaceship in a third-person perspective through a semi-open maze, chaining explosive attacks to eliminate enemy ship generators across increasingly difficult levels. The game runs entirely in HTML and JavaScript with no backend, using WebGL (via Three.js or equivalent) for 3D rendering. Movement is fast and responsive in a bullet-hell style, enemies are destroyed on contact with the player, and power management creates meaningful risk/reward tension.

## Glossary

- **Game**: The Webtend browser-based 3D action game.
- **Player**: The human controlling the game.
- **Player_Ship**: The spaceship controlled by the Player.
- **Enemy_Ship**: An autonomous spacecraft with an oriented capsule collision shape that navigates the maze and damages the Player_Ship on contact.
- **Generator**: A stationary structure that continuously spawns Enemy_Ships and has a hit point bar. Also called "enemy ship generator."
- **Explosion**: A spherical area-of-effect event triggered by the Player_Ship's click action or by a chain reaction from another Explosion.
- **Power_Level**: A numeric value in the range [0, maxPower] representing the Player_Ship's current strength; it determines Explosion radius, is reduced on contact with Enemy_Ships, and is spent on each explosion click. Reaching 0 triggers game-over.
- **Chain_Reaction**: A sequence of Explosions where each Explosion triggers the next by hitting an Enemy_Ship or another explosive target within its radius.
- **Maze**: The semi-open three-dimensional play field consisting of walls, open corridors, and Generator placements.
- **Level**: A single play field configuration with a set of Generators; completing all Levels advances the Player to the next Level with increased difficulty.
- **Camera**: The third-person viewpoint that follows the Player_Ship and rotates with mouse input.
- **Renderer**: The WebGL-based rendering subsystem responsible for drawing the 3D scene.
- **Physics_Engine**: The subsystem responsible for movement, collision detection, wall slide (player), wall bounce (enemies), and enemy-enemy deflection.
- **HUD**: The heads-up display overlay showing Power_Level, Generator health bars, and other game state information.
- **Oriented_Capsule**: A collision shape defined as a swept sphere along a line segment aligned with an Enemy_Ship's heading direction, with configurable half-length and radius parameters.
- **Death_Explosion**: A maximum-radius explosion triggered on game-over that expands slowly and can chain-react with nearby enemies before the game-over screen appears.
- **Desperation_Shot**: Firing an explosion when Power_Level is 1, reducing it to 0 with the chance to recover if the resulting chain meets the reward threshold.

---

## Requirements

### Requirement 1: Third-Person Camera and Player Ship Control

**User Story:** As a Player, I want to fly my spaceship using keyboard and mouse controls with fast, responsive bullet-hell movement, so that I can dodge streams of enemies and navigate the maze with precision.

#### Acceptance Criteria

1. THE Player_Ship SHALL be rendered as a visible three-dimensional spaceship model in the scene.
2. WHEN the Player presses the W key, THE Player_Ship SHALL accelerate in the direction the Camera is facing (relative forward) at a rate of 200 units per second squared up to a maximum speed of 100 units per second.
3. WHEN the Player presses the S key, THE Player_Ship SHALL accelerate in the direction opposite to the Camera facing direction (relative backward) at a rate of 200 units per second squared up to a maximum speed of 100 units per second.
4. WHEN the Player presses the A key, THE Player_Ship SHALL accelerate to the left relative to the Camera facing direction at a rate of 200 units per second squared up to a maximum speed of 100 units per second.
5. WHEN the Player presses the D key, THE Player_Ship SHALL accelerate to the right relative to the Camera facing direction at a rate of 200 units per second squared up to a maximum speed of 100 units per second.
6. WHEN the Player moves the mouse, THE Camera SHALL rotate around the Player_Ship by the corresponding horizontal and vertical angles, with vertical rotation clamped to a range of -80 to +80 degrees from the horizontal plane.
7. THE Camera SHALL maintain a fixed offset of 10 units behind and 3 units above the Player_Ship at all times.
8. WHEN no movement keys are pressed AND the Player_Ship is currently moving, THE Player_Ship SHALL decelerate uniformly to a full stop within 0.05 seconds (near-instant stop).
9. WHEN multiple movement keys are pressed simultaneously, THE Game SHALL resolve the inputs into a normalized net movement direction and accelerate the Player_Ship in that direction so diagonal movement does not exceed the maximum speed of 100 units per second.
10. WHEN Maze geometry would place the Camera inside a wall at its default offset position, THE Camera SHALL reposition to the nearest unobstructed point along the line between the Player_Ship and the default offset position, maintaining a minimum distance of 1 unit from the Player_Ship.

---

### Requirement 2: Explosion and Chain Reaction Mechanics

**User Story:** As a Player, I want clicking to trigger explosions that chain through enemy ships, so that I can build satisfying combos and increase my power.

#### Acceptance Criteria

1. WHEN the Player clicks the primary mouse button, THE Game SHALL trigger an Explosion centered on the Player_Ship with a radius equal to base_radius + (Power_Level × radius_multiplier).
2. WHEN an Explosion occurs, THE Renderer SHALL display a spherical visual effect at the Explosion's center that persists for at least 0.3 seconds before fading.
3. WHEN an Explosion radius intersects an Enemy_Ship, THE Game SHALL destroy that Enemy_Ship and trigger a new Explosion centered on the destroyed Enemy_Ship's position with the same radius, but only after the Enemy_Ship is confirmed removed from the scene.
4. WHEN an Explosion radius does not intersect any Enemy_Ship or Generator, THE Game SHALL NOT trigger a chain Explosion.
5. WHEN an Explosion radius intersects a Generator, THE Game SHALL reduce that Generator's hit points by one.
6. WHEN a Chain_Reaction produces three or more sequential Explosions, THE Game SHALL increase the Player_Ship's Power_Level by one unit after the final Explosion in the chain resolves.
7. WHEN a chain Explosion is triggered (not the initial Player_Ship click), THE Renderer SHALL display a distinct visual effect and the Game SHALL play a distinct audio cue differentiating it from the initial Explosion.
8. THE Game SHALL collect all Explosion intersection results in the current frame before processing any chain-reaction Explosions, ensuring every Enemy_Ship within the radius is evaluated before any secondary Explosion is triggered.

---

### Requirement 3: Enemy Ships

**User Story:** As a Player, I want to face enemy ships that navigate toward me, collide realistically with each other, and are destroyed on contact with my ship, so that the game presents a continuous, dynamic threat.

#### Acceptance Criteria

1. THE Enemy_Ship SHALL be rendered as a sphere with directional surface dimples that indicate the Enemy_Ship's heading.
2. WHEN spawned, THE Enemy_Ship SHALL receive a fixed heading direction pointing from its spawn position toward the Player_Ship's position at the moment of spawning, and SHALL move in a straight line along that heading at a constant speed without changing direction (except when reflecting off Maze walls or deflecting off other Enemy_Ships).
3. WHEN an Enemy_Ship collides with a Maze wall, THE Physics_Engine SHALL reverse the component of the Enemy_Ship's velocity that is perpendicular to the wall surface while preserving the parallel component and the speed magnitude.
4. WHEN an Enemy_Ship contacts the Player_Ship, THE Game SHALL destroy the Enemy_Ship (remove from scene with no chain explosion) and reduce the Player_Ship's Power_Level by the configured decrement.
5. WHEN an Enemy_Ship contacts the Player_Ship, THE Game SHALL NOT apply any velocity change or knockback to the Player_Ship.
6. WHEN an Enemy_Ship contacts the Player_Ship, THE Game SHALL NOT trigger an Explosion.
7. IF the Player_Ship's Power_Level reaches zero due to enemy contact, THEN THE Game SHALL immediately trigger the game-over death explosion sequence.
8. WHEN two Enemy_Ships' oriented capsules intersect, THE Physics_Engine SHALL deflect both Enemy_Ships' headings based on the contact geometry, push both apart by the penetration depth, and preserve their constant speed.
9. WHEN an Enemy_Ship-to-Enemy_Ship collision occurs with contact near the nose (high dot product between heading and contact normal), THE Physics_Engine SHALL apply a full heading reflection; WHEN contact is on the side (low dot product), THE Physics_Engine SHALL apply a smaller angular deflection.
10. Each Enemy_Ship SHALL have an oriented capsule collision shape aligned along its heading direction, with configurable half-length and radius parameters.

---

### Requirement 4: Enemy Ship Generators

**User Story:** As a Player, I want to destroy enemy ship generators, so that I have a clear win condition and a strategic target.

#### Acceptance Criteria

1. THE Generator SHALL be rendered as a distinct three-dimensional structure, visually differentiable from Maze walls and Enemy_Ships, at a fixed position within the Maze.
2. WHILE a Generator has at least one hit point remaining, THE Generator SHALL display a hit point bar above its model, where the bar fill ratio equals current hit points divided by maximum hit points.
3. WHEN a Generator's hit points reach zero, THE Generator SHALL hide its hit point bar within one rendered frame.
4. THE Generator's maximum hit point value SHALL be a configurable integer in the range 1 to 1000 inclusive.
5. THE Generator SHALL spawn a new Enemy_Ship at a configurable interval; valid spawn intervals are in the range 1 to 300 seconds inclusive, and the spawn interval for Level N SHALL be less than or equal to the spawn interval for Level N-1.
6. WHEN a Generator's hit points reach zero, THE Generator SHALL cease spawning Enemy_Ships and be removed from the scene within one rendered frame.
7. WHEN all Generators on the current Level are destroyed, THE Game SHALL display a level-complete screen.
8. WHEN the level-complete screen has been displayed for at least 2 seconds, THE Game SHALL advance to the next Level.

---

### Requirement 5: Power Level System

**User Story:** As a Player, I want to manage my power level through combat decisions — spending power to fire, losing power to enemies, and gaining power through chains — so that every action has meaningful risk and reward.

#### Acceptance Criteria

1. THE Player_Ship SHALL start each Level with a configurable initial Power_Level value in the range 1 to 100 inclusive.
2. THE Game SHALL use the Power_Level to determine the Explosion radius using the formula: radius = base_radius + (Power_Level × radius_multiplier), where base_radius is a configurable constant greater than zero and radius_multiplier is a configurable constant greater than or equal to zero.
3. WHEN a Chain_Reaction produces the qualifying number of sequential Explosions, THE Game SHALL increase the Player_Ship's Power_Level by a configurable increment in the range 1 to 10 inclusive, up to a configurable maximum Power_Level of 100.
4. WHEN an Enemy_Ship contacts the Player_Ship, THE Game SHALL decrease the Player_Ship's Power_Level by a configurable decrement in the range 1 to 10 inclusive, with a minimum floor of 0.
5. WHEN Power_Level changes for any reason, THE HUD SHALL update the Power_Level numeric display and visual bar within one rendered frame.
6. WHEN the Player clicks to trigger an Explosion, THE Game SHALL deduct 1 from Power_Level (using the pre-deduction value for radius calculation). IF Power_Level is 0, THE Game SHALL NOT allow firing.
7. WHEN Power_Level reaches zero due to enemy contact, THE Game SHALL immediately trigger the game-over death explosion sequence.
8. WHEN Power_Level reaches zero due to an explosion click (desperation shot), THE Game SHALL allow the chain reaction to fully resolve before evaluating game-over. IF the chain meets the threshold, power is restored and the Player survives; otherwise, the death explosion sequence triggers.

---

### Requirement 6: Maze Play Field

**User Story:** As a Player, I want to navigate a maze with walls and open areas, so that positioning and movement create tactical depth.

#### Acceptance Criteria

1. THE Maze SHALL be a three-dimensional structure composed of wall segments and open corridors rendered in the scene.
2. WHEN the Player_Ship collides with a Maze wall, THE Physics_Engine SHALL zero out the velocity component perpendicular to the wall surface and preserve the velocity component parallel to the wall surface (slide behavior), and push the Player_Ship out by the penetration depth.
3. WHEN an Enemy_Ship collides with a Maze wall, THE Physics_Engine SHALL reverse the component of the Enemy_Ship's velocity perpendicular to the wall surface while preserving the parallel component, such that the angle of reflection equals the angle of incidence relative to the wall's surface normal.
4. THE Maze SHALL contain at least one Generator placement per Level, and each Generator placement SHALL be located in an open corridor area accessible to both the Player_Ship and Enemy_Ships.
5. THE Maze SHALL include at least one open area with a clear radius of at least five non-overlapping Explosion radii (calculated at the initial Power_Level) to allow Chain_Reactions of at least five Explosions.
6. IF a post-collision velocity component is less than 1% of the pre-collision speed, THEN THE Physics_Engine SHALL set that velocity component to zero to prevent floating-point instability.

---

### Requirement 7: Level Progression and Difficulty Scaling

**User Story:** As a Player, I want each level to be harder than the last, so that the game remains challenging over time.

#### Acceptance Criteria

1. WHEN the Player advances to a new Level, THE Game SHALL load the Maze configuration for that Level.
2. IF the Maze configuration for the requested Level is missing or invalid, THEN THE Game SHALL display an error message and remain on the current Level without altering game state.
3. WHEN the Player advances to a new Level, THE Generator spawn interval SHALL decrease by a configurable percentage between 1% and 50% relative to the previous Level, with a minimum floor of 0.5 seconds.
4. WHEN the Player advances to a new Level, THE number of Generators SHALL increase by a configurable count between 1 and 5 relative to the previous Level, up to a maximum of 20 Generators per Level.
5. WHEN the Player advances to a new Level, THE Player_Ship's Power_Level SHALL reset to the configurable initial value.
6. THE Game SHALL support at least five distinct Level configurations at initial release, each differing from the others in at least one of the following observable ways: Maze layout, number of Generators, Generator placement, or spawn interval.

---

### Requirement 8: HUD and Game State Display

**User Story:** As a Player, I want to see my current power level and generator health at a glance, so that I can make informed tactical decisions.

#### Acceptance Criteria

1. WHEN Power_Level changes, THE HUD SHALL update the Player_Ship's current Power_Level as a numeric value and a visual bar within one rendered frame, where the bar fill ratio equals current Power_Level divided by maximum Power_Level.
2. WHEN a Generator's hit points change, THE HUD SHALL update that Generator's hit point bar within one rendered frame, where the bar fill ratio equals current hit points divided by maximum hit points.
3. WHEN the current Level changes, THE HUD SHALL update the Level number display within one rendered frame.
4. THE HUD SHALL remain legible at viewport widths between 360 pixels and 2560 pixels, with a minimum text size of 12 CSS pixels and a minimum bar height of 6 CSS pixels.

---

### Requirement 9: Static Hosting and Browser Compatibility

**User Story:** As a developer, I want the game to run entirely in the browser without a backend, so that it can be hosted on GitHub Pages at no cost.

#### Acceptance Criteria

1. THE Game SHALL consist only of HTML, CSS, and JavaScript files with no server-side runtime dependency.
2. WHEN the page loads, THE Renderer SHALL check for WebGL support before attempting to use the WebGL API, and SHALL use the WebGL API only when support is confirmed.
3. THE Game SHALL load and reach an interactive state (defined as the first frame accepting Player input) within 10 seconds on a connection speed of at least 10 Mbps.
4. THE Game SHALL sustain an average of at least 30 frames per second over any 5-second window on hardware that scores at least tier-2 on the WebGL benchmark at the time of release.
5. IF the browser does not support WebGL, THEN THE Game SHALL display a message informing the Player that a WebGL-capable browser is required and SHALL NOT attempt to initialize the Renderer.
6. IF any required game asset fails to load during startup, THEN THE Game SHALL display an error message identifying the failed asset and SHALL NOT attempt to start gameplay.

---

### Requirement 10: Death Explosion Sequence

**User Story:** As a Player, I want my game-over to be dramatic and rewarding, so that even losing feels spectacular.

#### Acceptance Criteria

1. WHEN game-over triggers, THE Game SHALL enter a DYING phase where normal input and spawning are disabled but explosion processing continues.
2. THE Game SHALL spawn a death explosion centered on the Player_Ship with maximum radius (calculated as if Power_Level were maxPower) that expands slowly over 2-3 seconds.
3. THE death explosion SHALL be able to trigger chain reactions on any enemies within its radius.
4. THE Game SHALL display the game-over screen only after all death-explosion chain reactions have fully resolved.
5. THE death explosion SHALL use a visually distinct effect (different color, higher opacity, slower expansion) compared to normal explosions.
