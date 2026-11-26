// Keyboard and mouse input. The plane answers to arrows or WASD for pitch
// and bank, W/S (or Shift/Ctrl) for throttle, and the mouse: steer toward
// the cursor, wheel for throttle, click to confirm. Every action the menus
// need is reported once, as a bitmask, so holding a key never double-fires.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_MISSION_1 = 16;
export const ACTION_MISSION_2 = 32;
export const ACTION_MISSION_3 = 64;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  p: ACTION_PAUSE,
  P: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  m: ACTION_MUTE,
  M: ACTION_MUTE,
  r: ACTION_RESTART,
  R: ACTION_RESTART,
  1: ACTION_MISSION_1,
  2: ACTION_MISSION_2,
  3: ACTION_MISSION_3,
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, active: false, inside: false };
  let wheelDelta = 0;
  let clicked = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.key);
    pressed.add(event.key);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.key);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) / Math.max(1, rect.width);
    mouse.y = (event.clientY - rect.top) / Math.max(1, rect.height);
    mouse.active = true;
    mouse.inside = true;
  }

  function onMouseLeave() {
    mouse.inside = false;
  }

  function onMouseDown(event) {
    mouse.x = (event.clientX - canvas.getBoundingClientRect().left) / Math.max(1, canvas.width);
    mouse.active = true;
    clicked = true;
    event.preventDefault();
  }

  function onWheel(event) {
    wheelDelta += event.deltaY;
    event.preventDefault();
  }

  function onBlur() {
    keys.clear();
    mouse.active = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // Pitch and bank the pilot is asking for this frame, each in [-1, 1].
  // Mouse steering blends in only while the cursor is inside the canvas.
  function control() {
    let pitch = 0;
    let roll = 0;
    if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) pitch += 1;
    if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) pitch -= 1;
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) roll += 1;
    if (mouse.active && mouse.inside) {
      const mx = (mouse.x - 0.5) * 2;
      const my = (mouse.y - 0.5) * 2;
      roll += Math.max(-1, Math.min(1, mx * 1.4));
      pitch += Math.max(-1, Math.min(1, -my * 1.2));
    }
    let throttle = 0;
    if (keys.has('Shift')) throttle += 1;
    if (keys.has('Control')) throttle -= 1;
    if (wheelDelta !== 0) {
      throttle += Math.max(-1, Math.min(1, -wheelDelta / 240));
      wheelDelta = 0;
    }
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      throttle,
    };
  }

  // One-shot menu actions since the last call; keys are consumed here.
  function takeActions() {
    let actions = 0;
    for (const key of pressed) {
      actions |= KEY_ACTIONS[key] ?? 0;
    }
    pressed.clear();
    if (clicked) {
      actions |= ACTION_CONFIRM;
      clicked = false;
    }
    return actions;
  }

  // A scripted driver (self-test and screenshot staging) can push keys.
  function inject(key, down) {
    if (down) {
      keys.add(key);
      pressed.add(key);
    } else {
      keys.delete(key);
    }
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseleave', onMouseLeave);
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('wheel', onWheel);
  }

  return { control, takeActions, inject, destroy, mouse, keys };
}
