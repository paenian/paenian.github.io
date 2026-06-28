/**
 * Renderer.js — Three.js scene, camera rig, and render call.
 *
 * Requirements: 1.1, 1.6, 1.7, 1.10, 2.2, 2.7, 3.1, 4.1, 4.3, 4.6, 6.1, 9.2, 9.3
 */

import * as THREE from 'three';
import { GameState, playerShip } from './GameState.js';

export class Renderer {
  /**
   * 10.1 — Constructor
   * Create WebGLRenderer, Scene, PerspectiveCamera, camera rig, and resize handler.
   * @param {HTMLCanvasElement} canvas
   * @param {typeof GameState} gameState
   */
  constructor(canvas, gameState) {
    this.gameState = gameState;

    // WebGL renderer attached to the provided canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Scene
    this.scene = new THREE.Scene();

    // PerspectiveCamera: fov 60, near 0.1, far 1000
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);

    // Camera rig: rigYaw → rigPitch → camera at offset (0, 3, 10)
    this.rigYaw = new THREE.Object3D();
    this.rigPitch = new THREE.Object3D();
    this.rigYaw.add(this.rigPitch);
    this.rigPitch.add(this.camera);
    this.camera.position.set(0, 3, 10);
    this.scene.add(this.rigYaw);

    // Default camera offset distance for clip check
    this.defaultCameraDistance = Math.sqrt(0 * 0 + 3 * 3 + 10 * 10); // ~10.44

    // Wall meshes for raycasting (camera clip check)
    this.wallMeshes = [];

    // Raycaster for camera clip checks
    this.raycaster = new THREE.Raycaster();

    // Ship mesh reference (assigned in buildScene)
    this.shipMesh = null;

    // Debug top-down camera (orthographic)
    this.debugMode = true;
    const viewSize = 80; // units visible in each direction
    this.debugCamera = new THREE.OrthographicCamera(
      -viewSize, viewSize, viewSize, -viewSize, 0.1, 500
    );
    this.debugCamera.position.set(0, 200, 0);
    this.debugCamera.lookAt(0, 0, 0);

