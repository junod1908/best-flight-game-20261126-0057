# ASHWING — Wildfire Airtanker

![Best Flight Game](https://make.fun/badge/best-flight-game-20261126-0057.svg)
![Rank](https://make.fun/badge/best-flight-game-20261126-0057/junod1908/best-flight-game-20261126-0057/rank.svg)
![Reward](https://make.fun/badge/best-flight-game-20261126-0057/junod1908/best-flight-game-20261126-0057/reward.svg)

[Best Flight Game — make.fun bounty](https://make.fun/bounty/best-flight-game-20261126-0057)

A 3D wildfire airtanker game. Take off from a dirt strip in Pine Hollow Valley, skim the
lake low and level to scoop a full belly tank, then drop it on the wind-driven fire front.
A full tank is heavy and thirsty: fuel forces a return to base, smoke damages the airframe,
and a hard landing ends the sortie. Contain all three fires to win.

## How to play

- **W / S** — throttle up / down
- **Arrow keys** — pitch and bank
- **SPACE** — drop water
- **P** — pause, **M** — sound on/off, **R** — restart

Scoop is automatic: fly low, level and steady over the lake and the tank fills itself.
Land slow on the dirt strip to refuel.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network: every
file the game loads lives under `game/` (Three.js is vendored as `game/vendor/three.min.js`).

## Screenshots

Deterministic scenes, played by the in-game autopilot from a fresh world with seed 1:
`?shot=cover|drop|scoop|approach&seed=1`.
