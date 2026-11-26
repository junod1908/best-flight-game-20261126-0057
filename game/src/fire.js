// Wildfire: three zones that burn, spread downwind and throw up smoke columns.
// A drop of water over a zone kills flames inside its footprint and leaves scorched ground.
import { FIRE } from './config.js';
import { groundHeight } from './terrain.js';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export function createFire(rng) {
  const zones = FIRE.zones.map((def, zi) => {
    const flames = [];
    for (let i = 0; i < def.flames; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * def.radius * 0.8;
      flames.push({
        x: def.x + Math.cos(a) * r,
        z: def.z + Math.sin(a) * r,
        scale: 0.8 + rng() * 0.5,
        phase: rng() * Math.PI * 2,
        alive: true,
      });
    }
    return { ...def, index: zi, flames, radiusNow: def.radius, contained: false, burning: 0 };
  });
  return { zones, smokePuffs: [], scorch: [], time: 0 };
}

// Build the visible flames, smoke and the orange target ring for the active zone.
export function buildFireVisuals(scene, fire) {
  const THREE = window.THREE;
  fire.group = new THREE.Group();
  fire.group.name = 'fire';
  scene.add(fire.group);
  fire.flameMeshes = [];
  const flameGeo = new THREE.ConeGeometry(2.8, 11, 6);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6a00 });
  const coreGeo = new THREE.ConeGeometry(1.5, 6.5, 6);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffd23c });
  for (const zone of fire.zones) {
    for (const flame of zone.flames) {
      const y = groundHeight(flame.x, flame.z);
      const outer = new THREE.Mesh(flameGeo, flameMat);
      outer.position.set(flame.x, y + 4 * flame.scale, flame.z);
      outer.scale.setScalar(flame.scale);
      outer.userData.flame = flame;
      outer.userData.zone = zone;
      fire.group.add(outer);
      fire.flameMeshes.push(outer);
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.set(flame.x, y + 2.6 * flame.scale, flame.z);
      core.scale.setScalar(flame.scale);
      core.userData.flame = flame;
      core.userData.zone = zone;
      core.userData.core = true;
      fire.group.add(core);
      fire.flameMeshes.push(core);
    }
  }
  // Smoke: soft grey spheres that rise and drift with the wind. Kept small and light so
  // the fire, not the smoke, owns the frame.
  fire.smokeMat = new THREE.MeshBasicMaterial({ color: 0x4a4440, transparent: true, opacity: 0.3 });
  fire.smokeMeshes = [];
  const smokeGeo = new THREE.SphereGeometry(6, 8, 6);
  for (let i = 0; i < 26; i++) {
    const puff = new THREE.Mesh(smokeGeo, fire.smokeMat);
    puff.userData.seed = i * 1.37;
    fire.group.add(puff);
    fire.smokeMeshes.push(puff);
  }
  // Target ring: a compact orange torus floating over the active zone, the drop marker.
  fire.ring = new THREE.Mesh(
    new THREE.TorusGeometry(20, 1.0, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xff8c1a }),
  );
  fire.ring.rotation.x = Math.PI / 2;
  fire.group.add(fire.ring);
  fire.ringLabel = null;
  return fire;
}

// Advance flames, spread and smoke one step. Only the active zone spreads; later zones smoulder.
export function updateFire(fire, activeIndex, dt) {
  fire.time += dt;
  const windX = 0.8;
  const windZ = 0.25;
  for (const zone of fire.zones) {
    if (zone.contained) continue;
    zone.burning = zone.flames.filter((f) => f.alive).length;
    if (zone.index === activeIndex) {
      zone.radiusNow = Math.min(zone.radius * 1.35, zone.radiusNow + FIRE.spreadPerSec * zone.wind * dt);
    }
  }
  for (const mesh of fire.flameMeshes) {
    const flame = mesh.userData.flame;
    const zone = mesh.userData.zone;
    mesh.visible = flame.alive && !zone.contained;
    if (!mesh.visible) continue;
    const flicker = 1 + 0.22 * Math.sin(fire.time * 9 + flame.phase);
    mesh.scale.setScalar(flame.scale * flicker);
    mesh.rotation.y += dt * 0.6;
  }
  // Smoke columns rise from the active zone's live flames and drift downwind.
  const active = fire.zones[activeIndex];
  for (let i = 0; i < fire.smokeMeshes.length; i++) {
    const puff = fire.smokeMeshes[i];
    if (!active || active.contained) { puff.visible = false; continue; }
    puff.visible = true;
    const cyc = ((fire.time * 0.09 + puff.userData.seed) % 1);
    const fx = active.x + Math.sin(puff.userData.seed * 7) * active.radiusNow * 0.5 + windX * cyc * 90;
    const fz = active.z + Math.cos(puff.userData.seed * 5) * active.radiusNow * 0.5 + windZ * cyc * 90;
    puff.position.set(fx, groundHeight(fx, fz) + 10 + cyc * 70, fz);
    const s = 0.5 + cyc * 1.1;
    puff.scale.setScalar(s);
    puff.material.opacity = 0.22 * (1 - cyc * 0.6);
  }
  if (fire.ring) {
    if (active && !active.contained) {
      fire.ring.visible = true;
      fire.ring.position.set(active.x, groundHeight(active.x, active.z) + 30, active.z);
      fire.ring.rotation.z += dt * 0.4;
    } else {
      fire.ring.visible = false;
    }
  }
}

// Is a point inside a smoke column? Used for damage.
export function inSmoke(fire, x, y, z) {
  const active = fire.zones.find((zn) => !zn.contained);
  if (!active) return false;
  const dx = x - active.x;
  const dz = z - active.z;
  const r = Math.hypot(dx, dz);
  const gy = groundHeight(x, z);
  return r < active.radiusNow * 0.6 && y > gy + 8 && y < gy + 80;
}

// Drop water at (x, z) with footprint radius r: kill flames inside it, scorch the ground.
export function douseAt(fire, scene, x, z, r) {
  let killed = 0;
  const THREE = window.THREE;
  for (const zone of fire.zones) {
    if (zone.contained) continue;
    for (const flame of zone.flames) {
      if (!flame.alive) continue;
      if (Math.hypot(flame.x - x, flame.z - z) < r) {
        flame.alive = false;
        killed++;
      }
    }
    zone.burning = zone.flames.filter((f) => f.alive).length;
    if (zone.burning === 0) zone.contained = true;
  }
  if (killed > 0) {
    // Scorched patch: a dark disc where the water hit.
    const gy = groundHeight(x, z);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.85, 20),
      new THREE.MeshLambertMaterial({ color: 0x241a12, transparent: true, opacity: 0.85 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, gy + 0.8, z);
    disc.name = 'scorch';
    scene.add(disc);
    fire.scorch.push(disc);
  }
  return killed;
}

export function flamesAlive(fire) {
  return fire.zones.reduce((n, z) => n + z.flames.filter((f) => f.alive).length, 0);
}

export function activeZone(fire, index) {
  return fire.zones[index] || null;
}