    // Handle window resize
    this._onResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      // Update debug camera aspect
      const aspect = width / height;
      const viewSize = 80;
      this.debugCamera.left = -viewSize * aspect;
      this.debugCamera.right = viewSize * aspect;
      this.debugCamera.top = viewSize;
      this.debugCamera.bottom = -viewSize;
      this.debugCamera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };
    window.addEventListener('resize', this._onResize);
  }

  /**
   * 10.2 — buildScene(levelData)
   * Clear scene and rebuild geometry from level data.
   * @param {Object} levelData - The loaded level configuration.
   */
  buildScene(levelData) {
    // Clear existing scene children except camera rig and lights
    const toRemove = [];
    this.scene.traverse((child) => {
      if (child !== this.scene && child !== this.rigYaw && !this.rigYaw.getObjectById(child.id)) {
        if (child.parent === this.scene) {
          toRemove.push(child);
        }
      }
    });
    for (const obj of toRemove) {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }

    // Reset wall meshes
    this.wallMeshes = [];

    // Build wall meshes from gameState.walls (already converted to {min, max, normal})
    for (const wall of this.gameState.walls) {
      const min = wall.min;
      const max = wall.max;
      const width = max.x - min.x;
      const height = max.y - min.y;
      const depth = max.z - min.z;

      const geometry = new THREE.BoxGeometry(width, height, depth);
      const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
      const mesh = new THREE.Mesh(geometry, material);

      // Position at AABB center
      mesh.position.set(
        min.x + width / 2,
        min.y + height / 2,
        min.z + depth / 2
      );

      this.scene.add(mesh);
      this.wallMeshes.push(mesh);
    }

    // Build generator meshes
    for (const generator of this.gameState.generators) {
      const geometry = new THREE.SphereGeometry(2, 16, 16);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(generator.position.x, generator.position.y, generator.position.z);
      this.scene.add(mesh);
      generator.mesh = mesh;
    }

    // Create player ship mesh (ConeGeometry pointing forward + blue material)
    const shipGeometry = new THREE.ConeGeometry(0.8, 2.5, 8);
    const shipMaterial = new THREE.MeshStandardMaterial({ color: 0x4488ff });
    this.shipMesh = new THREE.Mesh(shipGeometry, shipMaterial);
    // Rotate cone so it points forward (along -Z)
    this.shipMesh.rotation.x = Math.PI / 2;
    this.shipMesh.position.set(
      playerShip.position.x,
      playerShip.position.y,
      playerShip.position.z
    );
    this.scene.add(this.shipMesh);
    playerShip.mesh = this.shipMesh;

    // Lighting: AmbientLight + DirectionalLight
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);
  }

  /**
   * 10.3 — addEnemy(enemy)
   * Create a sphere mesh for the enemy and add to scene.
   * @param {Object} enemy
   */
  addEnemy(enemy) {
    const geometry = new THREE.SphereGeometry(enemy.radius, 12, 12);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
    this.scene.add(mesh);
    enemy.mesh = mesh;
  }

  /**
   * 10.3 — removeEnemy(enemy)
   * Remove enemy mesh from scene and dispose resources.
   * @param {Object} enemy
   */
  removeEnemy(enemy) {
    if (enemy.mesh) {
      this.scene.remove(enemy.mesh);
      if (enemy.mesh.geometry) enemy.mesh.geometry.dispose();
      if (enemy.mesh.material) enemy.mesh.material.dispose();
      enemy.mesh = null;
    }
  }

  /**
   * 10.3 — removeGenerator(generator)
   * Remove generator mesh from scene and dispose resources.
   * @param {Object} generator
   */
  removeGenerator(generator) {
    if (generator.mesh) {
      this.scene.remove(generator.mesh);
      if (generator.mesh.geometry) generator.mesh.geometry.dispose();
      if (generator.mesh.material) generator.mesh.material.dispose();
      generator.mesh = null;
    }
  }

  /**
   * 10.4 — spawnExplosionEffect(pos, radius, isChain)
   * Create a semi-transparent sphere effect at the explosion position.
   * @param {{ x: number, y: number, z: number }} pos
   * @param {number} radius
   * @param {boolean} isChain
   */
  spawnExplosionEffect(pos, radius, isChain) {
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: isChain ? 0xff8800 : 0xffff00,
      transparent: true,
      opacity: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(pos.x, pos.y, pos.z);
    this.scene.add(mesh);

    // Schedule removal after 300ms
    setTimeout(() => {
      this.scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    }, 300);
  }

  /**
   * Spawn a slow-expanding death explosion visual effect.
   * @param {{ x: number, y: number, z: number }} pos
   * @param {number} maxRadius
   * @param {number} durationMs
   */
  spawnDeathExplosionEffect(pos, maxRadius, durationMs) {
    const geometry = new THREE.SphereGeometry(1, 24, 24); // unit sphere, scaled over time
    const material = new THREE.MeshBasicMaterial({
      color: 0xff2200,
      transparent: true,
      opacity: 0.7,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.scale.set(0.01, 0.01, 0.01); // start nearly invisible
    this.scene.add(mesh);

    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1.0);
      const currentRadius = maxRadius * progress;
      mesh.scale.set(currentRadius, currentRadius, currentRadius);
      material.opacity = 0.7 * (1 - progress * 0.5); // fade slightly over time

      if (progress < 1.0) {
        requestAnimationFrame(animate);
      } else {
        this.scene.remove(mesh);
        geometry.dispose();
        material.dispose();
      }
    };
    requestAnimationFrame(animate);
  }

  /**
   * Toggle between normal third-person camera and debug top-down view.
   */
  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    return this.debugMode;
  }

  /**
   * 10.5 — updateCameraRig(shipPos, yaw, pitch)
   * Position and orient the camera rig to follow the ship.
   * @param {{ x: number, y: number, z: number }} shipPos
   * @param {number} yaw - Radians
   * @param {number} pitch - Radians
   */
  updateCameraRig(shipPos, yaw, pitch) {
    // Update debug camera to follow ship from above
    if (this.debugMode) {
      this.debugCamera.position.set(shipPos.x, 200, shipPos.z);
      this.debugCamera.lookAt(shipPos.x, 0, shipPos.z);
    }

    // Position rig at ship
    this.rigYaw.position.set(shipPos.x, shipPos.y, shipPos.z);

    // Apply yaw rotation
    this.rigYaw.rotation.y = yaw;

    // Clamp pitch to ±80° (±1.396 radians)
    const maxPitch = 1.396;
    const clampedPitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));

    // Apply pitch (negative because looking down = positive pitch)
    this.rigPitch.rotation.x = -clampedPitch;

    // Camera clip check: raycast from ship toward camera world position
    this.camera.updateMatrixWorld(true);
    const cameraWorldPos = new THREE.Vector3();
    this.camera.getWorldPosition(cameraWorldPos);

    const shipWorldPos = new THREE.Vector3(shipPos.x, shipPos.y, shipPos.z);
    const direction = new THREE.Vector3().subVectors(cameraWorldPos, shipWorldPos).normalize();
    const distanceToCamera = shipWorldPos.distanceTo(cameraWorldPos);

    this.raycaster.set(shipWorldPos, direction);
    this.raycaster.far = distanceToCamera;

    const intersections = this.raycaster.intersectObjects(this.wallMeshes, false);

    if (intersections.length > 0) {
      const hitDistance = intersections[0].distance;
      // Reposition camera to hit point (minimum 1 unit from ship)
      const safeDistance = Math.max(1.0, hitDistance - 0.5);
      // Calculate local offset that places camera at safeDistance from rig
      // We scale the default offset proportionally
      const scale = safeDistance / this.defaultCameraDistance;
      this.camera.position.set(0, 3 * scale, 10 * scale);
    } else {
      // Reset to default offset
      this.camera.position.set(0, 3, 10);
    }
  }

  /**
   * 10.6 — render()
   * Remove pending entities, sync mesh positions, and render the frame.
   */
  render() {
    // Remove entities flagged pendingRemoval from enemies
    for (let i = this.gameState.enemies.length - 1; i >= 0; i--) {
      const enemy = this.gameState.enemies[i];
      if (enemy.pendingRemoval) {
        this.removeEnemy(enemy);
        this.gameState.enemies.splice(i, 1);
      }
    }

    // Remove entities flagged pendingRemoval from generators
    for (let i = this.gameState.generators.length - 1; i >= 0; i--) {
      const generator = this.gameState.generators[i];
      if (generator.pendingRemoval) {
        this.removeGenerator(generator);
        this.gameState.generators.splice(i, 1);
      }
    }

    // Update enemy mesh positions
    for (const enemy of this.gameState.enemies) {
      if (enemy.mesh) {
        enemy.mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
      }
    }

    // Update generator mesh positions
    for (const generator of this.gameState.generators) {
      if (generator.mesh) {
        generator.mesh.position.set(generator.position.x, generator.position.y, generator.position.z);
      }
    }

    // Update ship mesh position
    if (this.shipMesh) {
      this.shipMesh.position.set(
        playerShip.position.x,
        playerShip.position.y,
        playerShip.position.z
      );
    }

    // Use debug camera if active, otherwise normal camera
    const activeCamera = this.debugMode ? this.debugCamera : this.camera;
    this.renderer.render(this.scene, activeCamera);
  }
}
