// Feature: webtend-game
// Tests for LevelLoader.js: error handling examples
// Covers Requirements 7.1, 7.2, 9.6

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadLevel, validateLevelData, LevelConfigError } from '../LevelLoader.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_LEVEL = {
  id: 1,
  initialPowerLevel: 5,
  walls: [{ min: [-50, 0, -50], max: [-45, 10, 50] }],
  generators: [
    { id: 'g1', position: [10, 0, 10], maxHp: 5, spawnIntervalSeconds: 8.0 },
  ],
  playerStart: [0, 0, 0],
  config: {
    baseExplosionRadius: 5,
    radiusMultiplier: 0.5,
    chainThreshold: 3,
    powerGainIncrement: 1,
    powerDecrement: 1,
    maxPower: 100,
    enemySpeed: 8,
    playerMaxSpeed: 50,
    playerAcceleration: 20,
    decelerationTime: 0.5,
  },
};

function validLevel(overrides = {}) {
  return { ...VALID_LEVEL, ...overrides };
}

// ---------------------------------------------------------------------------
// validateLevelData — top-level field checks
// ---------------------------------------------------------------------------

describe('validateLevelData', () => {
  test('accepts a fully valid level object', () => {
    expect(() => validateLevelData(validLevel())).not.toThrow();
    expect(validateLevelData(validLevel())).toEqual(VALID_LEVEL);
  });

  test('throws LevelConfigError for each missing top-level field', () => {
    const required = ['id', 'initialPowerLevel', 'walls', 'generators', 'playerStart', 'config'];
    for (const field of required) {
      const data = { ...VALID_LEVEL };
      delete data[field];
      expect(() => validateLevelData(data)).toThrowError(LevelConfigError);
      expect(() => validateLevelData(data)).toThrowError(new RegExp(field));
    }
  });

  test('throws when data is not an object', () => {
    expect(() => validateLevelData(null)).toThrowError(LevelConfigError);
    expect(() => validateLevelData([])).toThrowError(LevelConfigError);
    expect(() => validateLevelData(42)).toThrowError(LevelConfigError);
    expect(() => validateLevelData('string')).toThrowError(LevelConfigError);
  });

  // initialPowerLevel
  test('throws when initialPowerLevel is below 1', () => {
    expect(() => validateLevelData(validLevel({ initialPowerLevel: 0 }))).toThrowError(LevelConfigError);
  });

  test('throws when initialPowerLevel is above 100', () => {
    expect(() => validateLevelData(validLevel({ initialPowerLevel: 101 }))).toThrowError(LevelConfigError);
  });

  test('accepts initialPowerLevel at boundary values 1 and 100', () => {
    expect(() => validateLevelData(validLevel({ initialPowerLevel: 1 }))).not.toThrow();
    expect(() => validateLevelData(validLevel({ initialPowerLevel: 100 }))).not.toThrow();
  });

  test('throws when initialPowerLevel is not a number', () => {
    expect(() => validateLevelData(validLevel({ initialPowerLevel: '5' }))).toThrowError(LevelConfigError);
  });

  // walls
  test('throws when walls is not an array', () => {
    expect(() => validateLevelData(validLevel({ walls: {} }))).toThrowError(LevelConfigError);
    expect(() => validateLevelData(validLevel({ walls: null }))).toThrowError(LevelConfigError);
  });

  test('accepts an empty walls array', () => {
    expect(() => validateLevelData(validLevel({ walls: [] }))).not.toThrow();
  });

  // generators
  test('throws when generators is not an array', () => {
    expect(() => validateLevelData(validLevel({ generators: {} }))).toThrowError(LevelConfigError);
  });

  test('accepts an empty generators array', () => {
    expect(() => validateLevelData(validLevel({ generators: [] }))).not.toThrow();
  });

  // playerStart
  test('throws when playerStart is not an array of 3 numbers', () => {
    expect(() => validateLevelData(validLevel({ playerStart: [0, 0] }))).toThrowError(LevelConfigError);
    expect(() => validateLevelData(validLevel({ playerStart: [0, 0, 0, 0] }))).toThrowError(LevelConfigError);
    expect(() => validateLevelData(validLevel({ playerStart: [0, 0, 'z'] }))).toThrowError(LevelConfigError);
    expect(() => validateLevelData(validLevel({ playerStart: null }))).toThrowError(LevelConfigError);
  });

  test('accepts playerStart with negative coordinates', () => {
    expect(() => validateLevelData(validLevel({ playerStart: [-10, 0, -10] }))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateLevelData — generator validation
// ---------------------------------------------------------------------------

describe('validateLevelData — generator entries', () => {
  function levelWithGenerator(genOverrides) {
    return validLevel({
      generators: [{ ...VALID_LEVEL.generators[0], ...genOverrides }],
    });
  }

  test('throws for each missing generator field', () => {
    for (const field of ['id', 'position', 'maxHp', 'spawnIntervalSeconds']) {
      const gen = { ...VALID_LEVEL.generators[0] };
      delete gen[field];
      expect(() => validateLevelData(validLevel({ generators: [gen] }))).toThrowError(LevelConfigError);
    }
  });

  test('throws when generator maxHp is below 1', () => {
    expect(() => validateLevelData(levelWithGenerator({ maxHp: 0 }))).toThrowError(LevelConfigError);
  });

  test('throws when generator maxHp is above 1000', () => {
    expect(() => validateLevelData(levelWithGenerator({ maxHp: 1001 }))).toThrowError(LevelConfigError);
  });

  test('accepts generator maxHp at boundary values 1 and 1000', () => {
    expect(() => validateLevelData(levelWithGenerator({ maxHp: 1 }))).not.toThrow();
    expect(() => validateLevelData(levelWithGenerator({ maxHp: 1000 }))).not.toThrow();
  });

  test('throws when generator spawnIntervalSeconds is below 1', () => {
    expect(() => validateLevelData(levelWithGenerator({ spawnIntervalSeconds: 0.5 }))).toThrowError(LevelConfigError);
  });

  test('throws when generator spawnIntervalSeconds is above 300', () => {
    expect(() => validateLevelData(levelWithGenerator({ spawnIntervalSeconds: 301 }))).toThrowError(LevelConfigError);
  });

  test('accepts spawnIntervalSeconds at boundary values 1 and 300', () => {
    expect(() => validateLevelData(levelWithGenerator({ spawnIntervalSeconds: 1 }))).not.toThrow();
    expect(() => validateLevelData(levelWithGenerator({ spawnIntervalSeconds: 300 }))).not.toThrow();
  });

  test('includes generator index in error message for multi-generator levels', () => {
    const badGen = { id: 'g2', position: [5, 0, 5], maxHp: 9999, spawnIntervalSeconds: 10 };
    const data = validLevel({ generators: [VALID_LEVEL.generators[0], badGen] });
    let err;
    try {
      validateLevelData(data);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(LevelConfigError);
    expect(err.message).toMatch(/generators\[1\]/);
  });
});

// ---------------------------------------------------------------------------
// validateLevelData — config object validation
// ---------------------------------------------------------------------------

describe('validateLevelData — config object', () => {
  const CONFIG_KEYS = [
    'baseExplosionRadius', 'radiusMultiplier', 'chainThreshold', 'powerGainIncrement',
    'powerDecrement', 'maxPower', 'enemySpeed', 'playerMaxSpeed', 'playerAcceleration',
    'decelerationTime',
  ];

  test('throws for each missing config key', () => {
    for (const key of CONFIG_KEYS) {
      const config = { ...VALID_LEVEL.config };
      delete config[key];
      expect(() => validateLevelData(validLevel({ config }))).toThrowError(LevelConfigError);
      expect(() => validateLevelData(validLevel({ config }))).toThrowError(new RegExp(key));
    }
  });

  test('throws when config is not an object', () => {
    expect(() => validateLevelData(validLevel({ config: null }))).toThrowError(LevelConfigError);
    expect(() => validateLevelData(validLevel({ config: [] }))).toThrowError(LevelConfigError);
    expect(() => validateLevelData(validLevel({ config: 'bad' }))).toThrowError(LevelConfigError);
  });
});

// ---------------------------------------------------------------------------
// LevelConfigError — class identity
// ---------------------------------------------------------------------------

describe('LevelConfigError', () => {
  test('is an instance of Error', () => {
    const err = new LevelConfigError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(LevelConfigError);
  });

  test('has name "LevelConfigError"', () => {
    const err = new LevelConfigError('test');
    expect(err.name).toBe('LevelConfigError');
  });

  test('carries the provided message', () => {
    const err = new LevelConfigError('bad field');
    expect(err.message).toBe('bad field');
  });
});

// ---------------------------------------------------------------------------
// loadLevel — fetch integration (mocked)
// ---------------------------------------------------------------------------

describe('loadLevel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('returns parsed and validated level data on success', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...VALID_LEVEL }),
    });

    const result = await loadLevel(1);
    expect(result).toEqual(VALID_LEVEL);
    expect(fetch).toHaveBeenCalledWith('./levels/level1.json');
  });

  test('uses the index in the fetch URL', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...VALID_LEVEL }),
    });

    await loadLevel(3);
    expect(fetch).toHaveBeenCalledWith('./levels/level3.json');
  });

  test('throws LevelConfigError when fetch returns a non-ok response', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });

    await expect(loadLevel(99)).rejects.toThrowError(LevelConfigError);
    await expect(loadLevel(99)).rejects.toThrowError(/404/);
  });

  test('throws LevelConfigError when the network request fails', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Network failure'));

    await expect(loadLevel(1)).rejects.toThrowError(LevelConfigError);
    await expect(loadLevel(1)).rejects.toThrowError(/Network failure/);
  });

  test('throws LevelConfigError when JSON is invalid / parse fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    });

    await expect(loadLevel(1)).rejects.toThrowError(LevelConfigError);
  });

  test('throws LevelConfigError when loaded data fails validation', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1 }), // missing required fields
    });

    await expect(loadLevel(1)).rejects.toThrowError(LevelConfigError);
  });
});
