// The HUD and the screens: altitude, speed and heading tapes, an attitude
// indicator and two lit dials, the mission panel, warnings, and the title,
// pause, mission-complete and game-over screens. All canvas, so a screenshot
// shows exactly what the pilot sees.
import { MISSIONS, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_DONE = 'done';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;
const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function panel(ctx, x, y, w, h, r = 10) {
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();
}

function label(ctx, text, x, y, size, color, align = 'left', weight = '600') {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, size, color, align = 'left') {
  ctx.font = `700 ${size}px "SF Mono", ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function headingText(deg) {
  const d = ((Math.round(deg) % 360) + 360) % 360;
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return `${String(d).padStart(3, '0')}° ${names[Math.round(d / 45) % 8]}`;
}

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');

  function drawCompass(cx, y, headingDeg, width) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - width / 2, y - 14, width, 28);
    ctx.clip();
    for (let off = -60; off <= 60; off += 5) {
      const deg = Math.round((headingDeg + off) / 5) * 5;
      const norm = ((deg % 360) + 360) % 360;
      const x = cx + (deg - headingDeg) * (width / 120);
      const major = norm % 45 === 0;
      const mid = norm % 15 === 0;
      ctx.strokeStyle = major ? PALETTE.hudInk : PALETTE.hudDim;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, y + (major ? -6 : mid ? -2 : 2));
      ctx.stroke();
      if (major) {
        const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
        label(ctx, names[norm], x, y - 10, 11, PALETTE.hudInk, 'center', '700');
      }
    }
    ctx.restore();
    ctx.strokeStyle = PALETTE.hudAmber;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, y - 12);
    ctx.lineTo(cx, y + 10);
    ctx.stroke();
  }

  function drawAttitude(cx, cy, r, pitch, roll) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);
    const pitchPx = clamp(pitch, -0.5, 0.5) * r * 1.6;
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, -pitchPx);
    ctx.lineTo(r, -pitchPx);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    for (const off of [-0.35, -0.18, 0.18, 0.35]) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, -pitchPx + off * r * 1.6);
      ctx.lineTo(r * 0.35, -pitchPx + off * r * 1.6);
      ctx.stroke();
    }
    ctx.restore();
    // Fixed aircraft symbol and bezel.
    ctx.strokeStyle = PALETTE.hudAmber;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, cy);
    ctx.lineTo(cx - r * 0.12, cy);
    ctx.moveTo(cx + r * 0.12, cy);
    ctx.lineTo(cx + r * 0.55, cy);
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    label(ctx, 'ATT', cx, cy + r + 16, 10, PALETTE.hudDim, 'center');
  }

  function drawDial(cx, cy, r, frac, labelText, unit, color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = 'rgba(6, 18, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Lit tick ring.
    for (let i = 0; i <= 10; i += 1) {
      const a = (-225 + i * 27) * (Math.PI / 180);
      const major = i % 5 === 0;
      ctx.strokeStyle = major ? PALETTE.hudInk : PALETTE.hudDim;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - (major ? 9 : 6)), cy + Math.sin(a) * (r - (major ? 9 : 6)));
      ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
      ctx.stroke();
    }
    const angle = (-225 + clamp(frac, 0, 1) * 270) * (Math.PI / 180);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * (r - 12), cy + Math.sin(angle) * (r - 12));
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
    label(ctx, labelText, cx, cy + r + 16, 10, PALETTE.hudDim, 'center');
    label(ctx, unit, cx, cy + r + 29, 9, PALETTE.hudDim, 'center');
  }

  function drawBar(x, y, w, h, frac, color, labelText) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    const fh = h * clamp(frac, 0, 1);
    ctx.fillRect(x, y + h - fh, w, fh);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    label(ctx, labelText, x + w / 2, y + h + 14, 10, PALETTE.hudDim, 'center');
  }

  function drawHud(world, w, h) {
    const s = world.state;
    const p = s.plane;
    const altFt = Math.max(0, Math.round(p.y * M_TO_FT));
    const spdKt = Math.round(p.speed * MS_TO_KT);
    const hdgDeg = ((p.heading * 180) / Math.PI % 360 + 360) % 360;
    const vsFpm = Math.round(p.vy * M_TO_FT * 60);
    const stalled = p.speed < 30 && s.phase === 'flying';

    // Top-left flight data.
    panel(ctx, 14, 12, 250, 108);
    label(ctx, 'ALTITUDE', 28, 34, 10, PALETTE.hudDim);
    value(ctx, `${altFt.toLocaleString('en-US')} ft`, 28, 58, 20, PALETTE.hudInk);
    label(ctx, 'SPEED', 150, 34, 10, PALETTE.hudDim);
    value(ctx, `${spdKt} kt`, 150, 58, 20, PALETTE.hudInk);
    label(ctx, 'VERT', 28, 82, 10, PALETTE.hudDim);
    value(ctx, `${vsFpm >= 0 ? '+' : ''}${vsFpm} fpm`, 28, 102, 13, vsFpm < -600 ? PALETTE.hudRed : PALETTE.hudInk);
    label(ctx, 'HDG', 150, 82, 10, PALETTE.hudDim);
    value(ctx, headingText(hdgDeg), 150, 102, 13, PALETTE.hudInk);
    drawCompass(139, 132, hdgDeg, 210);

    // Top-right mission panel.
    const mission = s.mission;
    panel(ctx, w - 264, 12, 250, 108);
    label(ctx, mission.name.toUpperCase(), w - 250, 34, 10, PALETTE.hudDim);
    value(ctx, `${s.score.toLocaleString('en-US')} pts`, w - 250, 58, 20, PALETTE.hudInk);
    label(ctx, `RINGS ${s.ringsGot}/${s.rings.length}`, w - 250, 82, 11, PALETTE.hudInk);
    label(ctx, s.phase === 'landed' ? 'ON THE GROUND — refuelled' : s.message, w - 250, 102, 11, PALETTE.hudAmber);
    // Fuel bar.
    const fuelColor = s.fuel < 20 ? PALETTE.hudRed : s.fuel < 45 ? PALETTE.hudAmber : PALETTE.hudGreen;
    drawBar(w - 40, 130, 14, 90, s.fuel / 100, fuelColor, 'FUEL');
    label(ctx, `${Math.round(s.fuel)}%`, w - 33, 236, 10, fuelColor, 'center');
    if (mission.timeLimit > 0) {
      const t = Math.max(0, Math.ceil(s.timeLeft));
      value(ctx, `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, w - 250, 140, 22, t < 30 ? PALETTE.hudRed : PALETTE.hudInk);
      label(ctx, 'TIME LEFT', w - 250, 158, 10, PALETTE.hudDim);
    }

    // Bottom-left attitude indicator, bottom-right dials.
    drawAttitude(78, h - 82, 56, p.pitch, p.roll);
    drawDial(w - 170, h - 82, 52, altFt / 3000, 'ALT', 'x1000 ft', '#7fd0ff');
    drawDial(w - 78, h - 82, 52, spdKt / 200, 'AIRSPEED', 'knots', '#ffc93c');
    // Throttle bar, left edge.
    drawBar(14, h - 190, 12, 110, p.throttle, '#7be495', 'THR');
    label(ctx, `${Math.round(p.throttle * 100)}%`, 20, h - 196, 10, PALETTE.hudInk, 'center');

    // Centre marker.
    ctx.strokeStyle = 'rgba(234, 246, 255, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.52, 9, 0, TAU);
    ctx.moveTo(w / 2 - 16, h * 0.52);
    ctx.lineTo(w / 2 - 9, h * 0.52);
    ctx.moveTo(w / 2 + 9, h * 0.52);
    ctx.lineTo(w / 2 + 16, h * 0.52);
    ctx.stroke();

    // Warnings.
    const warnings = [];
    if (stalled) warnings.push('STALL — NOSE DOWN, POWER UP');
    if (s.fuel > 0 && s.fuel < 20) warnings.push('LOW FUEL');
    if (s.damage >= 25) warnings.push('AIRFRAME DAMAGED');
    if (s.phase === 'flying' && p.y < 40 && p.vy < -6) warnings.push('PULL UP — TERRAIN');
    if (warnings.length > 0) {
      const blink = Math.floor(performance.now() / 350) % 2 === 0;
      if (blink) {
        ctx.font = '700 17px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = PALETTE.hudRed;
        ctx.fillText(warnings[0], w / 2, 168);
      }
    }

    // Objective line under the compass.
    if (s.phase === 'flying') {
      const next = s.ringIndex < s.rings.length
        ? `Fly through ring ${s.ringIndex + 1} of ${s.rings.length}`
        : `All rings done — land at ${s.mission.landAt === 'gull' ? 'Gull Island' : 'Coral Home'}`;
      label(ctx, next, w / 2, 196, 13, PALETTE.hudInk, 'center', '600');
    }
  }

  function dim(w, h, alpha = 0.45) {
    ctx.fillStyle = `rgba(4, 12, 22, ${alpha})`;
    ctx.fillRect(0, 0, w, h);
  }

  function bigTitle(w, h, title, sub) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff7e8';
    ctx.font = '800 64px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(255, 122, 77, 0.8)';
    ctx.shadowBlur = 26;
    ctx.fillText(title, w / 2, h * 0.22);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(sub, w / 2, h * 0.22 + 34);
  }

  function drawTitle(world, w, h, best) {
    dim(w, h, 0.5);
    bigTitle(w, h, 'SKY COURIER', 'C O R A L   R U N');
    label(ctx, 'A little prop plane, a whole archipelago, and a mailbag full of nerve.', w / 2, h * 0.22 + 66, 15, PALETTE.hudInk, 'center');
    // Mission cards.
    const cardW = 250;
    const gap = 18;
    const total = cardW * 3 + gap * 2;
    let x = (w - total) / 2;
    const y = h * 0.36;
    MISSIONS.forEach((m, i) => {
      panel(ctx, x, y, cardW, 128);
      label(ctx, `${i + 1} · ${m.name.toUpperCase()}`, x + 16, y + 26, 13, PALETTE.hudAmber);
      ctx.font = '500 13px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.hudInk;
      ctx.textAlign = 'left';
      wrapText(ctx, m.brief, x + 16, y + 48, cardW - 32, 18);
      label(ctx, m.timeLimit > 0 ? `Timed · ${m.timeLimit}s` : `${m.rings} rings`, x + 16, y + 108, 11, PALETTE.hudDim);
      x += cardW + gap;
    });
    label(ctx, 'ARROWS / WASD — pitch & bank      SHIFT / CTRL or WHEEL — throttle', w / 2, h * 0.36 + 158, 14, PALETTE.hudInk, 'center');
    label(ctx, 'MOUSE — steer toward the cursor      P — pause      M — mute      R — restart', w / 2, h * 0.36 + 182, 14, PALETTE.hudInk, 'center');
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 350);
    ctx.globalAlpha = pulse;
    label(ctx, 'PRESS ENTER OR CLICK TO FLY  —  or press 1, 2, 3 to pick a sortie', w / 2, h * 0.36 + 224, 16, '#fff7d6', 'center', '800');
    ctx.globalAlpha = 1;
    if (best > 0) label(ctx, `Best score: ${best.toLocaleString('en-US')} pts`, w / 2, h * 0.36 + 252, 13, PALETTE.hudDim, 'center');
    label(ctx, 'Fly the rings, mind the fuel, and bring her home in one piece.', w / 2, h - 26, 12, PALETTE.hudDim, 'center');
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, cy);
        line = word;
        cy += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, cy);
  }

  function statsBlock(world, w, y0) {
    const s = world.state;
    const rows = [
      ['Score', s.score.toLocaleString('en-US')],
      ['Rings flown', `${s.ringsGot} / ${s.rings.length}`],
      ['Fuel left', `${Math.round(s.fuel)}%`],
      ['Flight time', `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`],
      ['Sortie', s.mission.name],
    ];
    let y = y0;
    for (const [k, v] of rows) {
      label(ctx, k, w / 2 - 130, y, 14, PALETTE.hudDim);
      value(ctx, v, w / 2 + 130, y, 14, PALETTE.hudInk, 'right');
      y += 26;
    }
    return y;
  }

  function drawPaused(w, h) {
    dim(w, h, 0.55);
    label(ctx, 'PAUSED', w / 2, h * 0.42, 44, '#fff7e8', 'center', '800');
    label(ctx, 'Press P or Enter to keep flying · M to mute · R to restart', w / 2, h * 0.42 + 34, 15, PALETTE.hudInk, 'center');
  }

  function drawOver(world, w, h, best) {
    dim(w, h, 0.55);
    const s = world.state;
    label(ctx, s.crashReason || 'CRASHED', w / 2, h * 0.2, 40, PALETTE.hudRed, 'center', '800');
    label(ctx, 'The coral mail will have to wait for another pilot.', w / 2, h * 0.2 + 32, 15, PALETTE.hudInk, 'center');
    const y = statsBlock(world, w, h * 0.34);
    if (s.score > 0 && s.score >= best) {
      label(ctx, 'NEW BEST SCORE', w / 2, y + 22, 15, PALETTE.hudGreen, 'center', '800');
    } else if (best > 0) {
      label(ctx, `Best score: ${best.toLocaleString('en-US')} pts`, w / 2, y + 22, 13, PALETTE.hudDim, 'center');
    }
    label(ctx, 'Press ENTER or R to fly again', w / 2, y + 62, 16, '#fff7d6', 'center', '800');
  }

  function drawDone(world, w, h, best, wonAll) {
    dim(w, h, 0.5);
    const s = world.state;
    label(ctx, wonAll ? 'COURIER LEGEND' : 'SORTIE COMPLETE', w / 2, h * 0.2, 40, PALETTE.hudGreen, 'center', '800');
    label(
      ctx,
      wonAll
        ? 'All three sorties flown and every parcel delivered. The archipelago salutes you.'
        : `${s.mission.name} done — ${s.mission.landAt === 'gull' ? 'Gull Island' : 'Coral Home'} reached, mail delivered.`,
      w / 2, h * 0.2 + 32, 15, PALETTE.hudInk, 'center',
    );
    const y = statsBlock(world, w, h * 0.34);
    if (s.score >= best && s.score > 0) {
      label(ctx, 'NEW BEST SCORE', w / 2, y + 22, 15, PALETTE.hudGreen, 'center', '800');
    }
    const next = wonAll ? 'Press ENTER to fly again' : 'Press ENTER for the next sortie · R to replay this one';
    label(ctx, next, w / 2, y + 62, 16, '#fff7d6', 'center', '800');
  }

  return { drawHud, drawTitle, drawPaused, drawOver, drawDone };
}
