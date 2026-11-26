// All sound is synthesized with WebAudio: no audio files, no network.
// An engine drone follows the throttle, wind follows the speed, and short
// blips mark rings, warnings, touchdowns and crashes.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      engineOsc1 = ctx.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc1.frequency.value = 70;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 35;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc1.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc1.start();
      engineOsc2.start();

      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 600;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  // Call every frame while flying: the drone and the wind track the plane.
  function update(throttle, speed01, stalled) {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    const base = 55 + throttle * 75 + (stalled ? -18 : 0);
    engineOsc1.frequency.setTargetAtTime(base, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(base * 0.5 + 3, t, 0.08);
    engineGain.gain.setTargetAtTime(0.05 + throttle * 0.075, t, 0.1);
    windGain.gain.setTargetAtTime(0.015 + speed01 * 0.11, t, 0.12);
    windFilter.frequency.setTargetAtTime(380 + speed01 * 900, t, 0.15);
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!started || !ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function ring() {
    blip(880, 0.22, 'sine', 0.32);
    blip(1318, 0.3, 'sine', 0.28, 0.07);
    blip(1760, 0.36, 'sine', 0.2, 0.14);
  }

  function warn() {
    blip(620, 0.12, 'square', 0.12);
    blip(620, 0.12, 'square', 0.12, 0.18);
  }

  function thud() {
    blip(90, 0.25, 'sine', 0.5);
    blip(55, 0.35, 'triangle', 0.4, 0.02);
  }

  function crash() {
    if (!started || !ctx) return;
    const t0 = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = windSource.buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t0);
    filter.frequency.exponentialRampToValueAtTime(120, t0 + 0.8);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(t0);
    noise.stop(t0 + 1);
    blip(70, 0.8, 'sawtooth', 0.3);
  }

  function fanfare() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => blip(freq, 0.35, 'triangle', 0.25, i * 0.11));
  }

  function setMuted(value) {
    muted = value;
    if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.05);
  }

  function isMuted() {
    return muted;
  }

  return { resume, update, ring, warn, thud, crash, fanfare, setMuted, isMuted };
}
