// Translate a short camera orbit as a free camera, independent of the villa.
(() => {
  const viewer = document.querySelector('#focusedModel');
  const dialog = document.querySelector('#modelDialog');
  const toggle = document.querySelector('#toggleDrone');
  const help = document.querySelector('#droneHelp');
  if (!viewer || !dialog || !toggle || !help) return;

  let active = false;
  let frame = 0;
  let previousTime = 0;
  let yaw = 0;
  let pitch = Math.PI / 2;
  let position = { x: 0, y: 0, z: 0 };
  let drag = null;
  const keys = new Set();
  const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE',
    'ShiftLeft', 'ShiftRight', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

  function render() {
    const sinPitch = Math.sin(pitch);
    viewer.setAttribute('camera-target', `${position.x - Math.sin(yaw) * sinPitch}m ${position.y - Math.cos(pitch)}m ${position.z - Math.cos(yaw) * sinPitch}m`);
    viewer.setAttribute('camera-orbit', `${yaw}rad ${pitch}rad 1m`);
    viewer.jumpCameraToGoal();
  }

  function tick(time) {
    if (!active) return;
    const dt = Math.min((time - previousTime) / 1000 || 0, 0.05);
    previousTime = time;
    const axis = (positive, negative) => Number(keys.has(positive)) - Number(keys.has(negative));
    yaw += axis('ArrowLeft', 'ArrowRight') * dt * 1.2;
    pitch = Math.max(0.08, Math.min(Math.PI - 0.08,
      pitch + axis('ArrowDown', 'ArrowUp') * dt * 1.2));
    const forward = axis('KeyW', 'KeyS');
    const right = axis('KeyD', 'KeyA');
    const up = axis('KeyE', 'KeyQ');
    const length = Math.max(1, Math.hypot(forward, right, up));
    const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5 : 1.6) * dt / length;
    position.x += (-Math.sin(yaw) * Math.sin(pitch) * forward + Math.cos(yaw) * right) * speed;
    position.y += (-Math.cos(pitch) * forward + up) * speed;
    position.z += (-Math.cos(yaw) * Math.sin(pitch) * forward - Math.sin(yaw) * right) * speed;
    if (keys.size || drag) render();
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frame);
    keys.clear();
    drag = null;
    dialog.classList.remove('drone-active');
    help.hidden = true;
    toggle.textContent = 'Drone mode';
    toggle.setAttribute('aria-pressed', 'false');
    viewer.setAttribute('camera-controls', '');
  }

  function start() {
    if (!dialog.open || !viewer.loaded) return;
    const orbit = viewer.getCameraOrbit();
    const target = viewer.getCameraTarget();
    yaw = orbit.theta;
    pitch = orbit.phi;
    position = {
      x: target.x + orbit.radius * Math.sin(pitch) * Math.sin(yaw),
      y: target.y + orbit.radius * Math.cos(pitch),
      z: target.z + orbit.radius * Math.sin(pitch) * Math.cos(yaw),
    };
    active = true;
    keys.clear();
    viewer.removeAttribute('camera-controls');
    viewer.setAttribute('field-of-view', '65deg');
    document.querySelector('#roomInfo').hidden = true;
    dialog.classList.add('drone-active');
    help.hidden = false;
    toggle.textContent = 'Exit drone mode';
    toggle.setAttribute('aria-pressed', 'true');
    render();
    previousTime = performance.now();
    frame = requestAnimationFrame(tick);
  }

  toggle.addEventListener('click', () => active ? stop() : start());
  // A loading model cannot provide a valid starting camera yet.
  toggle.disabled = !viewer.loaded;
  viewer.addEventListener('load', () => { toggle.disabled = false; });
  dialog.addEventListener('close', stop);
  dialog.addEventListener('cancel', (event) => {
    if (active) { event.preventDefault(); stop(); }
  });
  window.addEventListener('blur', () => { keys.clear(); drag = null; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { keys.clear(); drag = null; }
  });
  document.addEventListener('keydown', (event) => {
    if (!active || !dialog.open || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (movement.has(event.code)) { event.preventDefault(); keys.add(event.code); }
  });
  document.addEventListener('keyup', (event) => { keys.delete(event.code); });
  viewer.addEventListener('pointerdown', (event) => {
    if (!active || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    viewer.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  viewer.addEventListener('pointermove', (event) => {
    if (!active || drag?.id !== event.pointerId) return;
    yaw -= (event.clientX - drag.x) * 0.004;
    pitch = Math.max(0.08, Math.min(Math.PI - 0.08, pitch - (event.clientY - drag.y) * 0.004));
    drag.x = event.clientX;
    drag.y = event.clientY;
    render();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => {
    viewer.addEventListener(name, () => { drag = null; });
  });
  document.querySelectorAll('[data-flight]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      if (!active) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      keys.add(button.dataset.flight);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => {
      button.addEventListener(name, () => keys.delete(button.dataset.flight));
    });
  });
  window.portfolioDrone = { stop };
})();
