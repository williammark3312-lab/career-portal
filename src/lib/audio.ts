/**
 * Synthesizes a warm, pleasant, high-end tech chime using Web Audio API.
 * No external asset fetching or audio files required.
 */
export function playPleasantLoginSound() {
  if (typeof window === "undefined") return;

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Master volume & filter for warmth
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.22, now + 0.04);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2000, now);

    masterGain.connect(filter);
    filter.connect(ctx.destination);

    // Warm Major 7th chord chime sequence: Eb5 (622.25Hz), G5 (783.99Hz), Bb5 (932.33Hz), D6 (1174.66Hz), Eb6 (1244.51Hz)
    const notes = [
      { freq: 622.25, delay: 0.0, duration: 1.2, type: "sine" as OscillatorType },
      { freq: 783.99, delay: 0.05, duration: 1.1, type: "sine" as OscillatorType },
      { freq: 932.33, delay: 0.10, duration: 1.0, type: "sine" as OscillatorType },
      { freq: 1174.66, delay: 0.15, duration: 0.9, type: "sine" as OscillatorType },
      { freq: 1244.51, delay: 0.20, duration: 0.8, type: "sine" as OscillatorType },
    ];

    notes.forEach(({ freq, delay, duration, type }) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + delay);

      noteGain.gain.setValueAtTime(0, now + delay);
      noteGain.gain.linearRampToValueAtTime(0.18, now + delay + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(now + delay);
      osc.stop(now + delay + duration + 0.1);
    });
  } catch (err) {
    console.error("Audio playback error:", err);
  }
}
