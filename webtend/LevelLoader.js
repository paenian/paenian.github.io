// LevelLoader.js — Fetch and validate JSON level configurations.

const REQUIRED_CONFIG_KEYS = [
  'baseExplosionRadius',
  'radiusMultiplier',
  'chainThreshold',
  'powerGainIncrement',
  'powerDecrement',
  'maxPower',
  'enemySpeed',
  'playerMaxSpeed',
  'playerAcceleration',
  'decelerationTime',
];

export class LevelConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LevelConfigError';
  }
}

/**
 * Fetch and validate a level config by 1-based index.
 * @param {number} index
 * @returns {Promise<object>}
 */
export async function loadLevel(index) {
  let data;
  try {
    const response = await fetch(`./levels/level${index}.json`);
    if (!response.ok) {
      throw new LevelConfigError(
        `Failed to fetch level ${index}: HTTP ${response.status} ${response.statusText}`
      );
    }
    data = await response.json();
  } catch (err) {
    if (err instanceof LevelConfigError) {
      throw err;
    }
    throw new LevelConfigError(
      `Failed to load level ${index}: ${err.message}`
    );
  }

  validateLevelData(data);
  return data;
}

/**
 * Validate level data shape and value ranges.
 * Throws LevelConfigError on any violation.
 * @param {unknown} data
 * @returns {object}
 */
export function validateLevelData(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new LevelConfigError('Level data must be an object');
  }

  // Required top-level fields
  const requiredFields = ['id', 'initialPowerLevel', 'walls', 'generators', 'playerStart', 'config'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new LevelConfigError(`Missing required field: "${field}"`);
    }
  }

  // initialPowerLevel: [1, 100]
  const { initialPowerLevel } = data;
  if (typeof initialPowerLevel !== 'number' || initialPowerLevel < 1 || initialPowerLevel > 100) {
    throw new LevelConfigError(
      `"initialPowerLevel" must be a number in [1, 100], got: ${initialPowerLevel}`
    );
  }

  // walls: must be an array
  if (!Array.isArray(data.walls)) {
    throw new LevelConfigError('"walls" must be an array');
  }

  // generators: must be an array, each entry validated
  if (!Array.isArray(data.generators)) {
    throw new LevelConfigError('"generators" must be an array');
  }
  for (let i = 0; i < data.generators.length; i++) {
    validateGenerator(data.generators[i], i);
  }

  // playerStart: array of exactly 3 numbers
  const { playerStart } = data;
  if (
    !Array.isArray(playerStart) ||
    playerStart.length !== 3 ||
    !playerStart.every((v) => typeof v === 'number')
  ) {
    throw new LevelConfigError('"playerStart" must be an array of exactly 3 numbers');
  }

  // config: object with all required keys
  const { config } = data;
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new LevelConfigError('"config" must be an object');
  }
  for (const key of REQUIRED_CONFIG_KEYS) {
    if (!(key in config)) {
      throw new LevelConfigError(`"config" is missing required key: "${key}"`);
    }
  }

  return data;
}

/**
 * Validate a single generator entry.
 * @param {unknown} gen
 * @param {number} index
 */
function validateGenerator(gen, index) {
  const prefix = `generators[${index}]`;

  if (gen === null || typeof gen !== 'object' || Array.isArray(gen)) {
    throw new LevelConfigError(`${prefix} must be an object`);
  }

  for (const field of ['id', 'position', 'maxHp', 'spawnIntervalSeconds']) {
    if (!(field in gen)) {
      throw new LevelConfigError(`${prefix} is missing required field: "${field}"`);
    }
  }

  // maxHp: [1, 1000]
  const { maxHp } = gen;
  if (typeof maxHp !== 'number' || maxHp < 1 || maxHp > 1000) {
    throw new LevelConfigError(
      `${prefix} "maxHp" must be a number in [1, 1000], got: ${maxHp}`
    );
  }

  // spawnIntervalSeconds: [1, 300]
  const { spawnIntervalSeconds } = gen;
  if (
    typeof spawnIntervalSeconds !== 'number' ||
    spawnIntervalSeconds < 1 ||
    spawnIntervalSeconds > 300
  ) {
    throw new LevelConfigError(
      `${prefix} "spawnIntervalSeconds" must be a number in [1, 300], got: ${spawnIntervalSeconds}`
    );
  }
}
