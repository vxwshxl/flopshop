// Plays a short notification chime using the Web Audio API — no audio file
// needed. Used to alert admin/delivery dashboards when a new delivery order
// arrives. Browsers may keep the audio context suspended until the user has
// interacted with the page, so we resume() before playing.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/**
 * Plays an attention-grabbing "ding-dong" that rings several times at near-max
 * volume — used when the open dashboard receives a new order. `repeats` controls
 * how many times the two-note pattern rings. Safe to call repeatedly.
 */
export function playOrderChime(repeats = 3) {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();

  // Master gain near full-scale = as loud as the device allows.
  const master = audio.createGain();
  master.gain.value = 0.95;
  master.connect(audio.destination);

  const now = audio.currentTime;
  const pattern = [
    { freq: 988, start: 0 }, // B5
    { freq: 740, start: 0.16 }, // F#5
  ];

  for (let r = 0; r < repeats; r++) {
    const base = now + r * 0.55;
    pattern.forEach(({ freq, start }) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = base + start;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(1.0, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }
}
