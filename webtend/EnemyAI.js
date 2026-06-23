// EnemyAI.js — Steering behavior: seek player, avoid walls.

export class EnemyAI {
  constructor(_gameState, _config) {}

  update(_enemy, _playerPos, _walls, _dt) {}
  seek(_enemy, _target) { return { x: 0, y: 0, z: 0 }; }
  avoidWalls(_enemy, _walls) { return { x: 0, y: 0, z: 0 }; }
}
