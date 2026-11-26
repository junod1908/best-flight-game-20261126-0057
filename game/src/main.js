// ASHWING — Wildfire Airtanker. Entry point: builds the world, runs the loop, and stages
// deterministic screenshot scenes (?shot=cover|drop|scoop|approach&seed=1).
import { createRandom } from './random.js';
import { WORLD, SHOT } from './config.js';
import { buildTerrain, groundHeight } from './terrain.js';
import { buildTanker, updateTankerVisual } from './tanker.js';
import { createFlight, updateFlight } from './flight.js';
import { createFire, buildFireVisuals, updateFire, douseAt, inSmoke } from './fire.js';
import { createWater, updateWater } from './water.js';
import { createHud, updateHud } from './hud.js';
import { createMissionState, updateMission, applyDamage, SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SCREEN_WIN } from './missions.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// Build one fresh world (scene, plane, fire, water, HUD, mission) for a seed.
function createGame(seedValue) {
  const THREE = window.THREE;
  const rng = createRandom(seedValue);
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb8c4);
  scene.fog = new THREE.Fog(0xd9b48a, 500, 2600);

  // Warm low sun over a teal valley: orange fire against teal sky.
  const sun = new THREE.DirectionalLight(0xffb36b, 1.7);
  sun.position.set(900, 420, -700);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbcd8d8, 0x6b5a44, 0.9);
  scene.add(hemi);

  buildTerrain(scene, rng);
  const plane = buildTanker();
  scene.add(plane);

  const fire = createFire(rng);
  buildFireVisuals(scene, fire);
  fire.douse = (x, z, r) => douseAt(fire, scene, x, z, r);
  fire.inSmoke = (x, y, z) => inSmoke(fire, x, y, z);
  const water = createWater(scene);

  const flight = createFlight();
  const mission = createMissionState();
  mission.banner = 'FIRE 1: PINE HOLLOW — SCOOP THE LAKE, THEN DROP';
  mission.flight = flight;
  mission.fire = fire;
  const hud = createHud();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 6000);
  camInit = false;

  // Park the mesh on the strip so the title screen already shows the aircraft.
  plane.position.set(flight.x, flight.y, flight.z);
  plane.rotation.order = 'YXZ';
  plane.rotation.y = flight.heading;

  const world = {
    renderer, scene, camera, plane, fire, water, flight, hud,
    state: mission,
    mission,
  };

  world.step = (dt, input) => {
    const st = world.state;
    if (st.screen !== SCREEN_PLAY) return;
    const result = updateFlight(flight, input, st.water, dt, fire);
    for (const ev of result.events) {
      if (ev === 'smoke') applyDamage(st, flight, 'smoke');
      if (ev === 'scrape') applyDamage(st, flight, 'scrape');
      if (ev === 'takeoff') st.banner = 'AIRBORNE — SCOOP WATER FROM THE LAKE';
      if (ev === 'landed-strip') st.banner = 'ON THE STRIP — REFUELLING';
    }
    const waterInfo = updateWater(water, scene, flight, st, input.drop, dt, fire);
    updateFire(fire, st.activeZoneIndex, dt);
    updateMission(st, flight, fire, waterInfo, dt);
    updateHud(hud, st);
    updateTankerVisual(plane, flight.throttle, dt, st.time);
    // Place the mesh where the flight model says it is.
    plane.position.set(flight.x, flight.y, flight.z);
    plane.rotation.set(0, 0, 0);
    plane.rotation.order = 'YXZ';
    plane.rotation.y = flight.heading;
    plane.rotation.x = -flight.pitch;
    plane.rotation.z = flight.roll;
    updateCamera(world, dt);
  };

  world.render = () => {
    renderer.render(scene, camera);
  };

  world.startPlay = () => {
    world.state.screen = SCREEN_PLAY;
    hideOverlay();
  };

  world.reset = (newSeed) => createGame(newSeed);
  return world;
}

const camPos = { x: 0, y: 0, z: 0 };
let camInit = false;

function updateCamera(world, dt) {
  const f = world.flight;
  const fx = Math.sin(f.heading);
  const fz = -Math.cos(f.heading);
  const tx = f.x - fx * 48;
  const ty = f.y + 13;
  const tz = f.z - fz * 48;
  if (!camInit) {
    camPos.x = tx; camPos.y = ty; camPos.z = tz;
    camInit = true;
  }
  const k = 1 - Math.exp(-dt * 3.5);
  camPos.x += (tx - camPos.x) * k;
  camPos.y += (ty - camPos.y) * k;
  camPos.z += (tz - camPos.z) * k;
  // Keep the camera out of the ground.
  const ground = groundHeight(camPos.x, camPos.z);
  if (camPos.y < ground + 4) camPos.y = ground + 4;
  world.camera.position.set(camPos.x, camPos.y, camPos.z);
  world.camera.lookAt(f.x + fx * 55, f.y + 1, f.z + fz * 55);
}

