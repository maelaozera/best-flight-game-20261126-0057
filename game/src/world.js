// The world: an archipelago, two runways, ring courses, three sorties,
// and the flight model. Pure logic over a seeded random source, so the
// renderer and the tests can drive the same world from Node or a browser.
import { MISSIONS, SCORE, WORLD } from './config.js';
import { createRandom, makeNoise } from './random.js';

export const EVENT_RING = 1;
export const EVENT_LAND = 2;
export const EVENT_CRASH = 4;
export const EVENT_MISSION = 8;
export const EVENT_FUEL = 16;
export const EVENT_WIN = 32;
export const EVENT_HARD = 64;

const DEG = Math.PI / 180;

// The islands, fixed for this game: home base, then a chain up the course.
const ISLANDS = [
  { x: 0, z: 0, r: 430, peak: 58 },
  { x: -520, z: 1150, r: 300, peak: 74 },
  { x: 640, z: 1500, r: 270, peak: 62 },
  { x: 250, z: 2600, r: 390, peak: 52 },
  { x: -380, z: 2450, r: 220, peak: 44 },
  { x: 880, z: 3150, r: 330, peak: 84 },
  { x: -720, z: 3550, r: 290, peak: 66 },
  { x: 60, z: 4250, r: 360, peak: 70 },
  { x: -1050, z: 2900, r: 240, peak: 56 },
  { x: 1150, z: 2100, r: 210, peak: 48 },
];

export const RUNWAYS = [
  { id: 'home', name: 'Runway 27 · Coral Home', x: 0, z: 60, len: 430, wid: 30, heading: 0, alt: 2 },
  { id: 'gull', name: 'Runway 09 · Gull Island', x: 250, z: 2600, len: 400, wid: 28, heading: 0, alt: 2 },
];

function islandHeight(x, z, noise) {
  let h = 0;
  let mask = 0;
  for (const isl of ISLANDS) {
    const dx = x - isl.x;
    const dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= isl.r) continue;
    const fall = 0.5 + 0.5 * Math.cos((Math.PI * d) / isl.r);
    const dome = Math.pow(fall, 1.4) * isl.peak;
    h += dome;
    mask = Math.max(mask, fall);
  }
  // Dunes on the high ground, a flat beach shelf near the water.
  if (mask > 0.02) {
    h += noise(x * 0.012, z * 0.012) * 3.2 * mask;
    h += noise(x * 0.05, z * 0.05) * 0.9 * mask;
  }
  return h;
}

export function terrainHeight(x, z, noise) {
  let h = islandHeight(x, z, noise);
  // Flatten the ground under each runway so a landing reads as a landing:
  // fully flat inside the strip, ramping back to the island over 60 m.
  for (const rw of RUNWAYS) {
    const dx = Math.max(0, Math.abs(x - rw.x) - rw.wid / 2);
    const dz = Math.max(0, Math.abs(z - rw.z) - rw.len / 2);
    const outside = Math.sqrt(dx * dx + dz * dz);
    if (outside < 60) {
      const blend = outside / 60;
      h = rw.alt + (h - rw.alt) * blend;
    }
  }
  return h;
}

function runwayAt(x, z) {
  for (const rw of RUNWAYS) {
    if (Math.abs(x - rw.x) < rw.wid / 2 + 1 && Math.abs(z - rw.z) < rw.len / 2 + 1) return rw;
  }
  return null;
}

function buildRings(mission, rand) {
  const rings = [];
  const count = mission.rings;
  const target = RUNWAYS.find((r) => r.id === mission.landAt) ?? RUNWAYS[0];
  // Ring Run turns back toward home halfway out; the other sorties run
  // the whole lagoon to Gull Island. Rings sit ~290 m apart so a pilot
  // has time to climb and turn between them.
  const endZ = mission.landAt === 'gull' ? target.z - 100 : 2400;
  for (let i = 0; i < count; i += 1) {
    const t = (i + 1) / (count + 1);
    const z = 400 + t * (endZ - 400);
    const x = Math.sin(i * 0.95 + 0.6) * 190 + (target.x - 0) * t;
    const y = 110 + Math.sin(i * 1.35) * 50 + rand.range(-12, 12);
    rings.push({ x, y, z, r: WORLD.ringRadius, got: false });
  }
  return rings;
}

function buildClouds(rand) {
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: rand.range(-1400, 1600),
      y: rand.range(260, 430),
      z: rand.range(-600, 4600),
      s: rand.range(70, 190),
      a: rand.range(0.5, 0.9),
    });
  }
  return clouds;
}

