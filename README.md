# Sky Courier — Coral Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/maelaozera/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/maelaozera/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A 3D chase-view flight game for the make.fun best-flight-game-20261126-0057
bounty. No libraries, no build step, no network requests: plain ES modules
under `game/`, all art drawn in code, all sound synthesized with WebAudio.

## The game

You are the coral mail courier, flying a little prop plane over an
archipelago of green islands in a blue lagoon. Thread the glowing rings,
mind the fuel gauge, and bring her home in one piece:

- **Three sorties.** Ring Run (8 rings, then land at Coral Home), Island
  Hop (6 rings, then land on Gull Island), and Storm Courier (10 rings in
  a crosswind against the clock, then land at Gull Island).
- **Real flying.** Throttle, pitch, bank and coordinated turns; slow down
  and she stalls, bank hard and she turns tight. Fuel drains with the
  throttle — land to refuel, or glide her down and hope.
- **Landings that count.** Line up with the strip, wings level, gentle
  sink: a soft touchdown pays a bonus, a hard one bends the airframe, and
  anything else is a crash.
- **A cockpit that reads.** Altitude, speed and heading tapes with a
  compass, an attitude indicator, lit altimeter and airspeed dials, fuel
  and throttle bars, ring counter, score, and warnings for stall, low fuel
  and terrain.

The terrain is a seeded heightfield — islands, beaches, rock and snowless
peaks rising out of the sea — with two flattened runway strips, drifting
clouds, a low sun, and a spinning prop. The plane is drawn from behind in
chase view, banking with the roll, wingtip lights lit.

## Controls

| Key | Action |
| --- | ------ |
| Arrow keys / WASD | Pitch and bank |
| Shift / Ctrl or mouse wheel | Throttle up / down |
| Mouse | Steer toward the cursor |
| 1 / 2 / 3 | Pick a sortie on the title screen |
| Enter / Click | Start, resume, fly the next sortie |
| P / Esc | Pause |
| M | Mute |
| R | Restart the sortie |

The HUD shows altitude (ft), speed (kt), heading, vertical speed, fuel,
throttle, rings, score and the mission clock. Your best score is kept in
`localStorage`. Title, pause, sortie-complete, victory and game-over
screens all show a stats table of the run.

## Playing it

```sh
node serve.ts
# open http://localhost:8080
```

## Screenshots

The four screenshots in `screenshots/` are deterministic renders of the
game's own code, taken in headless Chromium at 1280x720:

| File | Scene |
| --- | ------ |
| `1-start.jpg` | Title screen (`?shot=start&seed=7`) |
| `2-play.jpg` | Mid-flight, full HUD (`?shot=play&seed=7`) |
| `3-ring.jpg` | Nose-first at the next ring (`?shot=ring&seed=7`) |
| `4-land.jpg` | Final approach to Gull Island (`?shot=land&seed=7`) |

`?selftest=1` flies a scripted sortie (takeoff, all rings, landing) and
reports the result into `#selftest` for headless checks.

## Layout

| Path | Job |
| --- | ------ |
| `game/index.html` | The page; loads the game, nothing else |
| `game/src/config.js` | Tuning constants, missions and palette |
| `game/src/random.js` | Seeded RNG and smooth value noise |
| `game/src/input.js` | Keyboard and mouse |
| `game/src/audio.js` | Synthesized WebAudio sound |
| `game/src/world.js` | Terrain, runways, rings, missions, flight model |
| `game/src/render.js` | Perspective projection and the 3D view |
| `game/src/hud.js` | HUD instruments and screens |
| `game/src/shots.js` | Deterministic screenshot scenes |
| `game/src/main.js` | Frame loop, screen state machine, self-test |
| `main.ts` | Hands the entry in: copies `game/` + `screenshots/`, writes `dossier.json` |
| `serve.ts` | Tiny static server for local play |
| `shots.json` | The four screenshot scenes |
| `vendor/makefun-game.ts` | The kit's dossier library, unchanged |

## Handing it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Run `main.ts` twice: both runs must write the same bytes.

## License

MIT — see `LICENSE`.

---

Entered on [make.fun](https://make.fun/?ref=02gvsh14&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards
