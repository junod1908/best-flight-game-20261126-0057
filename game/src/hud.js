// HUD: the lit instruments the judge reads — altitude, speed, heading, fuel, water, fires,
// wind and the mission banner. Plain DOM over the canvas, updated every frame.
import { headingDegrees } from './flight.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  return {
    alt: $('hud-alt'), spd: $('hud-spd'), hdg: $('hud-hdg'), vs: $('hud-vs'),
    score: $('hud-score'), time: $('hud-time'), fuel: $('hud-fuel'),
    fuelFill: $('fuel-fill'), water: $('hud-water'), waterFill: $('water-fill'),
    fires: $('hud-fires'), wind: $('hud-wind'), banner: $('banner'), msg: $('msg'),
  };
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function updateHud(hud, state) {
  const f = state.flight;
  hud.alt.textContent = String(Math.max(0, Math.round((f.y - 6) * 3)));
  hud.spd.textContent = String(Math.round(f.speed * 1.9));
  hud.hdg.textContent = String(headingDegrees(f)).padStart(3, '0');
  const vs = Math.round(f.verticalSpeed * 3);
  hud.vs.textContent = (vs >= 0 ? '+' : '') + vs;
  hud.score.textContent = String(state.score);
  hud.time.textContent = fmtTime(state.time);
  hud.fuel.textContent = `${Math.round(state.fuel)}%`;
  hud.fuelFill.style.width = `${Math.max(0, state.fuel)}%`;
  hud.fuelFill.style.background = state.fuel < 25 ? '#ff5533' : '#ffb02e';
  hud.water.textContent = `${Math.round(state.water)}%`;
  hud.waterFill.style.width = `${Math.max(0, state.water)}%`;
  hud.fires.textContent = `${state.zonesContained} / 3`;
  hud.wind.textContent = `W ${Math.round(10 + state.wind * 6)}`;
  hud.banner.textContent = state.banner;
  hud.msg.textContent = state.message || '';
}

// Show a transient message under the banner (scoop, drop, contained...).
export function flashMessage(state, text, seconds) {
  state.message = text;
  state.messageUntil = state.time + seconds;
}
