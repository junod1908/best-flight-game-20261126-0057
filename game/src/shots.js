// Deterministic screenshot scenes: each one plays the real rules forward from a fresh world
// with a fixed seed, steered by a simple autopilot (fly to a waypoint, hold altitude, scoop
// over the lake, drop over the fire), so the frame is what a short game really looks like
// and the same seed always gives the same frame.
//
// The scoop run is a straight pass across the lake, not a circle over its centre: circling
// keeps the wings banked, and the scoop state machine only fills a level tank.
import { SHOT, WORLD } from './config.js';
import { groundHeight, isOverLake } from './terrain.js';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function headingError(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function desiredHeading(x, z, tx, tz) {
  return Math.atan2(tx - x, -(tz - z));
}

// Autopilot: steer toward a waypoint {x, z, alt} at a target speed. On a low run (scoop or
// final approach) the bank is capped so the wings stay near level.
function autopilot(flight, wp, drop) {
  const input = { pitch: 0, roll: 0, throttleDelta: 0, throttleSet: null, drop: !!drop };
  const dh = desiredHeading(flight.x, flight.z, wp.x, wp.z);
  const err = headingError(flight.heading, dh);
  const lowRun = wp.alt < 25;
  const rollCap = lowRun ? 0.35 : 1;
  input.roll = clamp(err * 1.4, -rollCap, rollCap);
  const altErr = wp.alt - flight.y;
  const distToWp = Math.hypot(wp.x - flight.x, wp.z - flight.z);
  if (flight.onGround) {
    input.pitch = flight.speed > 40 ? 0.8 : 0;
    input.throttleSet = 1;
  } else if (altErr > 12) {
    input.pitch = 0.85;
    input.throttleSet = 0.95;
  } else if (altErr < -12) {
    input.pitch = -0.55;
    input.throttleSet = 0.45;
  } else {
    input.pitch = clamp(altErr * 0.04, -0.4, 0.4);
    input.throttleSet = 0.72;
  }
  // Slow down for a low final: a 75-unit pass never lines up with the strip.
  if (!flight.onGround && wp.alt < 70 && distToWp < 300) input.throttleSet = 0.5;
  if (Math.abs(err) > 1.2 && !flight.onGround) input.pitch = Math.min(input.pitch, 0.1);
  // Terrain override: close to the ground, climb first and turn second — a steep turn at
  // scoop height over the lake rim is how the last two runs ended. Never over the lake
  // itself, where the "ground" is the lakebed far below the water the scoop needs.
  const clearance = flight.y - groundHeight(flight.x, flight.z);
  if (!flight.onGround && clearance < 30 && !isOverLake(flight.x, flight.z)) {
    input.pitch = Math.max(input.pitch, 0.7);
    input.throttleSet = 1;
  }
  return input;
}

function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

// Fly waypoints until `done(state)` is true or the sim budget runs out.
function flyPlan(world, waypoints, done, maxSeconds) {
  const dt = SHOT.step;
  const maxSteps = Math.round(maxSeconds / dt);
  let wpIndex = 0;
  for (let step = 0; step < maxSteps; step++) {
    const s = world.state;
    if (s.flight.crashed || s.screen === 'over' || s.screen === 'win') break;
    if (done(s)) break;
    const wp = waypoints[Math.min(wpIndex, waypoints.length - 1)];
    // The tank only opens near the drop waypoint itself, never on the run-in: dropping
    // from 500 units out would empty the tank before the fire is under the plane.
    const nearDrop = dist2d(s.flight.x, s.flight.z, wp.x, wp.z) < (wp.dropRadius || 170);
    const drop = !!wp.drop && nearDrop;
    const input = autopilot(s.flight, wp, drop);
    world.step(dt, input);
    if (dist2d(s.flight.x, s.flight.z, wp.x, wp.z) < (wp.radius || 60)) {
      if (wpIndex < waypoints.length - 1) wpIndex++;
    }
  }
}

function lakeAlt() { return WORLD.lake.waterY + 7; }
function zoneAlt(zone, above) { return groundHeight(zone.x, zone.z) + above; }

// One straight scoop pass: enter the lake high on its east shore, descend across it and
// leave low on the west shore. Both ends stay inside the lake — the shore past the west
// end is a 90 m hill, and the lakebed itself rises above the water past x = -680.
function scoopPass() {
  const lake = WORLD.lake;
  return [
    { x: lake.x + 240, z: lake.z + 40, alt: 70, radius: 120 },
    { x: lake.x - 180, z: lake.z - 20, alt: lakeAlt(), radius: 100 },
  ];
}

export function stageShot(name, world) {
  const s = world.state;
  const lake = WORLD.lake;
  const zone1 = s.fire.zones[0];
  const strip = WORLD.strip;

  if (name === 'scoop') {
    // Take off, cross to the lake and skim it until the tank is half full — spray and wake visible.
    flyPlan(world, scoopPass(), (st) => st.water >= 45, 150);
  } else if (name === 'cover' || name === 'drop') {
    // Scoop a full tank on the lake pass, climb straight on west clear of the shore, then
    // turn back east and run in on the first fire. The turn happens at altitude, never
    // banked low over the rising lake rim. The shot only ends once a full tank has been
    // scooped AND the drop is under way — a few units of water must never end it.
    const above = name === 'cover' ? 40 : 26;
    let scoopedFull = false;
    flyPlan(world, [
      ...scoopPass(),
      { x: -900, z: -420, alt: 130, radius: 150 },
      { x: -350, z: -300, alt: 120, radius: 120 },
      { x: zone1.x, z: zone1.z, alt: zoneAlt(zone1, above), radius: 30, drop: true },
    ], (st) => {
      if (st.water >= 90) scoopedFull = true;
      if (!scoopedFull) return false;
      if (name === 'cover') return st.water <= 78 && st.water > 0 && world.water.dropping;
      return st.water <= 42 && st.water > 0;
    }, 240);
    // The drop shot is staged from a side profile instead of the chase view, so the
    // contact sheet shows a different moment from the cover: the plane abeam, the water
    // column falling, and the fire line ahead of it.
    if (name === 'drop') world.shotCam = 'side';
  } else if (name === 'approach') {
    // Final approach from the WEST, landing eastbound: the valley west of the strip is low,
    // so the plane can descend gently onto final. (An eastbound final failed twice — the
    // eastern ridge is too high to drop behind.) The last leg runs straight down the runway
    // centreline, so the shot only ends once the wings are level, the heading is on the
    // runway, and the strip is centred in front of the plane — a frame mid-turn shows
    // the valley, not the strip.
    const finalX = strip.x - 320;
    const finalY = groundHeight(finalX, strip.z) + 22;
    flyPlan(world, [
      { x: strip.x - 500, z: strip.z - 100, alt: 150, radius: 150 },
      { x: strip.x - 700, z: strip.z + 400, alt: 120, radius: 150 },
      { x: strip.x - 600, z: strip.z, alt: 100, radius: 90 },
      { x: finalX, z: strip.z, alt: finalY, radius: 60 },
    ], (st) => {
      const aligned = Math.abs(headingError(st.flight.heading, Math.PI / 2)) < 0.15;
      const level = Math.abs(st.flight.roll) < 0.12;
      const onCentreline = Math.abs(st.flight.z - strip.z) < 25;
      return aligned && level && onCentreline
        && dist2d(st.flight.x, st.flight.z, finalX, strip.z) < 60
        && st.flight.y < groundHeight(finalX, strip.z) + 35;
    }, 240);
  }
  return { screen: s.screen };
}
