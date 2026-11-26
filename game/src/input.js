// Keyboard + mouse input: arrows pitch and bank, W/S throttle, Space drops water,
// P pauses, M toggles sound, R restarts. Mouse drag on the canvas also steers.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    pitch: 0, roll: 0, throttleDelta: 0, throttleSet: null, drop: false,
    pausePressed: false, restartPressed: false, mutePressed: false,
    anyKey: false,
  };
  let mouseDown = false;
  let mouseX = 0;

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }
  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    keys.add(k);
    input.anyKey = true;
    if (k === 'p') input.pausePressed = true;
    if (k === 'r') input.restartPressed = true;
    if (k === 'm') input.mutePressed = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  canvas.addEventListener('mousedown', (e) => { mouseDown = true; mouseX = e.clientX; });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    mouseX = e.clientX;
  });

  // Poll once per frame: turn held keys into a control frame.
  input.poll = () => {
    const up = keys.has('ArrowUp');
    const down = keys.has('ArrowDown');
    const left = keys.has('ArrowLeft');
    const right = keys.has('ArrowRight');
    input.pitch = (up ? 1 : 0) + (down ? -1 : 0);
    input.roll = (left ? -1 : 0) + (right ? 1 : 0);
    if (mouseDown) input.roll = Math.max(-1, Math.min(1, (mouseX / window.innerWidth - 0.5) * 2));
    input.throttleDelta = (keys.has('w') ? 1 : 0) + (keys.has('s') ? -1 : 0);
    input.drop = keys.has(' ');
    input.throttleSet = null;
    return input;
  };
  // Consume the edge-triggered presses so one keypress acts once.
  input.consumeEdges = () => {
    const edges = {
      pause: input.pausePressed, restart: input.restartPressed, mute: input.mutePressed,
    };
    input.pausePressed = false;
    input.restartPressed = false;
    input.mutePressed = false;
    return edges;
  };
  return input;
}