function showOverlay(html) {
  const overlay = document.getElementById('overlay');
  overlay.innerHTML = html;
  overlay.style.display = 'flex';
}
function hideOverlay() {
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'none';
  overlay.innerHTML = '';
}

function titleCard() {
  return `<div class="card"><h1>ASHWING</h1><h2>WILDFIRE AIRTANKER &mdash; Pine Hollow Valley</h2>
  <p>Three fires are spreading downwind across the valley. Take off from the dirt strip,
  skim the lake low and level to scoop a full tank, then drop it on the fire front.
  A full tank is heavy and thirsty &mdash; watch your fuel, mind the smoke, and land back
  on the strip to refuel. Contain all three fires to win.</p>
  <p class="keys">W/S throttle &middot; Arrow keys pitch &amp; bank &middot; SPACE drop water &middot; P pause &middot; M sound</p>
  <button id="fly-btn">FLY THE SORTIE</button></div>`;
}

function endCard(world) {
  const st = world.state;
  const win = st.screen === SCREEN_WIN;
  const stats = st.stats || { score: st.score, time: st.time, fuelLeft: 0, firesOut: 0, zones: 0 };
  const mins = Math.floor(stats.time / 60);
  const secs = Math.floor(stats.time % 60);
  return `<div class="card"><h1>${win ? 'FIRES CONTAINED' : 'SORTIE OVER'}</h1>
  <h2>${st.overReason}</h2>
  <p>Score <b>${stats.score}</b> &middot; Fires out <b>${stats.firesOut}</b> &middot; Zones contained
  <b>${stats.zones}/3</b> &middot; Time <b>${mins}:${String(secs).padStart(2, '0')}</b> &middot;
  Fuel left <b>${stats.fuelLeft}%</b></p>
  <button id="fly-btn">${win ? 'FLY AGAIN' : 'TRY AGAIN'}</button></div>`;
}

// Screenshot mode: stage the scene from the real rules, paint twice, signal readiness.
function runShot(name) {
  const world = createGame(SHOT.seed);
  world.state.screen = SCREEN_PLAY;
  hideOverlay();
  stageShot(name, world);
  const f = world.flight;
  console.log(`SHOT ${name}: x=${Math.round(f.x)} y=${Math.round(f.y)} z=${Math.round(f.z)} ` +
    `spd=${Math.round(f.speed)} water=${Math.round(world.state.water)} ` +
    `screen=${world.state.screen} crashed=${f.crashed} ${f.crashReason} ` +
    `time=${world.state.time.toFixed(1)} zones=${world.state.zonesContained}`);
  updateHud(world.hud, world.state);
  const plane = world.plane;
  plane.position.set(f.x, f.y, f.z);
  plane.rotation.order = 'YXZ';
  plane.rotation.y = f.heading;
  plane.rotation.x = -f.pitch;
  plane.rotation.z = f.roll;
  camInit = false;
  updateCamera(world, 1);
  world.render();
  requestAnimationFrame(() => {
    world.render();
    window.__shotReady = true;
  });
}

if (shot) {
  runShot(shot);
} else {
  let world = createGame(seed);
  const input = createInput(document.getElementById('game'));
  const audio = createAudio();
  showOverlay(titleCard());
  document.getElementById('fly-btn').addEventListener('click', () => {
    audio.ensure();
    world.startPlay();
  });
  window.addEventListener('resize', () => {
    world.renderer.setSize(window.innerWidth, window.innerHeight);
    world.camera.aspect = window.innerWidth / window.innerHeight;
    world.camera.updateProjectionMatrix();
  });
  let last = performance.now();
  let paused = false;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const frame = input.poll();
    const edges = input.consumeEdges();
    if (edges.mute) audio.toggleMute();
    if (edges.restart && world.state.screen !== SCREEN_TITLE) {
      window.location.reload();
    }
    if (edges.pause && world.state.screen === SCREEN_PLAY) {
      paused = !paused;
      world.state.banner = paused ? 'PAUSED — press P to resume' : 'ASHWING — WILDFIRE AIRTANKER';
    }
    if (world.state.screen === SCREEN_TITLE) {
      if (frame.anyKey) { audio.ensure(); world.startPlay(); }
      // Idle orbit behind the parked plane so the title reads as a game, not a blank page.
      camInit = false;
      updateCamera(world, dt);
      world.render();
      return;
    }
    if (paused) { world.render(); return; }
    if (world.state.screen === SCREEN_PLAY) {
      world.step(dt, frame);
      audio.update(world.flight.throttle, world.flight.speed);
      if (frame.drop && world.state.water > 0) audio.whoosh();
    }
    if ((world.state.screen === SCREEN_OVER || world.state.screen === SCREEN_WIN)
      && !document.getElementById('fly-btn')) {
      showOverlay(endCard(world));
      document.getElementById('fly-btn').addEventListener('click', () => {
        window.location.reload();
      });
    }
    world.render();
  }
  requestAnimationFrame(loop);
}
