// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there.
// The game moves between screens: title, play, paused, caught, level clear, game over, win.
//
// ?seed=N fixes the run. ?shot=start|play|alarm|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_LEVEL_CLEAR, EVENT_GAME_WON, EVENT_PICKUP, EVENT_ALARM, EVENT_THROW } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_THROW, ACTION_MUTE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_TITLE,
  SCREEN_PLAY,
  SCREEN_PAUSED,
  SCREEN_CAUGHT,
  SCREEN_LEVEL_CLEAR,
  SCREEN_OVER,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
window.__silentStacksErrors = [];
window.addEventListener('error', (event) => {
  window.__silentStacksErrors.push(String(event.message || event.error));
});

function readBest() {
  try {
    return window.localStorage.getItem(BEST_KEY) || '';
  } catch {
    return '';
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, value);
  } catch {
    // Storage can be off (private windows): the best run then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, readBest());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      window.__silentStacks = {
        phase: scene.screen,
        heat: world.state.heat,
        ledgers: world.state.player.ledgers,
        errors: window.__silentStacksErrors,
      };
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let stepCount = 0;
  let throwQueued = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.loadLevel(0);
    world.state.lives = 3;
    world.state.time = 0;
    world.state.alarms = 0;
    world.state.phase = 'play';
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing floor 1, ${world.state.level.name}.`);
  }

  function endGame(won) {
    if (won) {
      screen = SCREEN_WIN;
      const mins = Math.floor(world.state.time / 60);
      const secs = Math.floor(world.state.time % 60).toString().padStart(2, '0');
      const record = `Best clear: ${mins}:${secs}, ${world.state.alarms} ${world.state.alarms === 1 ? 'alarm' : 'alarms'}`;
      best = record;
      saveBest(record);
      announce('You cleared the whole archive.');
    } else {
      screen = SCREEN_OVER;
      announce('Caught in the dark. Game over.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    // The throw is queued here and spent by the next step, so it fires once.
    if (actions & ACTION_THROW) throwQueued = true;
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
        startGame();
      } else if (screen === SCREEN_CAUGHT) {
        if (world.state.lives > 0) {
          world.state.phase = 'play';
          screen = SCREEN_PLAY;
          announce('Back to the door. Be quieter this time.');
        } else {
          startGame();
        }
      } else if (screen === SCREEN_LEVEL_CLEAR) {
        if (world.nextLevel()) {
          world.state.phase = 'play';
          screen = SCREEN_PLAY;
          announce(`Floor ${world.state.levelIndex + 1}, ${world.state.level.name}.`);
        }
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      audio.unlock();
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) return;
    const throwCoin = throwQueued;
    throwQueued = false;
    const events = world.step(STEP, input.direction(), input.sneaking(), throwCoin);
    stepCount += 1;
    // A soft tick every few steps while moving, so the thief hears their own feet.
    if (world.state.player.moving && stepCount % 18 === 0) {
      audio.footstep(world.state.player.sneaking);
    }
    if (events & EVENT_THROW) audio.coin();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_ALARM) {
      audio.alarm();
      announce('Alarm! A warden saw you — break line of sight!');
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      const survived = world.respawnAfterCaught();
      if (survived) {
        screen = SCREEN_CAUGHT;
        announce(`Caught. ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left.`);
      } else {
        endGame(false);
      }
      return;
    }
    if (events & EVENT_LEVEL_CLEAR) {
      audio.levelClear();
      if (events & EVENT_GAME_WON) {
        audio.win();
        endGame(true);
      } else {
        screen = SCREEN_LEVEL_CLEAR;
        announce(`Floor cleared. ${world.state.ledgers.length} ledgers safe.`);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting wardens close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Silent Stacks. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
