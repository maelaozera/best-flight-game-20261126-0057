// Deterministic screenshot scenes. ?shot=start|play|ring|land (with
// &seed=N) stages one scene, paints it, and sets window.__shotReady so a
// headless browser knows the frame is done. Nothing here is random: the
// same seed always rebuilds the same picture.
import { SCREEN_DONE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';

export function stageShot(name, world) {
  const s = world.state;
  if (name === 'start') {
    world.reset(0);
    // A vista, not a parking spot: cruising over the lagoon with the
    // archipelago ahead and the first rings glowing in the distance.
    world.placePlane({
      x: -80, y: 195, z: -120, heading: 0.24, pitch: -0.03, roll: 0.1,
      speed: 58, throttle: 0.55, vy: 0,
    });
    s.hideRingLabels = true;
    return { screen: SCREEN_TITLE, best: 12450 };
  }
  if (name === 'play') {
    world.reset(0);
    world.collectRing(0);
    world.collectRing(1);
    world.collectRing(2);
    // Mid-flight over the lagoon: three rings banked, the next one gold
    // ahead, Gull Island and its strip on the horizon.
    const ring = s.rings[3];
    world.placePlane({
      x: ring.x - 34, y: ring.y - 8, z: ring.z - 175,
      heading: Math.atan2(ring.x - 60, 175), pitch: 0.04, roll: -0.24,
      speed: 64, throttle: 0.72, vy: 4,
    });
    s.score = 850;
    s.fuel = 71;
    s.time = 74;
    s.message = 'RING 3/8';
    s.messageAt = s.time;
    return { screen: SCREEN_PLAY, best: 12450 };
  }
  if (name === 'ring') {
    world.reset(0);
    world.collectRing(0);
    world.collectRing(1);
    // Nose-first at the next ring: the gold hoop fills the windscreen,
    // the sea and a green island behind it.
    const ring = s.rings[2];
    world.placePlane({
      x: ring.x - 18, y: ring.y - 3, z: ring.z - 130,
      heading: Math.atan2(ring.x - (ring.x - 18), 130), pitch: 0.02, roll: 0.08,
      speed: 68, throttle: 0.78, vy: 2,
    });
    s.score = 550;
    s.fuel = 82;
    s.time = 41;
    return { screen: SCREEN_PLAY, best: 12450 };
  }
  if (name === 'land') {
    world.reset(1);
    for (let i = 0; i < 6; i += 1) world.collectRing(i);
    // Final approach to Gull Island: gear down in spirit, strip ahead,
    // low over the lagoon, instruments lit.
    world.placePlane({
      x: 250, y: 26, z: 2290, heading: 0, pitch: -0.06, roll: 0,
      speed: 44, throttle: 0.3, vy: -3,
    });
    s.score = 2150;
    s.fuel = 46;
    s.time = 132;
    s.message = 'ALL RINGS — land at Runway 09 · Gull Island';
    s.messageAt = s.time;
    return { screen: SCREEN_PLAY, best: 12450 };
  }
  if (name === 'end') {
    world.reset(0);
    world.collectRing(0);
    world.collectRing(1);
    world.collectRing(2);
    world.collectRing(3);
    world.placePlane({ x: -40, y: 12, z: 1500, heading: 0.4, pitch: -0.2, roll: 0.5, speed: 30, throttle: 0.2, vy: -9 });
    s.score = 1150;
    s.fuel = 58;
    s.time = 96;
    s.phase = 'crashed';
    s.crashReason = 'TERRAIN — flew into the island';
    return { screen: SCREEN_OVER, best: 12450 };
  }
  if (name === 'win') {
    world.reset(2);
    for (let i = 0; i < 10; i += 1) world.collectRing(i);
    world.placePlane({ x: 250, y: 2, z: 2600, heading: 0, pitch: 0, roll: 0, speed: 0, throttle: 0 });
    s.score = 5450;
    s.fuel = 100;
    s.time = 198;
    s.phase = 'done';
    return { screen: SCREEN_DONE, best: 5450, wonAll: true };
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
