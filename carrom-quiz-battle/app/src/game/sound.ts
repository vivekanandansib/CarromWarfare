// Synthesized sound effects (WebAudio, no assets). All calls are safe no-ops
// when audio is unavailable.
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function beep(freq: number, durMs: number, delayMs = 0, type: OscillatorType = 'sine', gain = 0.12): void {
  const c = ac();
  if (!c) return;
  try {
    const t = c.currentTime + delayMs / 1000;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + durMs / 1000);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + durMs / 1000);
  } catch {
    /* ignore */
  }
}

export const sound = {
  select() {
    beep(520, 90, 0, 'triangle', 0.08);
  },
  tick() {
    beep(990, 60, 0, 'square', 0.05);
  },
  /** Striker flick. */
  strike() {
    beep(190, 70, 0, 'triangle', 0.16);
    beep(340, 60, 30, 'triangle', 0.1);
  },
  /** Coin rattling into the pocket. */
  rattle() {
    beep(880, 60, 0, 'triangle', 0.1);
    beep(620, 60, 60, 'triangle', 0.1);
    beep(470, 90, 120, 'triangle', 0.1);
    beep(700, 120, 190, 'sine', 0.08);
  },
  correct() {
    beep(523, 120, 0, 'sine');
    beep(784, 160, 110, 'sine');
  },
  wrong() {
    beep(220, 200, 0, 'sawtooth', 0.07);
    beep(160, 240, 150, 'sawtooth', 0.07);
  },
  pocket() {
    beep(880, 80, 0, 'triangle', 0.1);
    beep(440, 120, 70, 'triangle', 0.1);
    beep(660, 140, 150, 'triangle', 0.08);
  },
  queen() {
    beep(659, 120, 0, 'sine');
    beep(880, 120, 110, 'sine');
    beep(1174, 220, 220, 'sine');
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => beep(f, 200, i * 150, 'triangle', 0.1));
  },
};
