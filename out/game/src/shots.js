// The screenshot scenes behind ?shot=start|play|alarm|end.
// Each one drives the real world forward — the wardens patrol, the thief moves, detection
// rises and falls by the real rules — and returns the screen to draw over it, so the frame
// is what a short game really looks like and the same seed always gives the same frame.
// The end scene sets the ledgers as taken (the thief's work, done) and walks the last step
// into the exit, so the level-clear overlay is the real one.

import { TILE, STEP } from './config.js';
import { EVENT_ALARM, EVENT_LEVEL_CLEAR } from './world.js';
import {
  SCREEN_TITLE,
  SCREEN_PLAY,
  SCREEN_LEVEL_CLEAR,
} from './render.js';

/** Tile centre, in world pixels. */
function tilePx(tile) {
  return { x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE };
}

/** Step the world while steering the thief along a list of tile waypoints in order. */
function drivePath(world, waypoints, sneaking, maxSecondsEach) {
  for (const tile of waypoints) {
    const target = tilePx(tile);
    const maxSteps = Math.floor(maxSecondsEach / STEP);
    for (let i = 0; i < maxSteps; i += 1) {
      const p = world.state.player;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 14) break;
      const dir = { x: dx / dist, y: dy / dist };
      const events = world.step(STEP, dir, sneaking, false);
      if (events & EVENT_LEVEL_CLEAR) return true;
    }
  }
  return false;
}

/** Step the world with no input for some seconds (the wardens keep patrolling). */
function idle(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, { x: 0, y: 0 }, false, false);
  }
}

export function stageShot(name, world) {
  world.loadLevel(0);

  if (name === 'play') {
    // Up the open left corridor, take the first ledger, then hold in the open near
    // the top patrol, sneaking, while a warden's cone sweeps across: the tense heart.
    drivePath(world, [{ x: 3, y: 10 }, { x: 3, y: 3 }, { x: 9, y: 2 }], false, 12);
    drivePath(world, [{ x: 12, y: 3 }], true, 8);
    idle(world, 2.5);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'alarm') {
    // Up the open left corridor and into the top patrol lane: a warden spots the thief,
    // the alarm rises, and the chase begins.
    drivePath(world, [{ x: 3, y: 10 }, { x: 3, y: 3 }, { x: 14, y: 2 }], false, 12);
    let alarmed = false;
    for (let i = 0; i < Math.floor(6 / STEP) && !alarmed; i += 1) {
      const events = world.step(STEP, { x: 0, y: 0 }, false, false);
      if (events & EVENT_ALARM) alarmed = true;
    }
    idle(world, 1.2);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'end') {
    // The thief's work is done: every ledger taken, one last step into the green door.
    for (const ledger of world.state.ledgers) ledger.taken = true;
    world.state.player.ledgers = world.state.ledgers.length;
    const exit = world.state.exit;
    world.state.player.x = exit.x - TILE * 1.6;
    world.state.player.y = exit.y;
    for (let i = 0; i < Math.floor(2 / STEP); i += 1) {
      const events = world.step(STEP, { x: 1, y: 0 }, false, false);
      if (events & EVENT_LEVEL_CLEAR) break;
    }
    return { screen: SCREEN_LEVEL_CLEAR };
  }

  // Start (and any other name): the wardens patrol for a while under the title.
  idle(world, 5);
  return { screen: SCREEN_TITLE };
}
