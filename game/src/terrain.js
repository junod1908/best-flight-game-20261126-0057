// Valley terrain: a heightfield valley with a lake basin, a dirt strip and pine forest.
// groundHeight(x, z) is the single source of truth — flight, fire and water all ask it.
import { WORLD } from './config.js';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

// Distance from a point to the strip centre line (runway runs along X at strip.z).
function stripDistance(x, z) {
  const dx = Math.abs(x - WORLD.strip.x);
  const dz = Math.abs(z - WORLD.strip.z);
  return Math.max(dx - WORLD.strip.length / 2, dz - WORLD.strip.width / 2);
}

export function groundHeight(x, z) {
  const d = Math.hypot(x, z) / WORLD.valleyRadius;
  let h = 150 * d * d;
  h += 26 * Math.sin(x * 0.004 + 1.7) * Math.cos(z * 0.0035 - 0.6);
  h += 12 * Math.sin(x * 0.011 + z * 0.008) * Math.cos(z * 0.013 - x * 0.005);
  h += 5 * Math.sin(x * 0.031) * Math.sin(z * 0.027);
  // Lake basin: carve a bowl below the water line.
  const lakeD = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z) / WORLD.lake.radius;
  if (lakeD < 1.15) h = h * smooth((lakeD - 0.55) / 0.6) - 14 * (1 - smooth(lakeD));
  // Dirt strip: flatten a runway pad.
  const sd = stripDistance(x, z);
  if (sd < 90) h = h * smooth(sd / 90) + WORLD.strip.groundY * (1 - smooth(sd / 90));
  // Keep the valley floor gentle near the centre so the fire zones sit on flyable ground.
  const centre = Math.hypot(x, z) / 700;
  if (centre < 1) h = h * (0.25 + 0.75 * smooth(centre)) + 8 * (1 - smooth(centre));
  return h;
}

export function isOverLake(x, z) {
  return Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z) < WORLD.lake.radius * 0.92;
}

// Build the terrain mesh, lake surface, dirt strip and pine forest into the scene.
export function buildTerrain(scene, rng) {
  const THREE = window.THREE;
  const size = WORLD.size;
  const seg = 110;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const green = [0.16, 0.32, 0.14];
  const dry = [0.42, 0.36, 0.20];
  const rock = [0.42, 0.38, 0.34];
  const sand = [0.62, 0.52, 0.34];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    const t = clamp(h / 130, 0, 1);
    let c = [
      green[0] + (dry[0] - green[0]) * t,
      green[1] + (dry[1] - green[1]) * t,
      green[2] + (dry[2] - green[2]) * t,
    ];
    if (t > 0.62) c = rock;
    const lakeD = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z) / WORLD.lake.radius;
    if (lakeD < 1.05) c = sand;
    const sd = stripDistance(x, z);
    if (sd < 8) c = [0.55, 0.44, 0.28];
    const shade = 0.88 + 0.12 * Math.sin(x * 0.11 + z * 0.07);
    colors[i * 3] = c[0] * shade;
    colors[i * 3 + 1] = c[1] * shade;
    colors[i * 3 + 2] = c[2] * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  scene.add(mesh);

  // Lake: a calm teal disc at the water line.
  const lakeGeo = new THREE.CircleGeometry(WORLD.lake.radius, 48);
  lakeGeo.rotateX(-Math.PI / 2);
  const lake = new THREE.Mesh(lakeGeo, new THREE.MeshPhongMaterial({
    color: 0x2e7f8f, shininess: 40, specular: 0x336677, transparent: true, opacity: 0.92,
  }));
  lake.position.set(WORLD.lake.x, WORLD.lake.waterY, WORLD.lake.z);
  lake.name = 'lake';
  scene.add(lake);

  // Dirt strip: runway pad with centre dashes and edge markers.
  const stripGroup = new THREE.Group();
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.strip.length, WORLD.strip.width),
    new THREE.MeshLambertMaterial({ color: 0x8a6f45 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(WORLD.strip.x, WORLD.strip.groundY + 0.3, WORLD.strip.z);
  stripGroup.add(pad);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5ead0 });
  for (let i = -4; i <= 4; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(18, 3), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(WORLD.strip.x + i * 34, WORLD.strip.groundY + 0.6, WORLD.strip.z);
    stripGroup.add(dash);
  }
  stripGroup.name = 'strip';
  scene.add(stripGroup);

  // Pine forest: instanced cones + trunks, kept off the lake and the strip.
  const treeCount = 520;
  const cone = new THREE.ConeGeometry(4.5, 16, 6);
  const coneMat = new THREE.MeshLambertMaterial({ color: 0x1d4a22 });
  const trees = new THREE.InstancedMesh(cone, coneMat, treeCount);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let guard = 0;
  while (placed < treeCount && guard < 6000) {
    guard++;
    const x = (rng() - 0.5) * (size - 120);
    const z = (rng() - 0.5) * (size - 120);
    if (isOverLake(x, z)) continue;
    if (stripDistance(x, z) < 40) continue;
    const h = groundHeight(x, z);
    if (h > 95) continue;
    const s = 0.7 + rng() * 0.9;
    dummy.position.set(x, h + 8 * s, z);
    dummy.scale.set(s, s, s);
    dummy.rotation.y = rng() * Math.PI * 2;
    dummy.updateMatrix();
    trees.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  trees.count = placed;
  trees.name = 'pines';
  scene.add(trees);

  // Ridge rocks: a few pale boulders on the high ground for readable silhouettes.
  const rockGeo = new THREE.DodecahedronGeometry(9, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x7a7268 });
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    const r = 950 + rng() * 300;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const rock = new THREE.Mesh(rockGeo, rockMat);
    const s = 0.6 + rng() * 1.6;
    rock.scale.set(s, s * 0.7, s);
    rock.position.set(x, groundHeight(x, z) + 3, z);
    rock.rotation.y = rng() * Math.PI;
    scene.add(rock);
  }
  return mesh;
}
