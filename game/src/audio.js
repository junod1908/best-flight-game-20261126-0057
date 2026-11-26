// Synthesised sound, no audio files: a low engine hum (oscillator + filtered noise) and a
// water-drop whoosh. Created lazily on the first user gesture so autoplay rules never block.
export function createAudio() {
  const audio = { ctx: null, muted: false, engine: null, engineGain: null, noise: null };
  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    audio.ctx = ctx;
    // Engine hum: two detuned saws through a low-pass filter.
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 62;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 93;
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start();
    audio.engine = [osc1, osc2];
    audio.engineGain = gain;
    audio.engineFilter = filter;
  };
  // Called every frame while flying: pitch and volume follow throttle and speed.
  audio.update = (throttle, speed) => {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    audio.engineGain.gain.setTargetAtTime(0.05 + throttle * 0.09, t, 0.1);
    audio.engine[0].frequency.setTargetAtTime(52 + throttle * 48 + speed * 0.2, t, 0.1);
    audio.engine[1].frequency.setTargetAtTime(78 + throttle * 72 + speed * 0.3, t, 0.1);
  };
  // Short filtered-noise whoosh when the tank opens.
  audio.whoosh = () => {
    if (!audio.ctx || audio.muted) return;
    const ctx = audio.ctx;
    const dur = 0.7;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  };
  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (audio.engineGain) audio.engineGain.gain.value = audio.muted ? 0 : 0.08;
    return audio.muted;
  };
  return audio;
}
