// Sound: everything is synthesized with the Web Audio API. Engine follows
// RPM and load, sirens wail in two tones, the rotor thumps, the harbor hums,
// and three small radio stations play procedurally. Nothing is downloaded.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioGain = null;
  let radioTimer = null;
  let station = 0; // 0 off, 1 dusk drive, 2 harbor nights, 3 marina talk
  let unlocked = false;
  const STATIONS = ['Off', 'Dusk Drive', 'Harbor Nights', 'Marina Talk'];

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 700;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    radioGain = ctx.createGain();
    radioGain.gain.value = 0;
    radioGain.connect(master);
    unlocked = true;
  }

  function unlock() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function blip(freq, dur, vol, type = 'sine') {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur);
  }
  function noiseBurst(dur, vol, freq = 800) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  }

  // Radio: a small step sequencer per station, scheduled ahead.
  const SCALES = {
    1: [110, 130.8, 164.8, 196, 220, 261.6],
    2: [98, 116.5, 146.8, 174.6, 196, 233.1],
    3: [87.3, 110, 130.8, 164.8, 196, 220],
  };
  function radioTick() {
    if (!ctx || station === 0) return;
    const scale = SCALES[station];
    const step = Math.floor(Math.random() * 8);
    if (step % 2 === 0) {
      const note = scale[Math.floor(Math.random() * scale.length)];
      blip(note, 0.5, 0.12, station === 2 ? 'triangle' : 'square');
      if (Math.random() < 0.3) blip(note / 2, 0.7, 0.1, 'sine');
    }
    if (station === 1 && step === 4) noiseBurst(0.08, 0.05, 3000);
  }

  return {
    get stationName() { return STATIONS[station]; },
    unlock,
    cycleStation() {
      station = (station + 1) % STATIONS.length;
      if (station === 0) {
        if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
        if (radioGain) radioGain.gain.value = 0;
      } else if (!radioTimer) {
        radioTimer = setInterval(radioTick, 260);
        if (radioGain) radioGain.gain.value = 0.5;
      }
      return STATIONS[station];
    },
    setStation(n) { station = n % STATIONS.length; },
    engine(rpm, load) {
      if (!ctx) return;
      engineOsc.frequency.setTargetAtTime(55 + rpm * 160, ctx.currentTime, 0.05);
      engineGain.gain.setTargetAtTime(0.02 + load * 0.05, ctx.currentTime, 0.08);
    },
    siren(on, t) {
      if (!ctx) return;
      if (!on) { sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); return; }
      sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
      sirenOsc.frequency.setTargetAtTime(Math.sin(t * 2.4) > 0 ? 740 : 540, ctx.currentTime, 0.05);
    },
    rotor(on, t) {
      if (!ctx || !on) return;
      if (Math.sin(t * 22) > 0.92) noiseBurst(0.03, 0.03, 400);
    },
    gunshot() { noiseBurst(0.16, 0.5, 2400); blip(160, 0.1, 0.3, 'square'); },
    impact(strength) { noiseBurst(0.2, Math.min(0.5, strength * 0.2), 500); },
    skid(on) {
      if (!ctx) return;
      if (on && Math.random() < 0.3) noiseBurst(0.05, 0.04, 5000);
    },
    click() { blip(880, 0.06, 0.15); },
    mission() { blip(523, 0.12, 0.2); setTimeout(() => blip(784, 0.18, 0.2), 120); },
    fail() { blip(220, 0.3, 0.2, 'sawtooth'); },
    get unlocked() { return unlocked; },
  };
}
