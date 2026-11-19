// Keyboard and mouse input. Keys are tracked by code so layouts do not
// matter; mouse movement steers the on-foot aim. Actions are edge-triggered
// and consumed once per frame by the game loop.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_RELOAD = 8;
export const ACTION_RADIO = 16;
export const ACTION_MISSION = 32;
export const ACTION_CAMERA = 64;
export const ACTION_LIGHTS = 128;
export const ACTION_FIRE = 256;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let locked = false;
  let aimDX = 0;
  let aimDY = 0;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') actions |= ACTION_CONFIRM;
    if (e.code === 'Escape' || e.code === 'KeyP') actions |= ACTION_PAUSE;
    if (e.code === 'KeyE') actions |= ACTION_ENTER;
    if (e.code === 'KeyR') actions |= ACTION_RELOAD;
    if (e.code === 'KeyQ') actions |= ACTION_RADIO;
    if (e.code === 'KeyM') actions |= ACTION_MISSION;
    if (e.code === 'KeyC') actions |= ACTION_CAMERA;
    if (e.code === 'KeyH') actions |= ACTION_LIGHTS;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (locked && document.pointerLockElement === canvas) {
      aimDX += e.movementX;
      aimDY += e.movementY;
    }
  }
  function onMouseDown(e) {
    mouseDown = true;
    if (e.button === 0) actions |= ACTION_FIRE;
  }
  function onMouseUp() { mouseDown = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    keys,
    takeActions() { const a = actions; actions = 0; return a; },
    takeAim() { const d = { x: aimDX, y: aimDY }; aimDX = 0; aimDY = 0; return d; },
    get mouseDown() { return mouseDown; },
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    axis() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      return { x, y };
    },
    get throttle() { return keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0; },
    get brake() { return keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0; },
    get handbrake() { return keys.has('Space'); },
    get sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    lockPointer() {
      try { canvas.requestPointerLock(); locked = true; } catch { /* pointer lock is optional */ }
    },
    unlockPointer() { try { document.exitPointerLock(); } catch { /* already unlocked */ } locked = false; },
  };
}
