// The Silent Stacks — configuration: the board, the tuning and the three archive floors.
// One clear job: every number and every level layout lives here, so the world, the guards and
// the renderer all read the same truth and a balance change is a one-line edit.

/** Size of one floor tile, in canvas pixels. */
export const TILE = 32;
/** The archive floor, in tiles. The whole floor fits on screen at once. */
export const COLS = 36;
export const ROWS = 20;
/** World size in pixels, derived from the tile grid. */
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
/** Fixed simulation step, seconds. */
export const STEP = 1 / 60;
/** Best-run key in local storage. */
export const BEST_KEY = 'silent-stacks-best';

/** Player tuning. */
export const PLAYER = {
  radius: 11,
  walkSpeed: 3.4 * TILE,
  sneakSpeed: 1.9 * TILE,
  // How far a guard can hear a running footstep, in tiles.
  noiseRadius: 5.5 * TILE,
  // How far a guard can hear a sneaking step, in tiles.
  sneakNoiseRadius: 1.6 * TILE,
  coins: 3,
};

/** Guard tuning. */
export const GUARD = {
  radius: 12,
  patrolSpeed: 1.55 * TILE,
  chaseSpeed: 2.9 * TILE,
  investigateSpeed: 2.2 * TILE,
  /** Vision range, in tiles. */
  sightRange: 6.2 * TILE,
  /** Half of the vision cone angle, in radians. */
  sightHalfAngle: 0.61,
  /** Seconds a guard pauses at each patrol waypoint. */
  pauseAtWaypoint: 1.4,
  /** Detection 0..100; this fast it fills when the player is plainly in view. */
  detectRateClose: 95,
  detectRateFar: 42,
  /** Detection falls this fast when the player is out of sight. */
  detectDecay: 26,
  /** Sneaking halves how fast detection fills. */
  sneakDetectFactor: 0.45,
  /** Seconds a chasing guard keeps hunting after losing sight before giving up. */
  chaseMemory: 3.0,
  /** Seconds a guard stays suspicious (searching) after giving up a chase. */
  searchTime: 4.0,
};

/** How long, in seconds, a thrown coin's ring pulls a guard. */
export const COIN_NOISE_TIME = 2.5;
/** A guard that reaches the player while alarmed catches them. */
export const CATCH_DISTANCE = 26;

/** A floor of the archive: shelves are wall rectangles, everything else is the layout. */
export const LEVELS = [
  {
    name: 'The Reading Room',
    hint: 'Slip past the wardens. Take both ledgers, then reach the green door.',
    shelves: [
      { x: 6, y: 5, w: 7, h: 1 },
      { x: 18, y: 5, w: 7, h: 1 },
      { x: 15, y: 8, w: 1, h: 5 },
      { x: 6, y: 14, w: 7, h: 1 },
      { x: 22, y: 14, w: 7, h: 1 },
      { x: 30, y: 8, w: 1, h: 5 },
      { x: 10, y: 9, w: 1, h: 3 },
      { x: 26, y: 9, w: 1, h: 3 },
    ],
    player: { x: 2, y: 17 },
    exit: { x: 33, y: 2 },
    ledgers: [
      { x: 9, y: 2 },
      { x: 27, y: 17 },
    ],
    guards: [
      {
        path: [
          { x: 8, y: 2 },
          { x: 20, y: 2 },
          { x: 20, y: 8 },
          { x: 8, y: 8 },
        ],
      },
      {
        path: [
          { x: 14, y: 16 },
          { x: 30, y: 16 },
          { x: 30, y: 11 },
          { x: 14, y: 11 },
        ],
      },
    ],
  },
  {
    name: 'The Vault Wing',
    hint: 'Three wardens now, and the shelves are tighter. Use the coin to pull one away.',
    shelves: [
      { x: 5, y: 4, w: 6, h: 1 },
      { x: 16, y: 4, w: 6, h: 1 },
      { x: 26, y: 4, w: 5, h: 1 },
      { x: 9, y: 8, w: 1, h: 5 },
      { x: 18, y: 8, w: 1, h: 5 },
      { x: 27, y: 8, w: 1, h: 5 },
      { x: 5, y: 15, w: 6, h: 1 },
      { x: 16, y: 15, w: 6, h: 1 },
      { x: 26, y: 15, w: 5, h: 1 },
      { x: 13, y: 9, w: 4, h: 1 },
      { x: 22, y: 11, w: 4, h: 1 },
    ],
    player: { x: 2, y: 17 },
    exit: { x: 33, y: 2 },
    ledgers: [
      { x: 8, y: 2 },
      { x: 17, y: 10 },
      { x: 31, y: 17 },
    ],
    guards: [
      {
        path: [
          { x: 7, y: 6 },
          { x: 22, y: 6 },
          { x: 22, y: 2 },
          { x: 7, y: 2 },
        ],
      },
      {
        path: [
          { x: 13, y: 13 },
          { x: 29, y: 13 },
          { x: 29, y: 17 },
          { x: 13, y: 17 },
        ],
      },
      {
        path: [
          { x: 31, y: 6 },
          { x: 31, y: 13 },
          { x: 24, y: 13 },
          { x: 24, y: 6 },
        ],
      },
    ],
  },
  {
    name: 'The Sealed Archive',
    hint: 'Four wardens, long sightlines. Patience wins: wait for the cone to turn.',
    shelves: [
      { x: 4, y: 3, w: 5, h: 1 },
      { x: 13, y: 3, w: 5, h: 1 },
      { x: 22, y: 3, w: 5, h: 1 },
      { x: 30, y: 3, w: 3, h: 1 },
      { x: 7, y: 7, w: 1, h: 6 },
      { x: 14, y: 7, w: 1, h: 6 },
      { x: 21, y: 7, w: 1, h: 6 },
      { x: 28, y: 7, w: 1, h: 6 },
      { x: 4, y: 16, w: 5, h: 1 },
      { x: 13, y: 16, w: 5, h: 1 },
      { x: 22, y: 16, w: 5, h: 1 },
      { x: 30, y: 16, w: 3, h: 1 },
      { x: 10, y: 10, w: 3, h: 1 },
      { x: 24, y: 10, w: 3, h: 1 },
    ],
    player: { x: 2, y: 17 },
    exit: { x: 33, y: 2 },
    ledgers: [
      { x: 11, y: 2 },
      { x: 17, y: 13 },
      { x: 31, y: 10 },
    ],
    guards: [
      {
        path: [
          { x: 6, y: 5 },
          { x: 18, y: 5 },
          { x: 18, y: 2 },
          { x: 6, y: 2 },
        ],
      },
      {
        path: [
          { x: 20, y: 5 },
          { x: 32, y: 5 },
          { x: 32, y: 9 },
          { x: 20, y: 9 },
        ],
      },
      {
        path: [
          { x: 10, y: 14 },
          { x: 25, y: 14 },
          { x: 25, y: 18 },
          { x: 10, y: 18 },
        ],
      },
      {
        path: [
          { x: 30, y: 11 },
          { x: 30, y: 17 },
          { x: 33, y: 17 },
          { x: 33, y: 11 },
        ],
      },
    ],
  },
];
