// Arcade flight model: throttle sets speed, pitch sets climb, bank turns the nose.
// One job: move the plane state one fixed step and report what happened (ground contact,
// terrain hit, smoke, stall) so missions.js can turn it into fuel, damage and score.
import { PLANE, WORLD } from './config.js';
import { groundHeight } from './terrain.js';

export function createFlight() {
  return {
    x: WORLD.strip.x,
    y: WORLD.strip.groundY + 2.2,
    z: WORLD.strip.z,
    heading: WORLD.strip.heading, // radians, 0 = -Z (north)
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    onGround: true,
    verticalSpeed: 0,
    crashed: false,
    crashReason: '',
  };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// input: { pitch: -1..1 (up positive), roll: -1..1, throttleDelta, throttleSet, drop }
// waterLoad 0..100 makes the plane heavier: slower and thirstier.
export function updateFlight(f, input, waterLoad, dt, fire) {
  if (f.crashed) return { events: ['crashed'] };
  const events = [];
  const heavy = 1 - PLANE.tankWeightPenalty * (waterLoad / PLANE.waterCapacity);

  if (typeof input.throttleSet === 'number') f.throttle = clamp(input.throttleSet, 0, 1);
  else f.throttle += (input.throttleDelta || 0) * dt * 0.7;
  f.throttle = clamp(f.throttle, 0, 1);

  const targetSpeed = f.throttle * PLANE.maxSpeed * heavy;
  const accel = f.onGround ? 14 : 9;
  f.speed += clamp(targetSpeed - f.speed, -accel * dt, accel * dt);

  const targetPitch = clamp((input.pitch || 0) * PLANE.maxPitch, -PLANE.maxPitch, PLANE.maxPitch);
  f.pitch = angleLerp(f.pitch, targetPitch, clamp(dt * 3.2, 0, 1));
  const targetRoll = clamp((input.roll || 0) * PLANE.maxBank, -PLANE.maxBank, PLANE.maxBank);
  f.roll = angleLerp(f.roll, targetRoll, clamp(dt * 4, 0, 1));

  // Bank turns the nose; faster flight turns harder. Positive roll banks right and the
  // heading grows clockwise (north -> east), matching the heading convention.
  const turnRate = f.roll * (0.55 + 0.35 * clamp(f.speed / PLANE.maxSpeed, 0, 1));
  f.heading += turnRate * dt;

  // Lift: climbing costs speed, sinking gains it; below stall speed the wing gives up.
  const climb = Math.sin(f.pitch) * f.speed * PLANE.climbRate;
  const stalling = !f.onGround && f.speed < PLANE.stallSpeed;
  const sink = stalling ? -14 * (1 - f.speed / PLANE.stallSpeed) : 0;
  f.verticalSpeed = climb + sink;
  f.y += f.verticalSpeed * dt;

  const fx = Math.sin(f.heading);
  const fz = -Math.cos(f.heading);
  f.x += fx * Math.cos(f.pitch) * f.speed * dt;
  f.z += fz * Math.cos(f.pitch) * f.speed * dt;

  // Stay inside the valley; the ridge pushes back with a gentle turn.
  const r = Math.hypot(f.x, f.z);
  if (r > WORLD.valleyRadius + 60) {
    const back = Math.atan2(-f.x, -f.z);
    f.heading = angleLerp(f.heading, back, clamp(dt * 1.5, 0, 1));
    events.push('ridge');
  }

  const ground = groundHeight(f.x, f.z);
  const clearance = f.y - ground;
  const onStrip = Math.abs(f.x - WORLD.strip.x) < WORLD.strip.length / 2 + 20
    && Math.abs(f.z - WORLD.strip.z) < WORLD.strip.width / 2 + 20;

  if (f.onGround) {
    f.y = ground + 2.2;
    if (f.speed > 52 && f.pitch > 0.06) {
      f.onGround = false;
      events.push('takeoff');
    }
  } else if (clearance <= 2.2) {
    // Touchdown: hard vertical speed or a slope hit is damage; a gentle strip landing refuels.
    if (f.verticalSpeed < -PLANE.hardLandingVs || (!onStrip && f.speed > 60)) {
      f.crashed = true;
      f.crashReason = f.verticalSpeed < -PLANE.hardLandingVs ? 'hard landing' : 'terrain strike';
      events.push('crash');
    } else {
      f.onGround = true;
      f.pitch = 0;
      f.y = ground + 2.2;
      events.push(onStrip ? 'landed-strip' : 'landed-field');
    }
  } else if (clearance < 5 && f.speed > 70 && !onStrip) {
    // Brushing the canopy at speed: scrape damage, not an instant crash.
    events.push('scrape');
  }

  // Smoke columns: flying through one hurts the airframe.
  if (fire && fire.inSmoke(f.x, f.y, f.z)) events.push('smoke');

  return { events };
}

// Heading in degrees, 0 = north, clockwise.
export function headingDegrees(f) {
  let d = (-f.heading * 180) / Math.PI;
  d = ((d % 360) + 360) % 360;
  return Math.round(d);
}
