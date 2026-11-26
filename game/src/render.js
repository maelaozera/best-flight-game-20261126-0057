// The 3D view: a chase camera behind the plane, a perspective projection
// of the island heightfield, runways, rings, clouds and sun, all drawn on
// one 2D canvas. No library, no textures: every colour is computed here.
import { PALETTE, WORLD } from './config.js';

const FOV = (74 * Math.PI) / 180;
const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function rgb(r, g, b) {
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function shade(base, f) {
  return rgb(base[0] * f, base[1] * f, base[2] * f);
}

function lerpColor(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

const SEA_DEEP = [13, 77, 122];
const SEA_SHALLOW = [42, 143, 181];
const SAND = [232, 211, 154];
const GRASS = [93, 162, 74];
const GRASS_DRY = [143, 174, 78];
const ROCK = [125, 116, 104];
const PEAK = [207, 200, 184];

function terrainColor(h, x, z, noise, dist) {
  // Smooth blends between bands, so islands read as hills, not targets.
  function blend(lo, hi, a, b, t) {
    const s = t <= lo ? 0 : t >= hi ? 1 : (t - lo) / (hi - lo);
    const e = s * s * (3 - 2 * s);
    return lerpColor(a, b, e);
  }
  let c;
  if (h <= 0.4) {
    const sparkle = noise(x * 0.008, z * 0.008) * 0.5 + 0.5;
    const shallow = clamp(1 - Math.abs(h) * 0.4, 0, 1);
    c = lerpColor(SEA_DEEP, SEA_SHALLOW, clamp(shallow * 0.7 + sparkle * 0.3, 0, 1));
  } else {
    c = blend(0.4, 2.6, SAND, GRASS, h);
    const dry = noise(x * 0.015, z * 0.015) * 0.5 + 0.5;
    c = blend(8, 26, c, lerpColor(GRASS, GRASS_DRY, dry * 0.55), h);
    c = blend(26, 46, c, ROCK, h);
    c = blend(48, 62, c, PEAK, h);
  }
  // Distance haze: far ground melts into the sky.
  const haze = clamp(dist / 2400, 0, 0.72);
  const gentle = 0.94 + 0.06 * (noise(x * 0.015, z * 0.015) * 0.5 + 0.5);
  return shade(lerpColor(c, [207, 232, 247], haze), gentle);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let focal = 600;
  // The title screen hides ring labels so they never fight the menu text.
  let hideLabels = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.max(320, Math.floor(rect.width));
    h = Math.max(240, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    focal = (h / 2) / Math.tan(FOV / 2);
  }

  resize();
  window.addEventListener('resize', resize);

  // Camera-space projection. Returns null behind the camera.
  function makeProjector(plane) {
    const heading = plane.heading;
    const pitch = plane.pitch;
    const roll = plane.roll * 0.75;
    const sh = Math.sin(heading);
    const ch = Math.cos(heading);
    // Camera sits behind and above the plane, looking where it looks.
    const camX = plane.x - sh * 10;
    const camY = plane.y + 3.2;
    const camZ = plane.z - ch * 10;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const cx = w / 2;
    const cy = h * 0.52;

    function project(px, py, pz) {
      const dx = px - camX;
      const dy = py - camY;
      const dz = pz - camZ;
      // Into camera axes: right, up, forward.
      const xc = dx * ch - dz * sh;
      const yc = dy;
      const zc = dx * sh + dz * ch;
      // Pitch, then roll.
      const y2 = yc * cp - zc * sp;
      const z2 = yc * sp + zc * cp;
      const x2 = xc * cr - y2 * sr;
      const y3 = xc * sr + y2 * cr;
      if (z2 < 2) return null;
      return {
        x: cx + (x2 / z2) * focal,
        y: cy - (y3 / z2) * focal,
        d: z2,
        s: focal / z2,
      };
    }

    function horizonY() {
      const p = project(camX + sh * 4000, camY, camZ + ch * 4000);
      return p ? p.y : cy;
    }

    return { project, horizonY, camX, camY, camZ, cx, cy };
  }

  function drawSky(proj, plane, time) {
    const hy = proj.horizonY();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(clamp(hy / h, 0.15, 0.85), PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyLow);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Sun: a fixed bearing, low over the sea ahead-right.
    const sunDir = { x: 0.55, y: 0.42, z: 0.72 };
    const sp = proj.project(
      proj.camX + sunDir.x * 4200,
      proj.camY + sunDir.y * 4200,
      proj.camZ + sunDir.z * 4200,
    );
    if (sp && sp.x > -80 && sp.x < w + 80 && sp.y > -80 && sp.y < h + 80) {
      const glow = ctx.createRadialGradient(sp.x, sp.y, 4, sp.x, sp.y, 130);
      glow.addColorStop(0, 'rgba(255, 240, 190, 0.95)');
      glow.addColorStop(0.25, 'rgba(255, 214, 106, 0.55)');
      glow.addColorStop(1, 'rgba(255, 214, 106, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sp.x - 140, sp.y - 140, 280, 280);
      ctx.fillStyle = PALETTE.sunCore;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 22, 0, TAU);
      ctx.fill();
    }
    // Sea base below the horizon, before the terrain quads cover it.
    // Its tones match the near water quads so the join is invisible.
    const sea = ctx.createLinearGradient(0, hy, 0, h);
    sea.addColorStop(0, '#4a97c0');
    sea.addColorStop(1, '#0e527e');
    ctx.fillStyle = sea;
    ctx.fillRect(0, Math.max(0, hy), w, h - Math.max(0, hy));
  }

  function drawClouds(proj, clouds) {
    for (const c of clouds) {
      const p = proj.project(c.x, c.y, c.z);
      if (!p || p.x < -220 || p.x > w + 220 || p.y < -120 || p.y > h + 120) continue;
      const r = c.s * p.s;
      if (r < 3) continue;
      ctx.fillStyle = `rgba(255, 255, 255, ${c.a})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.38, 0, 0, TAU);
      ctx.ellipse(p.x - r * 0.55, p.y + r * 0.08, r * 0.6, r * 0.3, 0, 0, TAU);
      ctx.ellipse(p.x + r * 0.55, p.y + r * 0.06, r * 0.65, r * 0.32, 0, 0, TAU);
      ctx.fill();
    }
  }

  function drawTerrain(proj, world) {
    const plane = world.state.plane;
    const noise = world.noise;
    const sh = Math.sin(plane.heading);
    const ch = Math.cos(plane.heading);
    // Right vector in world space.
    const rx = ch;
    const rz = -sh;
    const step = WORLD.gridStep;
    // Rows start right under the camera (v = 8) so the bottom of the frame
    // is ground, not the sea gradient, then step out to the horizon.
    const vList = [8, 26, 48, 76, 110, 150, 200, 260, 330, 410, 500, 600, 710, 830, 960, 1100, 1250, 1410, 1500];
    const rows = vList.length - 1;
    const cols = Math.ceil((WORLD.viewSide * 2) / step);
    const halfCols = Math.floor(cols / 2);
    // Project the grid nodes once, then paint quads far to near.
    const nodes = [];
    for (let vi = 0; vi <= rows; vi += 1) {
      const v = vList[vi];
      const row = [];
      for (let ui = -halfCols; ui <= halfCols; ui += 1) {
        const u = ui * step;
        const wx = plane.x + sh * v + rx * u;
        const wz = plane.z + ch * v + rz * u;
        const hh = world.heightAt(wx, wz);
        const p = proj.project(wx, Math.max(hh, 0.1), wz);
        row.push({ p, h: hh, x: wx, z: wz, v });
      }
      nodes.push(row);
    }
    for (let vi = rows; vi >= 1; vi -= 1) {
      const rowFar = nodes[vi];
      const rowNear = nodes[vi - 1];
      for (let ui = 0; ui < rowFar.length - 1; ui += 1) {
        const a = rowFar[ui];
        const b = rowFar[ui + 1];
        const c = rowNear[ui + 1];
        const d = rowNear[ui];
        if (!a.p || !b.p || !c.p || !d.p) continue;
        const hm = (a.h + b.h + c.h + d.h) / 4;
        const dist = (a.v + d.v) / 2;
        ctx.fillStyle = terrainColor(hm, (a.x + c.x) / 2, (a.z + c.z) / 2, noise, dist);
        ctx.beginPath();
        ctx.moveTo(a.p.x, a.p.y);
        ctx.lineTo(b.p.x, b.p.y);
        ctx.lineTo(c.p.x, c.p.y);
        ctx.lineTo(d.p.x, d.p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawRunwayStrip(proj, rw) {
    const halfL = rw.len / 2;
    const halfW = rw.wid / 2;
    const y = rw.alt + 0.25;
    function quad(x0, z0, x1, z1, color) {
      const a = proj.project(x0, y, z0);
      const b = proj.project(x1, y, z0);
      const c = proj.project(x1, y, z1);
      const d = proj.project(x0, y, z1);
      if (!a || !b || !c || !d) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }
    quad(rw.x - halfW, rw.z - halfL, rw.x + halfW, rw.z + halfL, PALETTE.runway);
    // Edge lines and centreline dashes.
    quad(rw.x - halfW, rw.z - halfL, rw.x - halfW + 1.2, rw.z + halfL, PALETTE.runwayMark);
    quad(rw.x + halfW - 1.2, rw.z - halfL, rw.x + halfW, rw.z + halfL, PALETTE.runwayMark);
    for (let z = rw.z - halfL + 30; z < rw.z + halfL - 20; z += 42) {
      quad(rw.x - 1.1, z, rw.x + 1.1, z + 20, PALETTE.runwayMark);
    }
    // Threshold bars at both ends.
    for (const end of [-1, 1]) {
      const z0 = rw.z + end * halfL - (end > 0 ? 14 : 0);
      for (let i = -3; i <= 3; i += 1) {
        quad(rw.x + i * 3.4 - 1.1, z0, rw.x + i * 3.4 + 1.1, z0 + 14, PALETTE.runwayMark);
      }
    }
  }

  function drawRing(proj, ring, isNext, collected) {
    const next = { x: ring.x, y: ring.y, z: ring.z + 60 };
    let nx = 0;
    let ny = 0;
    let nz = 1;
    const len = Math.hypot(next.x - ring.x, next.y - ring.y, next.z - ring.z) || 1;
    nx = (next.x - ring.x) / len;
    ny = (next.y - ring.y) / len;
    nz = (next.z - ring.z) / len;
    // Ring plane basis: u across, w up-ish, both perpendicular to the normal.
    let ux = -nz;
    let uy = 0;
    let uz = nx;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const wx = uy * nz - uz * ny;
    const wy = uz * nx - ux * nz;
    const wz = ux * ny - uy * nx;
    const segs = 22;
    ctx.beginPath();
    let first = null;
    for (let i = 0; i <= segs; i += 1) {
      const a = (i / segs) * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const px = ring.x + (ux * ca + wx * sa) * ring.r;
      const py = ring.y + (uy * ca + wy * sa) * ring.r;
      const pz = ring.z + (uz * ca + wz * sa) * ring.r;
      const p = proj.project(px, py, pz);
      if (!p) continue;
      if (!first) {
        first = p;
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    if (!first) return;
    ctx.closePath();
    if (collected) {
      ctx.strokeStyle = 'rgba(123, 228, 149, 0.35)';
      ctx.lineWidth = 3;
    } else if (isNext) {
      ctx.save();
      ctx.shadowColor = PALETTE.ringNext;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = PALETTE.ringNext;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#fff7d6';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.strokeStyle = PALETTE.ringFar;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (isNext && !hideLabels) {
      const c = proj.project(ring.x, ring.y + ring.r + 12, ring.z);
      if (c) {
        ctx.font = `bold ${Math.max(13, Math.min(22, 340 * c.s))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff7d6';
        ctx.fillText('NEXT RING', c.x, c.y);
      }
    }
  }

  // The plane itself, chase view: a coral-and-cream prop plane seen from
  // behind and slightly above — nose away (up-screen), tail fin toward the
  // camera (down-screen), banking with the roll, wingtip lights lit.
  function drawPlane(plane, time) {
    const cx = w / 2;
    const cy = h * 0.66;
    const s = Math.min(w, h) / 760;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-plane.roll * 0.85);
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    // Wings: tapered, slight dihedral, coral tops. They sit mid-body;
    // the nose is up-screen, the tail down-screen.
    ctx.fillStyle = '#ff7a4d';
    ctx.strokeStyle = '#7a2d16';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-158, -14);
    ctx.lineTo(-20, -24);
    ctx.lineTo(-16, -6);
    ctx.lineTo(-146, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(158, -14);
    ctx.lineTo(20, -24);
    ctx.lineTo(16, -6);
    ctx.lineTo(146, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Wingtip navigation lights: red port, green starboard.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-156, -5, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#35e07a';
    ctx.beginPath();
    ctx.arc(156, -5, 5, 0, TAU);
    ctx.fill();
    // Fuselage: short and foreshortened, cream with a coral stripe.
    // Nose (far, up-screen) tapers; tail (near, down-screen) is wide.
    ctx.fillStyle = '#fff3dd';
    ctx.strokeStyle = '#7a2d16';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-11, -52);
    ctx.quadraticCurveTo(-17, -20, -19, 8);
    ctx.quadraticCurveTo(-19, 26, -13, 32);
    ctx.lineTo(13, 32);
    ctx.quadraticCurveTo(19, 26, 19, 8);
    ctx.quadraticCurveTo(17, -20, 11, -52);
    ctx.quadraticCurveTo(0, -58, -11, -52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff7a4d';
    ctx.beginPath();
    ctx.moveTo(-18, -26);
    ctx.quadraticCurveTo(0, -18, 18, -26);
    ctx.lineTo(18, -12);
    ctx.quadraticCurveTo(0, -4, -18, -12);
    ctx.closePath();
    ctx.fill();
    // Tailplane, at the near end (down-screen).
    ctx.fillStyle = '#e85d3d';
    ctx.beginPath();
    ctx.moveTo(-54, 14);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-8, 22);
    ctx.lineTo(-50, 30);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(54, 14);
    ctx.lineTo(10, 8);
    ctx.lineTo(8, 22);
    ctx.lineTo(50, 30);
    ctx.closePath();
    ctx.fill();
    // Tail fin with the coral-bird mark, rising toward the camera.
    ctx.fillStyle = '#1f8f7a';
    ctx.beginPath();
    ctx.moveTo(-13, 26);
    ctx.quadraticCurveTo(-16, 52, -6, 62);
    ctx.lineTo(10, 62);
    ctx.quadraticCurveTo(16, 48, 13, 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0d4a3f';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff3dd';
    ctx.beginPath();
    ctx.arc(1, 44, 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1f8f7a';
    ctx.beginPath();
    ctx.arc(1, 44, 3.5, 0, TAU);
    ctx.fill();
    // Spinning prop disc, a shimmer at the far nose.
    const shimmer = 0.5 + 0.5 * Math.sin(time * 40);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.10 + shimmer * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(0, -50, 24, 4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawWorld(world, time) {
    const state = world.state;
    hideLabels = !!state.hideRingLabels;
    const proj = makeProjector(state.plane);
    drawSky(proj, state.plane, time);
    drawClouds(proj, world.clouds);
    drawTerrain(proj, world);
    for (const rw of world.runways) drawRunwayStrip(proj, rw);
    world.state.rings.forEach((ring, i) => {
      drawRing(proj, ring, i === state.ringIndex, ring.got);
    });
    if (state.phase !== 'crashed') drawPlane(state.plane, time);
    return proj;
  }

  return { drawWorld, resize, get width() { return w; }, get height() { return h; } };
}
