// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between title, play, paused, mission complete, victory and game over.
//
// ?seed=N fixes the archipelago. ?shot=start|play|ring|land|end|win (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot. ?selftest=1 flies a scripted
// sortie and writes its report into #selftest for a headless check.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_CRASH,
  EVENT_FUEL,
  EVENT_LAND,
  EVENT_MISSION,
  EVENT_RING,
  EVENT_WIN,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_MISSION_1,
  ACTION_MISSION_2,
  ACTION_MISSION_3,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import {
  createHud,
  SCREEN_DONE,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './hud.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();
const errors = [];

window.addEventListener('error', (event) => {
  errors.push(String(event.message ?? event.error ?? 'unknown error'));
});

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.drawWorld(world, performance.now() / 1000);
    const w = renderer.width;
    const h = renderer.height;
    if (scene.screen === SCREEN_TITLE) hud.drawTitle(world, w, h, scene.best);
    else if (scene.screen === SCREEN_PLAY) hud.drawHud(world, w, h);
    else if (scene.screen === SCREEN_OVER) hud.drawOver(world, w, h, scene.best);
    else if (scene.screen === SCREEN_DONE) hud.drawDone(world, w, h, scene.best, scene.wonAll);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let warnAt = 0;
  let missionIndex = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startMission(index) {
    missionIndex = index;
    world.reset(index);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.resume();
    announce(`Flying ${world.state.mission.name}.`);
  }

  function endRun() {
    screen = SCREEN_OVER;
    audio.crash();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Crashed. ${world.state.crashReason}. Score ${world.state.score}.`);
  }

  function completeMission(wonAll) {
    screen = wonAll ? SCREEN_WIN : SCREEN_DONE;
    audio.fanfare();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(wonAll ? 'All sorties complete.' : `${world.state.mission.name} complete.`);
  }

  function handleEvents(events) {
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_LAND) audio.thud();
    if (events & EVENT_FUEL) audio.warn();
    if (events & EVENT_CRASH) endRun();
    else if (events & EVENT_WIN) completeMission(true);
    else if (events & EVENT_MISSION) completeMission(false);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_MISSION_1) startMission(0);
      else if (actions & ACTION_MISSION_2) startMission(1);
      else if (actions & ACTION_MISSION_3) startMission(2);
      else if (actions & ACTION_CONFIRM) startMission(missionIndex);
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_RESTART) {
        startMission(missionIndex);
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_RESTART) {
        startMission(missionIndex);
      }
    } else if (screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startMission(missionIndex);
    } else if (screen === SCREEN_DONE) {
      if (actions & ACTION_CONFIRM) {
        startMission(Math.min(2, missionIndex + 1));
      } else if (actions & ACTION_RESTART) {
        startMission(missionIndex);
      }
    } else if (screen === SCREEN_WIN) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startMission(0);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { pitch: 0, roll: 0, throttle: 0 }, true);
      return;
    }
    const control = input.control();
    const events = world.step(STEP, control, false);
    const s = world.state;
    audio.update(s.plane.throttle, s.plane.speed / 96, s.plane.speed < 30);
    if (s.plane.speed < 30 && s.phase === 'flying' && performance.now() - warnAt > 1200) {
      audio.warn();
      warnAt = performance.now();
    }
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.drawWorld(world, now / 1000);
    const w = renderer.width;
    const h = renderer.height;
    if (screen === SCREEN_TITLE) hud.drawTitle(world, w, h, best);
    else if (screen === SCREEN_PLAY) hud.drawHud(world, w, h);
    else if (screen === SCREEN_PAUSED) hud.drawPaused(w, h);
    else if (screen === SCREEN_OVER) hud.drawOver(world, w, h, best);
    else if (screen === SCREEN_DONE) hud.drawDone(world, w, h, best, false);
    else if (screen === SCREEN_WIN) hud.drawDone(world, w, h, best, true);
  }

  // Leaving the tab pauses a running game rather than letting it fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Sky Courier Coral Run. Press Enter or click to fly.');
  requestAnimationFrame(frame);
}

// A scripted sortie for headless checks: the same autopilot a player
// would fly — throttle management, carrot guidance through the rings,
// a localizer final onto the strip. Runs synchronously on load (a whole
// sortie is a few ten-thousand cheap steps) and reports into #selftest.
function runSelftest() {
  const report = { errors, frames: 0, rings: 0, score: 0, phase: '', crashed: '', steps: 0 };
  try {
    world.reset(0);
    let landPhase = 'entry';
    const maxSteps = 60 * 400;
    let steps = 0;

    function wrapAngle(a) {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    }

    function steer() {
      const s = world.state;
      const p = s.plane;
      const thr = (target) => Math.max(-1, Math.min(1, (target - p.throttle) * 2.5));
      if (s.phase === 'landed') return { pitch: 0.4, roll: 0, throttle: thr(0.9) };
      if (s.ringsGot >= s.rings.length) {
        const t = world.runways.find((r) => r.id === s.mission.landAt);
        const entry = { x: t.x - 260, z: t.z - 1600 };
        const dEntry = Math.hypot(entry.x - p.x, entry.z - p.z);
        if (landPhase === 'entry' && dEntry < 250) landPhase = 'final';
        if (landPhase === 'entry') {
          const dx = entry.x - p.x;
          const dz = entry.z - p.z;
          const dl = Math.hypot(dx, dz) || 1;
          const dh = wrapAngle(Math.atan2(entry.x + (dx / dl) * 150 - p.x, entry.z + (dz / dl) * 150 - p.z) - p.heading);
          return {
            pitch: Math.max(-0.5, Math.min(0.5, (100 - p.y) / 50)),
            roll: Math.max(-1, Math.min(1, dh * 2.0)),
            throttle: thr(0.55),
          };
        }
        const dh = wrapAngle(Math.atan2(t.x - p.x, 250) - p.heading);
        const overStrip = Math.abs(p.x - t.x) < 20 && p.z > t.z - t.len / 2 - 30;
        const wantAlt = overStrip
          ? Math.max(1.0, 30 - (p.z - (t.z - t.len / 2 - 30)) * 0.15)
          : 30;
        return {
          pitch: Math.max(-0.5, Math.min(0.5, (wantAlt - p.y) / 50)),
          roll: Math.max(-1, Math.min(1, dh * 3.0)),
          throttle: thr(0.2),
        };
      }
      const ring = s.rings[s.ringIndex];
      if (!ring) return { pitch: 0, roll: 0, throttle: 0 };
      const dx = ring.x - p.x;
      const dy = ring.y - p.y;
      const dz = ring.z - p.z;
      const dist = Math.hypot(dx, dy, dz);
      const lead = dist < 450 ? 130 : 0;
      const ax = ring.x + (dx / Math.max(1, dist)) * lead;
      const az = ring.z + (dz / Math.max(1, dist)) * lead;
      const dh = wrapAngle(Math.atan2(ax - p.x, az - p.z) - p.heading);
      const target = dist > 500 ? 0.8 : dist > 200 ? 0.6 : 0.25;
      return {
        pitch: Math.max(-0.8, Math.min(0.8, dy / 50)),
        roll: Math.max(-1, Math.min(1, dh * 2.0)),
        throttle: thr(target),
      };
    }

    while (steps < maxSteps) {
      const events = world.step(STEP, steer(), false);
      steps += 1;
      report.steps = steps;
      report.rings = world.state.ringsGot;
      report.score = world.state.score;
      report.phase = world.state.phase;
      if (events & EVENT_CRASH) report.crashed = world.state.crashReason;
      if (world.state.phase === 'crashed' || world.state.phase === 'done') break;
    }
    report.frames = Math.ceil(steps / 16);
  } catch (err) {
    report.errors.push(String(err && err.message ? err.message : err));
  }
  const el = document.getElementById('selftest');
  if (el) el.textContent = JSON.stringify(report);
  window.__shotReady = true;
}

if (shot) runShot(shot);
else if (selftest) runSelftest();
else runGame();
