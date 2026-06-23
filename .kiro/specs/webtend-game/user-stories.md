# User Stories — Webtend Game

All implementation tasks must reference a user story from this list. If a task doesn't fit an existing story, a new story must be added here first.

---

## US-1: Ship Navigation

**As a** Player,  
**I want** to fly my spaceship using keyboard and mouse controls,  
**so that** I can navigate the maze and aim attacks.

**Acceptance Criteria:** Requirements 1.1–1.10

---

## US-2: Explosion & Chain Reactions

**As a** Player,  
**I want** clicking to trigger explosions that chain through enemy ships,  
**so that** I can build satisfying combos and increase my power.

**Acceptance Criteria:** Requirements 2.1–2.8

---

## US-3: Enemy Ships

**As a** Player,  
**I want** to face enemy ships that navigate toward me,  
**so that** the game presents a continuous threat.

**Acceptance Criteria:** Requirements 3.1–3.7

---

## US-4: Enemy Ship Generators

**As a** Player,  
**I want** to destroy enemy ship generators,  
**so that** I have a clear win condition and a strategic target.

**Acceptance Criteria:** Requirements 4.1–4.8

---

## US-5: Power Level System

**As a** Player,  
**I want** to manage my power level through combat decisions,  
**so that** chaining explosions is rewarded and taking hits is punished.

**Acceptance Criteria:** Requirements 5.1–5.6

---

## US-6: Maze Play Field

**As a** Player,  
**I want** to navigate a maze with walls and open areas,  
**so that** positioning and movement create tactical depth.

**Acceptance Criteria:** Requirements 6.1–6.6

---

## US-7: Level Progression

**As a** Player,  
**I want** each level to be harder than the last,  
**so that** the game remains challenging over time.

**Acceptance Criteria:** Requirements 7.1–7.6

---

## US-8: HUD & Game State Display

**As a** Player,  
**I want** to see my current power level and generator health at a glance,  
**so that** I can make informed tactical decisions.

**Acceptance Criteria:** Requirements 8.1–8.4

---

## US-9: Static Hosting & Compatibility

**As a** developer,  
**I want** the game to run entirely in the browser without a backend,  
**so that** it can be hosted on GitHub Pages at no cost.

**Acceptance Criteria:** Requirements 9.1–9.6

---

## US-10: Test Coverage & Quality

**As a** developer,  
**I want** property-based and example-based tests for all pure game logic,  
**so that** correctness is verified automatically and regressions are caught.

**Acceptance Criteria:**
- All 12 property tests pass (Properties 1–12)
- Example-based tests cover LevelLoader, HUD, InputHandler, and EnemyAI
- Full test suite runs after every task

---

## US-11: Asset Skinning & Decoration

**As an** Artist,  
**I want** to be able to decorate or skin all assets of the game,  
**so that** I can give the game a unique visual identity without touching game logic.

### Epics

#### Epic 11.1: Player Ship Skinning

Replace the procedural ConeGeometry ship with an externally loaded model (GLTF/GLB) or allow swapping materials/textures on the existing geometry.

**Complete when:**
- A ship model or texture can be swapped by replacing a single asset file
- The ship renders correctly with the new skin at all angles
- No game logic changes are required to apply a new skin

#### Epic 11.2: Enemy Ship Skinning

Allow enemy ships to use custom models or textures instead of the default red sphere.

**Complete when:**
- An enemy model or texture can be swapped by replacing a single asset file
- Directional heading indicators remain visible on the skinned model
- Enemy bounding sphere radius is preserved regardless of visual model

#### Epic 11.3: Generator Skinning

Allow generators to use custom models or textures instead of the default green sphere.

**Complete when:**
- A generator model or texture can be swapped by replacing a single asset file
- The HP bar remains correctly positioned above the skinned model
- Generator bounding sphere radius is preserved regardless of visual model

#### Epic 11.4: Maze Wall Skinning

Allow maze walls to use custom textures or materials instead of the default gray.

**Complete when:**
- Wall textures/materials can be changed by replacing asset files or a theme config
- Walls remain physically correct AABBs regardless of visual appearance
- Different levels can use different wall themes

#### Epic 11.5: Explosion Effect Skinning

Allow explosion visual effects to use custom particle systems, shaders, or sprite sheets.

**Complete when:**
- Explosion visuals can be replaced without changing ExplosionSystem logic
- Chain vs. initial explosion distinction remains visually clear
- The 0.3s minimum display time is preserved

#### Epic 11.6: HUD Theming

Allow the HUD overlay to be restyled via CSS themes or a theme config file.

**Complete when:**
- HUD colors, fonts, and bar styles can be changed via a single CSS file or theme config
- All HUD elements remain legible at 360–2560px viewport widths
- No JavaScript changes required to apply a new theme

#### Epic 11.7: Skybox / Environment Skinning

Allow the scene background/skybox to be customized per level or globally.

**Complete when:**
- A skybox or background color can be set via a config or asset file
- Different levels can have different environments
- No Renderer.js logic changes required beyond initial setup
