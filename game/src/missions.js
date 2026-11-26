// Missions: three fire zones in sequence, fuel that forces a return to base, damage that
// ends a sortie, and the score. One job: turn flight + fire events into game state.
import { PLANE, MISSION, WORLD } from './config.js';
import { activeZone } from './fire.js';
import { flashMessage } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export function createMissionState() {
  return {
    screen: SCREEN_TITLE,
    score: 0,
    time: 0,
    fuel: PLANE.fuelCapacity,
    water: 0,
    damage: 0,
    zonesContained: 0,
    activeZoneIndex: 0,
    firesOut: 0,
    banner: 'ASHWING — WILDFIRE AIRTANKER',
    message: '',
    messageUntil: 0,
    wind: 1,
    overReason: '',
    stats: null,
    wasScooping: false,
    wasDropping: false,
    wasOnGround: true,
  };
}

// One step of mission logic after flight + fire + water have moved.
export function updateMission(state, flight, fire, waterInfo, dt) {
  if (state.screen !== SCREEN_PLAY) return;
  state.time += dt;
  if (state.time > state.messageUntil) state.message = '';

  // Fuel: throttle burns it; an empty tank means gliding home on fumes.
  state.fuel = Math.max(0, state.fuel - PLANE.fuelBurnPerSec * (0.25 + flight.throttle) * dt);
  if (state.fuel <= 0 && flight.throttle > 0) flight.throttle = 0;

  // Scoop / drop callouts, once per transition.
  if (waterInfo.scooping && !state.wasScooping) flashMessage(state, 'SCOOPING — tank filling', 2);
  if (waterInfo.dropping && !state.wasDropping) flashMessage(state, 'DROPPING WATER', 2);
  state.wasScooping = waterInfo.scooping;
  state.wasDropping = waterInfo.dropping;

  // Refuel on the strip while slow on the ground.
  const onStrip = Math.abs(flight.x - WORLD.strip.x) < WORLD.strip.length / 2
    && Math.abs(flight.z - WORLD.strip.z) < WORLD.strip.width / 2;
  if (flight.onGround && onStrip && flight.speed < 12) {
    const before = state.fuel;
    state.fuel = Math.min(PLANE.fuelCapacity, state.fuel + 22 * dt);
    if (before < PLANE.fuelCapacity && state.fuel >= PLANE.fuelCapacity) {
      flashMessage(state, 'REFUELLED — full tank', 2.5);
    }
  }

  // Banner follows the job: scoop while the tank is empty, drop once it is full.
  const zone = activeZone(fire, state.activeZoneIndex);
  if (zone && !zone.contained) {
    state.banner = state.water < 15
      ? `SCOOP WATER — THEN DROP ON ${zone.name.toUpperCase()}`
      : `DROP ON ${zone.name.toUpperCase()} — PRESS SPACE`;
  }

  // Zone contained: score it and light the next one.
  if (zone && zone.contained && state.zonesContained === state.activeZoneIndex) {
    state.zonesContained++;
    state.score += MISSION.scorePerZone;
    flashMessage(state, `${zone.name.toUpperCase()} CONTAINED! +${MISSION.scorePerZone}`, 3);
    state.activeZoneIndex++;
    const next = activeZone(fire, state.activeZoneIndex);
    state.banner = next
      ? `NEXT FIRE: ${next.name.toUpperCase()} — SCOOP, THEN DROP`
      : 'ALL FIRES OUT';
    if (!next) {
      const timeBonus = Math.max(0, Math.round((900 - state.time) * MISSION.timeBonusPerSec));
      state.score += timeBonus;
      finishRun(state, SCREEN_WIN, `All three fires contained. Time bonus +${timeBonus}.`);
    }
  }

  // Crash / out of fuel over the trees ends the run.
  if (flight.crashed) {
    finishRun(state, SCREEN_OVER, `Crashed — ${flight.crashReason}. ${state.zonesContained}/3 fires contained.`);
  } else if (state.fuel <= 0 && !flight.onGround && flight.speed < 8 && flight.y < 30) {
    finishRun(state, SCREEN_OVER, 'Out of fuel — forced landing short of the strip.');
  }
  state.firesOut = fire.zones.reduce((n, z) => n + z.flames.filter((f) => !f.alive).length, 0);
}

function finishRun(state, screen, reason) {
  state.screen = screen;
  state.overReason = reason;
  state.stats = {
    score: state.score,
    time: state.time,
    fuelLeft: Math.round(state.fuel),
    firesOut: state.firesOut,
    zones: state.zonesContained,
  };
}

// Damage from an event the flight model reported.
export function applyDamage(state, flight, kind) {
  if (state.screen !== SCREEN_PLAY) return;
  if (kind === 'smoke') {
    state.damage += 2.5 * (1 / 60);
    if (state.damage >= 100) {
      flight.crashed = true;
      flight.crashReason = 'airframe failed in the smoke';
    }
  } else if (kind === 'scrape') {
    state.damage = Math.min(100, state.damage + 4);
  }
}
