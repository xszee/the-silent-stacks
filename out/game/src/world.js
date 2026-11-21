// The world: one archive floor, its walls, its wardens and its thief.
// One clear job: the rules. It owns the grid, the collision, the line of sight, the guards'
// patrol / investigate / chase / search mind, the player's noise and coins, the ledgers and
// the exit, and it reports what happened as event flags the loop reads.

import {
  TILE,
  COLS,
  ROWS,
  PLAYER,
  GUARD,
  COIN_NOISE_TIME,
  CATCH_DISTANCE,
  LEVELS,
} from './config.js';

/** The player was caught by a warden. */
export const EVENT_CAUGHT = 1;
/** The floor is cleared: every ledger taken and the exit reached. */
export const EVENT_LEVEL_CLEAR = 2;
/** The whole archive is cleared: the last floor's exit reached. */
export const EVENT_GAME_WON = 4;
/** A ledger was picked up. */
export const EVENT_PICKUP = 8;
/** A guard's detection just filled: the alarm went up. */
export const EVENT_ALARM = 16;
/** A coin was thrown. */
export const EVENT_THROW = 32;

const TAU = Math.PI * 2;

function tileIndex(tx, ty) {
  return ty * COLS + tx;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function tileCentre(tile) {
  return { x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE };
}

export function createWorld(random) {
  const state = {
    random,
    levelIndex: 0,
    level: LEVELS[0],
    grid: new Uint8Array(COLS * ROWS),
    player: null,
    guards: [],
    ledgers: [],
    coins: [],
    exit: null,
    lives: 3,
    time: 0,
    alarms: 0,
    phase: 'play',
    /** The loudest guard detection right now, 0..100, for the HUD. */
    heat: 0,
    /** The last noise position a guard is walking to, for the renderer's ripple. */
    lastNoise: null,
    /** Ticks since the level began; the autopilot and the renderer read it. */
    ticks: 0,
  };

  function buildGrid(level) {
    state.grid.fill(0);
    for (let x = 0; x < COLS; x += 1) {
      state.grid[tileIndex(x, 0)] = 1;
      state.grid[tileIndex(x, ROWS - 1)] = 1;
    }
    for (let y = 0; y < ROWS; y += 1) {
      state.grid[tileIndex(0, y)] = 1;
      state.grid[tileIndex(COLS - 1, y)] = 1;
    }
    for (const shelf of level.shelves) {
      for (let y = shelf.y; y < shelf.y + shelf.h; y += 1) {
        for (let x = shelf.x; x < shelf.x + shelf.w; x += 1) {
          state.grid[tileIndex(x, y)] = 1;
        }
      }
    }
  }

  function isWallTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    return state.grid[tileIndex(tx, ty)] === 1;
  }

  /** True when a straight line between two points crosses no wall tile. */
  function hasLineOfSight(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 6));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;
      if (isWallTile(Math.floor(px / TILE), Math.floor(py / TILE))) return false;
    }
    return true;
  }

  /** Slide a circle along x, then along y, stopping at walls. */
  function moveCircle(body, dx, dy) {
    const r = body.radius;
    let nx = body.x + dx;
    const top = Math.floor((body.y - r) / TILE);
    const bottom = Math.floor((body.y + r) / TILE);
    if (dx > 0) {
      const edge = Math.floor((nx + r) / TILE);
      for (let ty = top; ty <= bottom; ty += 1) {
        if (isWallTile(edge, ty)) { nx = edge * TILE - r - 0.01; break; }
      }
    } else if (dx < 0) {
      const edge = Math.floor((nx - r) / TILE);
      for (let ty = top; ty <= bottom; ty += 1) {
        if (isWallTile(edge, ty)) { nx = (edge + 1) * TILE + r + 0.01; break; }
      }
    }
    body.x = nx;
    let ny = body.y + dy;
    const left = Math.floor((body.x - r) / TILE);
    const right = Math.floor((body.x + r) / TILE);
    if (dy > 0) {
      const edge = Math.floor((ny + r) / TILE);
      for (let tx = left; tx <= right; tx += 1) {
        if (isWallTile(tx, edge)) { ny = edge * TILE - r - 0.01; break; }
      }
    } else if (dy < 0) {
      const edge = Math.floor((ny - r) / TILE);
      for (let tx = left; tx <= right; tx += 1) {
        if (isWallTile(tx, edge)) { ny = (edge + 1) * TILE + r + 0.01; break; }
      }
    }
    body.y = ny;
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.coins = [];
    state.lastNoise = null;
    state.heat = 0;
    buildGrid(level);
    const start = tileCentre(level.player);
    state.player = {
      x: start.x,
      y: start.y,
      radius: PLAYER.radius,
      dirX: 0,
      dirY: -1,
      sneaking: false,
      moving: false,
      noise: 0,
      coins: PLAYER.coins,
      ledgers: 0,
    };
    state.exit = tileCentre(level.exit);
    state.ledgers = level.ledgers.map((tile) => ({ ...tileCentre(tile), taken: false }));
    state.guards = level.guards.map((def) => {
      const first = tileCentre(def.path[0]);
      return {
        x: first.x,
        y: first.y,
        radius: GUARD.radius,
        dir: 0,
        path: def.path.map(tileCentre),
        waypoint: 1 % def.path.length,
        pause: 0,
        mode: 'patrol',
        detection: 0,
        lastSeenX: first.x,
        lastSeenY: first.y,
        memory: 0,
        search: 0,
        targetX: first.x,
        targetY: first.y,
        // A little per-guard jitter so two guards never march in lockstep.
        jitter: random.range(-0.25, 0.25),
      };
    });
  }

  function guardSeesPlayer(guard) {
    const dx = state.player.x - guard.x;
    const dy = state.player.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GUARD.sightRange) return 0;
    const toPlayer = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(toPlayer, guard.dir)) > GUARD.sightHalfAngle) return 0;
    if (!hasLineOfSight(guard.x, guard.y, state.player.x, state.player.y)) return 0;
    return dist;
  }

  function hearNoise(guard, x, y, radius) {
    const dist = Math.hypot(x - guard.x, y - guard.y);
    if (dist > radius) return false;
    if (hasLineOfSight(guard.x, guard.y, x, y)) return true;
    return dist < radius * 0.5;
  }

  function steerGuard(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return true;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;
    guard.dir = Math.atan2(vy, vx);
    moveCircle(guard, vx * dt, vy * dt);
    return Math.hypot(tx - guard.x, ty - guard.y) < 6;
  }

  function stepGuard(guard, dt, events) {
    const player = state.player;
    const seen = guardSeesPlayer(guard);

    if (seen > 0) {
      guard.lastSeenX = player.x;
      guard.lastSeenY = player.y;
      guard.memory = GUARD.chaseMemory;
      const close = seen < GUARD.sightRange * 0.45;
      let rate = close ? GUARD.detectRateClose : GUARD.detectRateFar;
      if (player.sneaking) rate *= GUARD.sneakDetectFactor;
      const was = guard.detection;
      guard.detection = Math.min(100, guard.detection + rate * dt);
      if (guard.detection >= 100 && was < 100) {
        guard.mode = 'chase';
        state.alarms += 1;
        events.value |= EVENT_ALARM;
      }
      if (guard.mode === 'patrol' || guard.mode === 'search') {
        // A guard that spots something turns to face it.
        guard.dir = Math.atan2(player.y - guard.y, player.x - guard.x);
      }
    } else {
      guard.detection = Math.max(0, guard.detection - GUARD.detectDecay * dt);
    }

    if (guard.mode === 'chase') {
      if (seen > 0) guard.memory = GUARD.chaseMemory;
      else guard.memory -= dt;
      const caught = Math.hypot(player.x - guard.x, player.y - guard.y) < CATCH_DISTANCE;
      if (caught) {
        events.value |= EVENT_CAUGHT;
        return;
      }
      if (guard.memory <= 0) {
        guard.mode = 'search';
        guard.search = GUARD.searchTime;
        guard.targetX = guard.lastSeenX;
        guard.targetY = guard.lastSeenY;
      } else {
        steerGuard(guard, player.x, player.y, GUARD.chaseSpeed, dt);
      }
      return;
    }

    if (guard.mode === 'search') {
      guard.search -= dt;
      const arrived = steerGuard(guard, guard.targetX, guard.targetY, GUARD.investigateSpeed, dt);
      if (arrived) guard.dir += dt * 1.5;
      if (guard.search <= 0) {
        guard.mode = 'patrol';
        guard.detection = 0;
      }
      return;
    }

    if (guard.mode === 'investigate') {
      const arrived = steerGuard(guard, guard.targetX, guard.targetY, GUARD.investigateSpeed, dt);
      if (arrived) {
        guard.dir += dt * 2.2;
        guard.pause -= dt;
        if (guard.pause <= 0) guard.mode = 'patrol';
      }
      return;
    }

    // Patrol: walk the waypoints, pausing at each.
    if (guard.pause > 0) {
      guard.pause -= dt;
      return;
    }
    const target = guard.path[guard.waypoint];
    if (steerGuard(guard, target.x, target.y, GUARD.patrolSpeed, dt)) {
      guard.waypoint = (guard.waypoint + 1) % guard.path.length;
      guard.pause = GUARD.pauseAtWaypoint + guard.jitter;
    }
  }

  function stepPlayer(dt, direction, sneaking, throwCoin) {
    const player = state.player;
    player.sneaking = sneaking;
    player.moving = direction.x !== 0 || direction.y !== 0;
    const speed = sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    if (player.moving) {
      player.dirX = direction.x;
      player.dirY = direction.y;
      moveCircle(player, direction.x * speed * dt, direction.y * speed * dt);
      player.noise = sneaking ? PLAYER.sneakNoiseRadius : PLAYER.noiseRadius;
    } else {
      player.noise = 0;
    }

    if (throwCoin && player.coins > 0) {
      player.coins -= 1;
      const tx = player.x + player.dirX * TILE * 3.2;
      const ty = player.y + player.dirY * TILE * 3.2;
      const cx = Math.max(TILE, Math.min((COLS - 1) * TILE, tx));
      const cy = Math.max(TILE, Math.min((ROWS - 1) * TILE, ty));
      state.coins.push({ x: cx, y: cy, ttl: COIN_NOISE_TIME });
      state.lastNoise = { x: cx, y: cy, ttl: COIN_NOISE_TIME };
      return EVENT_THROW;
    }
    return 0;
  }

  function stepCoins(dt) {
    for (let i = state.coins.length - 1; i >= 0; i -= 1) {
      state.coins[i].ttl -= dt;
      if (state.coins[i].ttl <= 0) state.coins.splice(i, 1);
    }
    if (state.lastNoise) {
      state.lastNoise.ttl -= dt;
      if (state.lastNoise.ttl <= 0) state.lastNoise = null;
    }
  }

  function stepNoise(dt) {
    // A ringing coin pulls every guard that can hear it.
    for (const coin of state.coins) {
      for (const guard of state.guards) {
        if (guard.mode === 'chase') continue;
        if (hearNoise(guard, coin.x, coin.y, PLAYER.noiseRadius)) {
          guard.mode = 'investigate';
          guard.targetX = coin.x;
          guard.targetY = coin.y;
          guard.pause = 1.6;
        }
      }
    }
    // Loud footsteps pull nearby guards the same way.
    const player = state.player;
    if (player.moving && !player.sneaking) {
      for (const guard of state.guards) {
        if (guard.mode === 'chase' || guard.mode === 'investigate') continue;
        if (hearNoise(guard, player.x, player.y, PLAYER.noiseRadius)) {
          guard.mode = 'investigate';
          guard.targetX = player.x;
          guard.targetY = player.y;
          guard.pause = 1.2;
        }
      }
    }
  }

  function stepPickups(events) {
    const player = state.player;
    for (const ledger of state.ledgers) {
      if (ledger.taken) continue;
      if (Math.hypot(ledger.x - player.x, ledger.y - player.y) < 24) {
        ledger.taken = true;
        player.ledgers += 1;
        events.value |= EVENT_PICKUP;
      }
    }
    const allTaken = state.ledgers.every((ledger) => ledger.taken);
    if (allTaken && Math.hypot(state.exit.x - player.x, state.exit.y - player.y) < 28) {
      events.value |= EVENT_LEVEL_CLEAR;
      if (state.levelIndex >= LEVELS.length - 1) events.value |= EVENT_GAME_WON;
    }
  }

  function respawnAfterCaught() {
    state.lives -= 1;
    if (state.lives <= 0) return false;
    const level = state.level;
    const start = tileCentre(level.player);
    state.player.x = start.x;
    state.player.y = start.y;
    state.player.dirX = 0;
    state.player.dirY = -1;
    state.coins = [];
    state.lastNoise = null;
    for (const guard of state.guards) {
      const first = guard.path[0];
      guard.x = first.x;
      guard.y = first.y;
      guard.waypoint = 1 % guard.path.length;
      guard.pause = 0;
      guard.mode = 'patrol';
      guard.detection = 0;
      guard.memory = 0;
      guard.search = 0;
    }
    return true;
  }

  loadLevel(0);

  return {
    state,
    isWallTile,
    hasLineOfSight,
    loadLevel,
    respawnAfterCaught,
    /** Advance the world one fixed step. `input` is {x, y}; returns event flags. */
    step(dt, input, sneaking, throwCoin) {
      const events = { value: 0 };
      if (state.phase !== 'play') return 0;
      state.time += dt;
      state.ticks += 1;
      events.value |= stepPlayer(dt, input, sneaking, throwCoin);
      stepCoins(dt);
      stepNoise(dt);
      for (const guard of state.guards) {
        stepGuard(guard, dt, events);
        if (events.value & EVENT_CAUGHT) break;
      }
      if (!(events.value & EVENT_CAUGHT)) stepPickups(events);
      let heat = 0;
      for (const guard of state.guards) heat = Math.max(heat, guard.detection);
      state.heat = heat;
      return events.value;
    },
    /** Move to the next floor; returns false when there is none. */
    nextLevel() {
      if (state.levelIndex >= LEVELS.length - 1) return false;
      loadLevel(state.levelIndex + 1);
      state.player.coins = PLAYER.coins;
      return true;
    },
    ledgersLeft() {
      return state.ledgers.filter((ledger) => !ledger.taken).length;
    },
  };
}
