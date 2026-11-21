// A small seeded random source, so a ?seed=N run is the same run every time.
// Mulberry32: short, fast, and good enough for patrol jitter and coin scatter.
export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
  };
}