export function createWorld(rand) {
  const noise = makeNoise(WORLD.seed);
  const clouds = buildClouds(rand);

  const state = {
    missionIndex: 0,
    mission: MISSIONS[0],
    rings: [],
    ringIndex: 0,
    ringsGot: 0,
    streak: 0,
    score: 0,
    fuel: WORLD.fuelStart,
    damage: 0,
    time: 0,
    timeLeft: 0,
    phase: 'flying', // flying | landed | crashed | done
    airborne: false, // true once the plane has left the strip
    airborneAt: -10, // time she last left the ground
    crashReason: '',
    landedRunway: null,
    plane: {
      x: 0, y: 2, z: -120,
      heading: 0, pitch: 0, roll: 0,
      speed: 0, throttle: 0, vy: 0,
    },
    windGust: 0,
    message: '',
    messageAt: 0,
  };

  function reset(missionIndex = 0) {
    state.missionIndex = missionIndex;
    state.mission = MISSIONS[missionIndex];
    state.rings = buildRings(state.mission, rand);
    state.ringIndex = 0;
    state.ringsGot = 0;
    state.streak = 0;
    state.score = 0;
    state.fuel = WORLD.fuelStart;
    state.damage = 0;
    state.time = 0;
    state.timeLeft = state.mission.timeLimit;
    state.phase = 'flying';
    state.airborne = false;
    state.airborneAt = -10;
    state.crashReason = '';
    state.landedRunway = null;
    state.windGust = 0;
    state.message = '';
    state.hideRingLabels = false;
    state.plane = {
      x: 0, y: 2, z: -120,
      heading: 0, pitch: 0, roll: 0,
      speed: 0, throttle: 0.35, vy: 0,
    };
  }

  function headingDiff(a, b) {
    let d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function crash(reason) {
    state.phase = 'crashed';
    state.crashReason = reason;
    return EVENT_CRASH;
  }

  function step(dt, control, attract = false) {
    if (state.phase === 'crashed' || state.phase === 'done') return 0;
    const p = state.plane;
    const mission = state.mission;
    let events = 0;
    state.time += dt;

    // Throttle: Shift/wheel up, Ctrl/wheel down; it spools, it never jumps.
    p.throttle = Math.max(0, Math.min(1, p.throttle + control.throttle * dt * 0.7));

    // Roll and pitch ease toward what the pilot asks for.
    const rollTarget = control.roll * WORLD.maxRollDeg * DEG;
    const pitchTarget = control.pitch * WORLD.maxPitchDeg * DEG;
    const stalled = p.speed < WORLD.stallSpeed;
    const authority = stalled ? 0.45 : 1;
    p.roll += Math.max(-2.4 * dt, Math.min(2.4 * dt, (rollTarget - p.roll) * 3.2 * dt * authority));
    p.pitch += Math.max(-1.8 * dt, Math.min(1.8 * dt, (pitchTarget - p.pitch) * 2.6 * dt * authority));

    // A coordinated turn: bank right, heading follows. On the ground the
    // wheels keep her straight — she only turns once she is flying.
    const turnRate = (Math.tan(p.roll) * 9.81) / Math.max(22, p.speed)
      * (state.airborne ? 1 : 0.12);
    p.heading += turnRate * dt;

    // Speed chases the throttle; drag bites above cruise.
    const targetSpeed = WORLD.minSpeed + p.throttle * (WORLD.maxSpeed - WORLD.minSpeed);
    const accel = targetSpeed > p.speed ? 13 : 9;
    p.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - p.speed));

    // Crosswind pushes the plane sideways; stronger in the storm sortie.
    state.windGust = Math.sin(state.time * 0.6) * mission.wind * 4
      + Math.sin(state.time * 1.7) * mission.wind * 1.6;

    // Move along the nose, plus the wind.
    const cp = Math.cos(p.pitch);
    const fx = Math.sin(p.heading) * cp;
    const fy = Math.sin(p.pitch);
    const fz = Math.cos(p.heading) * cp;
    p.x += (fx * p.speed + state.windGust) * dt;
    p.z += fz * p.speed * dt;
    let vy = fy * p.speed;
    // A stall only sinks an airborne plane: on the strip she just rolls.
    const groundNow = terrainHeight(p.x, p.z, noise);
    if (stalled && p.y > groundNow + 3) vy -= (WORLD.stallSpeed - p.speed) * 0.7;
    p.vy = vy;
    p.y += vy * dt;
    if (p.y > groundNow + 5 && !state.airborne) {
      state.airborne = true;
      state.airborneAt = state.time;
    }

    // Fuel: full throttle drinks it; an empty tank glides, then ditches.
    state.fuel -= (WORLD.fuelBurnIdle + p.throttle * (WORLD.fuelBurnFull - WORLD.fuelBurnIdle)) * dt;
    if (state.fuel <= 0) {
      state.fuel = 0;
      p.throttle = 0;
      if (!(events & EVENT_FUEL)) {
        events |= EVENT_FUEL;
        state.message = 'FUEL EMPTY — glide her down!';
        state.messageAt = state.time;
      }
    }

    // Attract mode (title screen): the plane cruises a slow circle by itself.
    if (attract) {
      p.throttle = 0.45;
      p.roll = 0.35;
      p.pitch = 0.02;
      if (p.y < 140) p.pitch = 0.06;
      if (p.y > 220) p.pitch = -0.04;
    }

    // Rings: fly through the hoop, close to its centre.
    if (state.ringIndex < state.rings.length) {
      const ring = state.rings[state.ringIndex];
      const dx = p.x - ring.x;
      const dy = p.y - ring.y;
      const dz = p.z - ring.z;
      if (dx * dx + dy * dy + dz * dz < WORLD.ringCatch * WORLD.ringCatch) {
        ring.got = true;
        state.ringsGot += 1;
        state.streak += 1;
        state.score += SCORE.ring + SCORE.ringStreakBonus * Math.min(4, state.streak - 1);
        state.ringIndex += 1;
        events |= EVENT_RING;
        state.message = state.ringIndex >= state.rings.length
          ? 'ALL RINGS — land at ' + (RUNWAYS.find((r) => r.id === mission.landAt)?.name ?? '')
          : `RING ${state.ringsGot}/${state.rings.length}`;
        state.messageAt = state.time;
      }
    }

    // The clock, only where the sortie sets one.
    if (mission.timeLimit > 0) {
      state.timeLeft = mission.timeLimit - state.time;
      if (state.timeLeft <= 0 && state.phase === 'flying') {
        state.timeLeft = 0;
        return crash('OUT OF TIME — the courier window closed');
      }
    }

    // Ground and water.
    const ground = terrainHeight(p.x, p.z, noise);
    const rw = runwayAt(p.x, p.z);
    if (state.phase === 'landed') {
      // Rolling out: speed bleeds off, the nose stays level. Throttle up
      // and she accelerates again — a touch-and-go is a real option.
      p.y = rw ? rw.alt : ground;
      p.roll *= 0.9;
      p.speed = Math.max(0, p.speed + (p.throttle > 0.5 ? 12 : -14) * dt);
      if (p.throttle > 0.55 && p.speed > 30 && p.pitch > 0.04) {
        state.phase = 'flying';
        state.airborne = true;
        state.airborneAt = state.time;
        state.landedRunway = null;
      }
      return events;
    }
    if (p.y <= ground + 1.2) {
      if (rw) {
        if (!state.airborne) {
          // Takeoff roll: wheels on the strip. Bank and heading do not
          // matter yet — she is rolling, not flying.
          if (p.speed > 30 && p.pitch > 0.05) {
            state.airborne = true;
            state.airborneAt = state.time;
          } else {
            p.y = rw.alt;
            p.vy = 0;
          }
          return events;
        }
        // Climbing away from the strip is not a landing: she just lifted
        // off and is still low over it. The same goes for the first second
        // after liftoff, whatever the attitude.
        if (p.vy > 1 || state.time - state.airborneAt < 1.5) {
          return events;
        }
        const headDiff = Math.abs(headingDiff(p.heading, rw.heading)) * (180 / Math.PI);
        const aligned = headDiff < WORLD.landMaxHeadDiffDeg || headDiff > 180 - WORLD.landMaxHeadDiffDeg;
        const gentle = p.speed < WORLD.landMaxSpeed
          && Math.abs(p.roll) < WORLD.landMaxRollDeg * DEG && aligned
          && p.vy > -WORLD.hardLandSink;
        if (gentle) {
          // Score it, refuel, and finish the sortie when the strip is the
          // mission's target and the rings are done.
          state.phase = 'landed';
          state.airborne = false;
          state.landedRunway = rw;
          state.fuel = WORLD.fuelStart;
          const soft = p.vy > -WORLD.landMaxSink;
          state.score += SCORE.landing + (soft ? SCORE.softLandingBonus : 0);
          events |= EVENT_LAND;
          if (!soft) {
            state.damage += 25;
            events |= EVENT_HARD;
          }
          state.message = soft ? 'TOUCHDOWN — smooth as silk' : 'TOUCHDOWN — hard, airframe bent';
          state.messageAt = state.time;
          const target = RUNWAYS.find((r) => r.id === mission.landAt);
          if (rw.id === mission.landAt && state.ringIndex >= state.rings.length) {
            state.phase = 'done';
            state.score += SCORE.missionComplete;
            if (mission.timeLimit > 0) {
              state.score += Math.max(0, Math.round(state.timeLeft)) * SCORE.timeBonusPerSecond;
            }
            events |= EVENT_MISSION;
            if (state.missionIndex >= MISSIONS.length - 1) events |= EVENT_WIN;
          }
          return events;
        }
      }
      if (ground <= 0.6) return crash('DITCHED IN THE SEA');
      if (p.vy < -WORLD.hardLandSink || p.speed > 68) return crash('TERRAIN — flew into the island');
      return crash('BELLY LANDING — no strip under her');
    }
    return events;
  }

  // Staging helpers for screenshots and tests: place the plane, collect rings.
  function placePlane(patch) {
    Object.assign(state.plane, patch);
  }

  function collectRing(index) {
    const ring = state.rings[index];
    if (!ring || ring.got) return;
    ring.got = true;
    state.ringsGot += 1;
    state.streak += 1;
    state.score += SCORE.ring;
    if (index === state.ringIndex) state.ringIndex += 1;
  }

  function heightAt(x, z) {
    return terrainHeight(x, z, noise);
  }

  reset(0);
  return {
    state, reset, step, placePlane, collectRing, heightAt,
    clouds, islands: ISLANDS, runways: RUNWAYS, noise,
  };
}
