// Seeded pseudo-random number generator (mulberry32).
//
// A seeded RNG makes experiments reproducible: the same scenario + seed yields
// identical vehicle arrivals, so the fixed-time and adaptive controllers can be
// compared on exactly the same traffic (prompt sections 9 and 10).

export function hashSeed(seed) {
  const str = String(seed)
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^= h >>> 16) >>> 0
}

// Returns a generator object with helpers. Keeping it as an object (rather than
// a bare function) lets callers draw floats, ints, and make weighted choices.
export function createRng(seed) {
  let state = hashSeed(seed)

  function next() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next, // float in [0, 1)
    float: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    // Pick an index from an array of weights, proportional to weight.
    weightedIndex(weights) {
      const total = weights.reduce((s, w) => s + w, 0)
      if (total <= 0) return 0
      let r = next() * total
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i]
        if (r < 0) return i
      }
      return weights.length - 1
    },
    // Bernoulli trial.
    chance: (p) => next() < p,
  }
}
