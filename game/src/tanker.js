// The SMOKEWING airtanker, built from primitives: red-and-cream single-engine tanker with a
// belly tank, high wing, floats and a spinning prop. No textures, no external assets.
export function buildTanker() {
  const THREE = window.THREE;
  const plane = new THREE.Group();
  plane.name = 'smokewing';

  const red = new THREE.MeshLambertMaterial({ color: 0xc23a1e });
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2e6c8 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22262b });
  const glass = new THREE.MeshPhongMaterial({ color: 0x1b3a44, shininess: 140, specular: 0xaaddff });
  const yellow = new THREE.MeshLambertMaterial({ color: 0xffb02e });

  // Fuselage: cream nose-to-tail tube with a red cheatline stripe.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.1, 11, 12), cream);
  body.rotation.x = Math.PI / 2;
  plane.add(body);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.12, 11, 12, 1, true, 0, Math.PI), red);
  stripe.rotation.x = Math.PI / 2;
  stripe.rotation.z = Math.PI;
  stripe.position.y = -0.15;
  plane.add(stripe);
  // Nose + spinner.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), red);
  nose.scale.set(1, 1, 0.8);
  nose.position.set(0, 0, 5.6);
  plane.add(nose);
  // Cockpit glass.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 10), glass);
  canopy.scale.set(1, 0.75, 1.6);
  canopy.position.set(0, 1.15, 2.6);
  plane.add(canopy);
  // Belly water tank (the thing the scoop fills).
  const tank = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 4.6), yellow);
  tank.position.set(0, -1.55, 0.4);
  plane.add(tank);
  // High wing + struts.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(17, 0.35, 2.6), red);
  wing.position.set(0, 1.35, 0.6);
  plane.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 2.6), yellow);
  wingTipL.position.set(-8.5, 1.35, 0.6);
  plane.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 8.5;
  plane.add(wingTipR);
  // Tail: vertical fin + horizontal stabiliser.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 2.4), red);
  fin.position.set(0, 1.6, -5.2);
  plane.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.28, 1.8), cream);
  stab.position.set(0, 0.7, -5.4);
  plane.add(stab);
  // Twin floats for lake work.
  for (const side of [-1, 1]) {
    const float = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 6.5, 8), dark);
    float.rotation.x = Math.PI / 2;
    float.position.set(side * 2.6, -2.2, 0.6);
    plane.add(float);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 0.25), dark);
    strut.position.set(side * 2.6, -1.5, 1.6);
    plane.add(strut);
  }
  // Propeller: two-blade disc that spins with speed. Kept faint so it reads as a blur,
  // not a solid disc floating over the nose.
  const prop = new THREE.Group();
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.32, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.8, 24), bladeMat);
  prop.add(disc);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.4, 0.12), dark);
  prop.add(blade);
  prop.position.set(0, 0, 6.6);
  prop.name = 'prop';
  plane.add(prop);
  // Navigation lights: red left, green right, white tail.
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  navL.position.set(-8.6, 1.35, 0.6);
  plane.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  navR.position.set(8.6, 1.35, 0.6);
  plane.add(navR);

  plane.traverse((obj) => { if (obj.isMesh) obj.castShadow = false; });
  return plane;
}

// Spin the prop faster as the engine works harder.
export function updateTankerVisual(plane, throttle, dt, time) {
  const prop = plane.getObjectByName('prop');
  if (prop) prop.rotation.z += dt * (4 + throttle * 42);
  plane.position.y += Math.sin(time * 2.2) * 0.0; // no-op kept for symmetry with the bob below
}
