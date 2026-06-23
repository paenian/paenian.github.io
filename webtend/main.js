// main.js — Bootstrap entry point
// Instantiates all subsystems and starts the game loop.
// Requirements: 2.1, 9.1, 9.3, 9.4

import { GameState, playerShip } from './GameState.js';
import { InputHandler } from './InputHandler.js';
import { Renderer } from './Renderer.js';
import { HUD } from './HUD.js';
import { EnemyAI } from './EnemyAI.js';
import { ExplosionSystem } from './ExplosionSystem.js';
import { Game } from './Game.js';

// Get the canvas element
const canvas = document.getElementById('game-canvas');

// Instantiate subsystems
const inputHandler = new InputHandler(canvas);
const renderer = new Renderer(canvas, GameState);
const hud = new HUD();
const enemyAI = new EnemyAI({ enemySpeed: 5, avoidRadius: 5 }); // defaults, updated per level
const explosionSystem = new ExplosionSystem(GameState, {}); // config set on level load

// Instantiate Game with dependency injection
const game = new Game({ renderer, hud, inputHandler, explosionSystem, enemyAI });

// Request pointer lock on canvas click
canvas.addEventListener('click', () => {
  if (GameState.phase === 'PLAYING') {
    if (!inputHandler.isPointerLocked()) {
      inputHandler.requestPointerLock();
    } else {
      // Player click triggers explosion at ship position
      explosionSystem.onPlayerClick(playerShip.position);
      // Spawn visual effect
      const radius = explosionSystem.calcRadius(GameState.powerLevel);
      renderer.spawnExplosionEffect(playerShip.position, radius, false);
    }
  }
});

// Start the game (WebGL check + load level 1)
game.start();

// Game loop using requestAnimationFrame
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1); // cap dt at 100ms to prevent spiral
  lastTime = now;

  game.update(dt);
  renderer.render();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
