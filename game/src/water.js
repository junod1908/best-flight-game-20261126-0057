// Water: the scoop spray over the lake, the wake, and the drop stream that falls from the
// belly tank to the fire. Particles are pooled meshes so the loop never allocates.
import { PLANE, WORLD } from './config.js';
import { groundHeight, isOverLake } from './terrain.js';

const DROP_COUNT = 90;
const SPRAY_COUNT = 40;

export function createWater(scene) {
  const THREE = window.THREE;
  const group = new THREE.Group();
  group.name = 'water';
  scene.add(group);
  const dropMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.8 });
  const dropGeo = new THREE.SphereGeometry(1.1, 6, 5);
  const drops = [];
  for (let i = 0; i < DROP_COUNT; i++) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.visible = false;
    group.add(m);
    drops.push({ mesh: m, x: 0, y: -999, z: 0, vy: 0, live: false });
  }
  const sprayMat = new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.75 });
  const sprayGeo = new THREE.SphereGeometry(0.8, 6, 5);
  const sprays = [];
  for (let i = 0; i < SPRAY_COUNT; i++) {
    const m = new THREE.Mesh(sprayGeo, sprayMat);
    m.visible = false;
    group.add(m);
    sprays.push({ mesh: m, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  }
  // Wake: a short fading streak trailing behind the plane while scooping, never a slab
  // under it — at chase distance a 90-unit plane reads as a grey runway across the lake.
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 7),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.y = WORLD.lake.waterY + 0.4;
  group.add(wake);
  return { group, drops, sprays, wake, dropIndex: 0, sprayIndex: 0, dropping: false, scooping: false };
}

// Scoop state machine: LOW altitude + LEVEL attitude + WATER nearby = AUTO_SCOOP.
// Generous window on purpose: the scoop must feel reliable, never finicky.
export function scoopCheck(flight) {
  const overLake = isOverLake(flight.x, flight.z);
  const low = flight.y < WORLD.lake.waterY + 14 && flight.y > WORLD.lake.waterY - 2;
  const level = Math.abs(flight.roll) < 0.35 && Math.abs(flight.pitch) < 0.28;
  const speedOk = flight.speed > 30 && flight.speed < 78;
  return overLake && low && level && speedOk;
}

// One step: fill the tank while scooping, rain the drop stream while dropping, age particles.
export function updateWater(water, scene, flight, tank, dropping, dt, fire) {
  const scooping = scoopCheck(flight) && tank.water < PLANE.waterCapacity && !flight.onGround;
  water.scooping = scooping;
  if (scooping) {
    tank.water = Math.min(PLANE.waterCapacity, tank.water + PLANE.scoopRate * dt);
    spawnSpray(water, flight);
  }
  water.dropping = dropping && tank.water > 0 && !flight.onGround;
  if (water.dropping) {
    tank.water = Math.max(0, tank.water - PLANE.dropRate * dt);
    spawnDrop(water, flight);
  }
  // Wake trails behind the plane while scooping.
  water.wake.material.opacity = scooping ? 0.22 : Math.max(0, water.wake.material.opacity - dt * 1.5);
  if (scooping) {
    const bx = flight.x - Math.sin(flight.heading) * 26;
    const bz = flight.z + Math.cos(flight.heading) * 26;
    water.wake.position.set(bx, WORLD.lake.waterY + 0.4, bz);
    water.wake.rotation.z = -flight.heading;
  }
  // Drops fall; on ground contact they douse fire in a footprint.
  for (const d of water.drops) {
    if (!d.live) continue;
    d.vy -= 55 * dt;
    d.y += d.vy * dt;
    d.x += Math.sin(flight.heading) * flight.speed * 0.25 * dt;
    d.z += -Math.cos(flight.heading) * flight.speed * 0.25 * dt;
    d.mesh.position.set(d.x, d.y, d.z);
    if (d.y <= groundHeight(d.x, d.z) + 1) {
      d.live = false;
      d.mesh.visible = false;
      if (fire) fire.douse(d.x, d.z, 26);
    }
  }
  // Spray arcs up and falls back to the lake.
  for (const s of water.sprays) {
    if (s.life <= 0) { s.mesh.visible = false; continue; }
    s.life -= dt;
    s.vy -= 30 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    s.mesh.position.set(s.x, s.y, s.z);
    if (s.y < WORLD.lake.waterY) { s.life = 0; s.mesh.visible = false; }
  }
  return { scooping, dropping: water.dropping };
}

function spawnDrop(water, flight) {
  for (let k = 0; k < 4; k++) {
    const d = water.drops[water.dropIndex];
    water.dropIndex = (water.dropIndex + 1) % water.drops.length;
    d.live = true;
    d.x = flight.x + (Math.random() - 0.5) * 6;
    d.y = flight.y - 2;
    d.z = flight.z + (Math.random() - 0.5) * 6;
    d.vy = -6;
    d.mesh.visible = true;
    d.mesh.position.set(d.x, d.y, d.z);
  }
}

function spawnSpray(water, flight) {
  for (let k = 0; k < 2; k++) {
    const s = water.sprays[water.sprayIndex];
    water.sprayIndex = (water.sprayIndex + 1) % water.sprays.length;
    s.life = 0.7;
    s.x = flight.x + (Math.random() - 0.5) * 8;
    s.y = flight.y - 1;
    s.z = flight.z + (Math.random() - 0.5) * 8;
    s.vx = (Math.random() - 0.5) * 14;
    s.vy = 8 + Math.random() * 10;
    s.vz = (Math.random() - 0.5) * 14;
    s.mesh.visible = true;
  }
}
