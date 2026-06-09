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

/** Plays a two-note "ding-dong" chime. Safe to call repeatedly. */
export function playOrderChime() {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();

  const now = audio.currentTime;
  // Two notes: higher then lower, each a short bell-like blip.
  [
    { freq: 988, start: 0 },    // B5
    { freq: 740, start: 0.16 }, // F#5
  ].forEach(({ freq, start }) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + start;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}
