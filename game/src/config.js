// Sky Courier — Coral Run: tuning constants and the palette.
// One small prop plane, one archipelago, three sorties. Speeds are metres
// per second internally; the HUD shows knots and feet, as a pilot reads.
export const STEP = 1 / 60;
export const BEST_KEY = 'sky-courier-coral-run-best';

export const WORLD = {
  seed: 20261126,
  // Sea level is y = 0; islands rise out of it.
  waterLevel: 0,
  // Terrain grid: how far the renderer samples ahead and to the sides.
  viewAhead: 1500,
  viewSide: 950,
  gridStep: 60,
  // Ring size and how close a pass must be to count.
  ringRadius: 20,
  ringCatch: 19,
  // Fuel: percent, drains with throttle; a landing refills it.
  fuelStart: 100,
  fuelBurnIdle: 0.08,
  fuelBurnFull: 0.32,
  // Flight model.
  minSpeed: 26,
  cruiseSpeed: 62,
  maxSpeed: 96,
  stallSpeed: 30,
  maxRollDeg: 72,
  maxPitchDeg: 26,
  // Landing: gentle enough, slow enough, lined up with the strip.
  landMaxSink: 4.5,
  landMaxRollDeg: 18,
  landMaxHeadDiffDeg: 22,
  landMaxSpeed: 55,
  hardLandSink: 8,
};

export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    brief: 'Thread all 8 coral rings, then bring her home to Runway 27.',
    rings: 8,
    timeLimit: 0,
    wind: 0,
    landAt: 'home',
  },
  {
    id: 'island-hop',
    name: 'Island Hop',
    brief: 'Six rings over the lagoon, then put down on Gull Island strip.',
    rings: 6,
    timeLimit: 0,
    wind: 0.4,
    landAt: 'gull',
  },
  {
    id: 'storm-courier',
    name: 'Storm Courier',
    brief: 'Ten rings in a crosswind, beat the clock, land at Gull Island.',
    rings: 10,
    timeLimit: 240,
    wind: 1.0,
    landAt: 'gull',
  },
];

export const PALETTE = {
  skyTop: '#2f6fd0',
  skyMid: '#7fb2e8',
  skyLow: '#cfe8f7',
  sunCore: '#fff3c4',
  sunGlow: '#ffd76a',
  seaDeep: '#0d4d7a',
  seaShallow: '#2a8fb5',
  seaFoam: '#bfe8e0',
  sand: '#e8d39a',
  grass: '#5da24a',
  grassDry: '#8fae4e',
  rock: '#7d7468',
  peak: '#cfc8b8',
  runway: '#33373d',
  runwayMark: '#f2f2e8',
  ringNext: '#ffc93c',
  ringDone: '#7be495',
  ringFar: '#9fd8ff',
  hudInk: '#eaf6ff',
  hudDim: '#9fc4dd',
  hudAmber: '#ffb347',
  hudRed: '#ff5d4d',
  hudGreen: '#7be495',
  panel: 'rgba(8, 20, 34, 0.72)',
  panelEdge: 'rgba(160, 210, 240, 0.35)',
};

// Score values, one place so the HUD and the debrief agree.
export const SCORE = {
  ring: 250,
  ringStreakBonus: 50,
  landing: 500,
  softLandingBonus: 250,
  missionComplete: 1000,
  timeBonusPerSecond: 10,
  crashPenalty: 0,
};
