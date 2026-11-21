// The renderer: everything the eye sees.
// One clear job: paint. It draws the floor, the shelves, the exit, the ledgers, the wardens
// with their wall-respecting vision cones, the thief, the light, the HUD and the screens.
// The world never draws itself; this file is the only one that touches the canvas.

import { TILE, COLS, ROWS, WORLD_W, WORLD_H, GUARD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_LEVEL_CLEAR = 'levelClear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CANVAS_W = 1280;
const CANVAS_H = 720;
const WORLD_X = 64;
const WORLD_Y = 56;

const FLOOR_A = '#202939';
const FLOOR_B = '#1b2334';
const SHELF_WOOD = '#3a2a1a';
const SHELF_EDGE = '#5a4126';
const BOOK_COLORS = ['#7a4a2b', '#4a6a8a', '#6a4a7a', '#8a6a3a', '#3a6a4a', '#8a3a3a'];
const EXIT_GLOW = '#39d98a';
const LEDGER_GOLD = '#f2c14e';
const CONE_CALM = 'rgba(242, 193, 78, 0.20)';
const CONE_SUSPECT = 'rgba(242, 150, 60, 0.30)';
const CONE_ALARM = 'rgba(224, 62, 52, 0.38)';
const PLAYER_CLOAK = '#2f8f7a';
const PLAYER_HOOD = '#bfe8d8';

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/** The vision cone as a polygon whose rays stop at walls. */
function visionPolygon(world, guard) {
  const rays = 26;
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= rays; i += 1) {
    const a = guard.dir - GUARD.sightHalfAngle + (2 * GUARD.sightHalfAngle * i) / rays;
    let dist = GUARD.sightRange;
    for (let d = 8; d <= GUARD.sightRange; d += 8) {
      const px = guard.x + Math.cos(a) * d;
      const py = guard.y + Math.sin(a) * d;
      if (world.isWallTile(Math.floor(px / TILE), Math.floor(py / TILE))) {
        dist = d;
        break;
      }
    }
    points.push({ x: guard.x + Math.cos(a) * dist, y: guard.y + Math.sin(a) * dist });
  }
  return points;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  function fitCanvas() {
    const scale = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H);
    canvas.style.width = `${Math.floor(CANVAS_W * scale)}px`;
    canvas.style.height = `${Math.floor(CANVAS_H * scale)}px`;
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  function drawFloor(state) {
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        ctx.fillStyle = (tx + ty) % 2 === 0 ? FLOOR_A : FLOOR_B;
        ctx.fillRect(WORLD_X + tx * TILE, WORLD_Y + ty * TILE, TILE, TILE);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let tx = 0; tx <= COLS; tx += 1) {
      ctx.beginPath();
      ctx.moveTo(WORLD_X + tx * TILE, WORLD_Y);
      ctx.lineTo(WORLD_X + tx * TILE, WORLD_Y + WORLD_H);
      ctx.stroke();
    }
    for (let ty = 0; ty <= ROWS; ty += 1) {
      ctx.beginPath();
      ctx.moveTo(WORLD_X, WORLD_Y + ty * TILE);
      ctx.lineTo(WORLD_X + WORLD_W, WORLD_Y + ty * TILE);
      ctx.stroke();
    }
  }

  function drawShelf(shelf) {
    const x = WORLD_X + shelf.x * TILE;
    const y = WORLD_Y + shelf.y * TILE;
    const w = shelf.w * TILE;
    const h = shelf.h * TILE;
    ctx.fillStyle = SHELF_WOOD;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = SHELF_EDGE;
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x, y + h - 3, w, 3);
    // Book spines along the shelf, so it reads as a bookcase at a glance.
    const horizontal = shelf.w >= shelf.h;
    const length = horizontal ? w : h;
    const count = Math.floor(length / 9);
    for (let i = 0; i < count; i += 1) {
      ctx.fillStyle = BOOK_COLORS[(shelf.x + shelf.y + i) % BOOK_COLORS.length];
      if (horizontal) ctx.fillRect(x + 3 + i * 9, y + 5, 6, h - 10);
      else ctx.fillRect(x + 5, y + 3 + i * 9, w - 10, 6);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function drawExit(state) {
    const x = WORLD_X + state.exit.x;
    const y = WORLD_Y + state.exit.y;
    const pulse = 0.5 + 0.5 * Math.sin(state.ticks / 28);
    const allTaken = state.ledgers.every((ledger) => ledger.taken);
    const color = allTaken ? EXIT_GLOW : '#5a7a6a';
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.35 * pulse;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#0e1a14';
    ctx.fillRect(x - 13, y - 13, 26, 26);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 13, y - 13, 26, 26);
    ctx.fillStyle = color;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', x, y + 1);
    if (!allTaken) {
      ctx.fillStyle = '#c8d4cc';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('locked', x, y + 30);
    }
  }

  function drawLedger(ledger, ticks) {
    const x = WORLD_X + ledger.x;
    const y = WORLD_Y + ledger.y;
    const bob = Math.sin(ticks / 22 + ledger.x) * 2;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(ticks / 20);
    ctx.fillStyle = LEDGER_GOLD;
    ctx.beginPath();
    ctx.arc(x, y + bob, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = LEDGER_GOLD;
    ctx.fillRect(x - 8, y - 11 + bob, 16, 22);
    ctx.fillStyle = '#7a5a1a';
    ctx.fillRect(x - 8, y - 11 + bob, 3, 22);
    ctx.fillStyle = '#fff2c8';
    ctx.fillRect(x - 2, y - 6 + bob, 7, 3);
    ctx.fillRect(x - 2, y - 1 + bob, 7, 3);
    ctx.fillRect(x - 2, y + 4 + bob, 7, 3);
  }

  function drawCoin(coin) {
    const x = WORLD_X + coin.x;
    const y = WORLD_Y + coin.y;
    const frac = clamp01(coin.ttl / 2.5);
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.45 * frac;
    ctx.strokeStyle = LEDGER_GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 10 + (1 - frac) * 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = LEDGER_GOLD;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGuard(world, guard) {
    const x = WORLD_X + guard.x;
    const y = WORLD_Y + guard.y;
    const chasing = guard.mode === 'chase';
    const suspicious = guard.detection > 25;
    const coneColor = chasing ? CONE_ALARM : suspicious ? CONE_SUSPECT : CONE_CALM;
    const poly = visionPolygon(world, guard);
    ctx.fillStyle = coneColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (const p of poly) ctx.lineTo(WORLD_X + p.x, WORLD_Y + p.y);
    ctx.closePath();
    ctx.fill();
    // Lantern glow at the guard.
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Body: a warden in a dark coat with a brass lantern.
    ctx.fillStyle = chasing ? '#7a2a22' : '#2e3a55';
    ctx.beginPath();
    ctx.arc(x, y, guard.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d8c08a';
    ctx.lineWidth = 2;
    ctx.stroke();
    const fx = x + Math.cos(guard.dir) * 9;
    const fy = y + Math.sin(guard.dir) * 9;
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.arc(fx, fy, 4, 0, Math.PI * 2);
    ctx.fill();
    // Detection: a "?" while suspicious, a "!" while chasing, a thin bar while rising.
    if (guard.detection > 2 && !chasing) {
      const w = 26;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - w / 2, y - 30, w, 5);
      ctx.fillStyle = guard.detection > 60 ? '#e07a3a' : '#f2c14e';
      ctx.fillRect(x - w / 2, y - 30, w * clamp01(guard.detection / 100), 5);
    }
    if (chasing || suspicious) {
      ctx.fillStyle = chasing ? '#ff5a4a' : '#f2c14e';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chasing ? '!' : '?', x, y - 26);
    }
  }

  function drawPlayer(world, player) {
    const x = WORLD_X + player.x;
    const y = WORLD_Y + player.y;
    // A soft pool of light around the thief: the safe ground.
    const glow = ctx.createRadialGradient(x, y, 6, x, y, 74);
    glow.addColorStop(0, 'rgba(120, 220, 190, 0.14)');
    glow.addColorStop(1, 'rgba(120, 220, 190, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 74, 0, Math.PI * 2);
    ctx.fill();
    // Footstep ripples when running loud.
    if (player.moving && !player.sneaking) {
      const phase = (world.state.ticks % 36) / 36;
      ctx.save();
      ctx.globalAlpha = 0.35 * (1 - phase);
      ctx.strokeStyle = '#9fd8c8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 14 + phase * 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Cloak, hood, and the direction the thief faces.
    ctx.fillStyle = PLAYER_CLOAK;
    ctx.beginPath();
    ctx.arc(x, y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e2a24';
    ctx.lineWidth = 2;
    ctx.stroke();
    const hx = x + player.dirX * 5;
    const hy = y + player.dirY * 5;
    ctx.fillStyle = PLAYER_HOOD;
    ctx.beginPath();
    ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
    ctx.fill();
    if (player.sneaking) {
      ctx.fillStyle = '#bfe8d8';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('sneaking', x, y + 24);
    }
  }

  function drawWorld(world) {
    const state = world.state;
    drawFloor(state);
    drawExit(state);
    for (const ledger of state.ledgers) {
      if (!ledger.taken) drawLedger(ledger, state.ticks);
    }
    for (const coin of state.coins) drawCoin(coin);
    for (const shelf of state.level.shelves) drawShelf(shelf);
    for (const guard of state.guards) drawGuard(world, guard);
    drawPlayer(world, state.player);
    // A gentle vignette: the archive is dark at its edges.
    const vg = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.36,
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.78,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#3a4a66';
    ctx.lineWidth = 2;
    ctx.strokeRect(WORLD_X - 1, WORLD_Y - 1, WORLD_W + 2, WORLD_H + 2);
  }

  function drawHud(world, best) {
    const state = world.state;
    const taken = state.ledgers.filter((l) => l.taken).length;
    const total = state.ledgers.length;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d8e2f2';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Floor ${state.levelIndex + 1} — ${state.level.name}`, 24, 24);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#9fb0cc';
    ctx.fillText(state.level.hint, 24, 46);
    ctx.textAlign = 'center';
    ctx.fillStyle = LEDGER_GOLD;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`Ledgers ${taken}/${total}`, CANVAS_W / 2, 24);
    ctx.fillStyle = '#d8e2f2';
    ctx.font = '14px system-ui, sans-serif';
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60).toString().padStart(2, '0');
    ctx.fillText(`Lives ${'♥'.repeat(Math.max(0, state.lives))}${'·'.repeat(Math.max(0, 3 - state.lives))}   Coins ${state.player.coins}   ${mins}:${secs}`, CANVAS_W / 2, 46);
    // Heat: how close the wardens are to raising the alarm.
    const heat = state.heat;
    ctx.textAlign = 'right';
    ctx.fillStyle = heat > 60 ? '#ff7a6a' : heat > 25 ? '#f2c14e' : '#9fd8c8';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(heat > 60 ? 'SEEN — break line of sight!' : heat > 25 ? 'Suspicious…' : 'Unseen', CANVAS_W - 24, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(CANVAS_W - 184, 36, 160, 7);
    ctx.fillStyle = heat > 60 ? '#e03e34' : heat > 25 ? '#f2a13c' : '#39d98a';
    ctx.fillRect(CANVAS_W - 184, 36, 160 * clamp01(heat / 100), 7);
    ctx.fillStyle = '#9fb0cc';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASD / arrows move · Shift sneak · F throw a coin · P pause · M mute', CANVAS_W / 2, CANVAS_H - 12);
    if (best) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#7a8aa8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(best, CANVAS_W - 24, CANVAS_H - 12);
    }
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 12, 22, 0.72)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || '#f2e8d8';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2 - 66);
    ctx.fillStyle = '#d8e2f2';
    ctx.font = '20px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, CANVAS_W / 2, CANVAS_H / 2 - 8 + i * 32);
    });
  }

  return {
    draw(world, screen, best) {
      const state = world.state;
      ctx.fillStyle = '#0b0f18';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawWorld(world);
      if (screen === SCREEN_PLAY) {
        drawHud(world, best);
        return;
      }
      if (screen === SCREEN_TITLE) {
        drawHud(world, best);
        overlay(
          'THE SILENT STACKS',
          [
            'A thief in the grand archive, after dark.',
            'Take every ledger. Reach the green door unseen.',
            '',
            'Press Space or click to start',
          ],
          '#f2c14e',
        );
        return;
      }
      if (screen === SCREEN_PAUSED) {
        drawHud(world, best);
        overlay('PAUSED', ['Press P or Space to keep sneaking.'], '#d8e2f2');
        return;
      }
      if (screen === SCREEN_CAUGHT) {
        drawHud(world, best);
        overlay(
          'SPOTTED!',
          state.lives > 0
            ? [`A warden caught you. ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.`, 'Press Space to slip back to the door.']
            : ['The wardens have you.', 'Press Space to try the floor again.'],
          '#ff7a6a',
        );
        return;
      }
      if (screen === SCREEN_LEVEL_CLEAR) {
        drawHud(world, best);
        overlay(
          'FLOOR CLEARED',
          ['Every ledger is yours. The next floor waits.', 'Press Space to go deeper.'],
          '#39d98a',
        );
        return;
      }
      if (screen === SCREEN_OVER) {
        overlay('CAUGHT IN THE DARK', ['The archive keeps its ledgers.', 'Press Space to try again.'], '#ff7a6a');
        return;
      }
      if (screen === SCREEN_WIN) {
        const mins = Math.floor(state.time / 60);
        const secs = Math.floor(state.time % 60).toString().padStart(2, '0');
        overlay(
          'THE ARCHIVE IS YOURS',
          [`Every ledger, every floor — in ${mins}:${secs}, with ${state.alarms} ${state.alarms === 1 ? 'alarm' : 'alarms'}.`, 'Press Space to steal it all again.'],
          '#39d98a',
        );
      }
    },
  };
}
