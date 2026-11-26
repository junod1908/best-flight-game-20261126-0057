// Tunables for ASHWING — Wildfire Airtanker. One place for every number the flight model,
// the fire spread and the missions use, so a balance pass touches this file only.
export const WORLD = {
  size: 2600,
  lake: { x: -480, z: -380, radius: 300, waterY: 0 },
  strip: { x: 520, z: 320, heading: -Math.PI / 2, length: 340, width: 46, groundY: 6 },
  valleyRadius: 1300,
};

export const PLANE = {
  maxSpeed: 92,
  stallSpeed: 26,
  cruiseThrottle: 0.62,
  maxPitch: 0.42,
  maxBank: 0.75,
  climbRate: 1.0,
  fuelCapacity: 100,
  waterCapacity: 100,
  fuelBurnPerSec: 0.55,
  scoopRate: 34,
  dropRate: 46,
  tankWeightPenalty: 0.22,
};

export const FIRE = {
  zones: [
    { name: 'Pine Hollow', x: 120, z: -140, radius: 95, flames: 26, wind: 0.9 },
    { name: 'Ridge Cut', x: -140, z: 360, radius: 125, flames: 34, wind: 1.2 },
    { name: 'Ember Basin', x: 430, z: -470, radius: 155, flames: 44, wind: 1.5 },
  ],
  spreadPerSec: 0.55,
  smokeDamagePerSec: 6,
  terrainDamage: 55,
  hardLandingVs: 9,
};

export const MISSION = {
  scorePerFireOut: 100,
  scorePerZone: 400,
  timeBonusPerSec: 2,
};

export const SHOT = { seed: 1, step: 1 / 60 };
