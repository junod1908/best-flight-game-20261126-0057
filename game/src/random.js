// Deterministic seeded random numbers (mulberry32) so a seed always replays the same world.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer range helper on a seeded rng. A swapped range still works: the bounds are
// ordered first, so a caller passing (max, min) by mistake gets the same range.
export function randomInt(rng, min, max) {
  if (min > max) [min, max] = [max, min];
  return min + Math.floor(rng() * (max - min + 1));
}

// Pick one element of an array with a seeded rng.
export function randomPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
