// Keyboard and mouse input, read once a frame.
// WASD or arrows move; Shift sneaks; F throws a coin; Space / click confirms;
// P or Escape pauses; M mutes. Every action is a bit flag the loop takes once.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_THROW = 4;
export const ACTION_MUTE = 8;

const MOVE_KEYS = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyF' || event.code === 'KeyQ') {
      actions |= ACTION_THROW;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    }
    if (MOVE_KEYS[event.code]) event.preventDefault();
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseDown() {
    actions |= ACTION_CONFIRM;
  }

  function onBlur() {
    held.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('blur', onBlur);

  return {
    /** The movement direction this frame, as a unit-ish {x, y} (diagonals normalised). */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const move = MOVE_KEYS[code];
        if (!move) continue;
        x += move[0];
        y += move[1];
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** True while the sneak key is held. */
    sneaking() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** The action flags raised since the last take, cleared by taking them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
