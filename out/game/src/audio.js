// Sound, synthesised live with WebAudio: no audio files, nothing to load.
// Footsteps tick as you move, a coin rings when it lands, a rising sting marks the alarm,
// a chime marks a ledger, and a short phrase marks winning or losing. M toggles it.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      context = new AC();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = null) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx || ctx.state === 'suspended') return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    /** Resume the context after the first user gesture; call on confirm. */
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    footstep(sneaking) {
      tone(sneaking ? 190 : 140, 0.05, 'triangle', sneaking ? 0.015 : 0.05);
    },
    coin() {
      tone(1240, 0.35, 'sine', 0.06, 0, 1760);
      tone(1860, 0.25, 'sine', 0.03, 0.05);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.07);
      tone(990, 0.2, 'sine', 0.07, 0.09);
    },
    alarm() {
      tone(220, 0.5, 'sawtooth', 0.05, 0, 440);
      tone(330, 0.4, 'sawtooth', 0.04, 0.12, 520);
    },
    caught() {
      tone(196, 0.5, 'sawtooth', 0.06, 0, 98);
    },
    levelClear() {
      tone(523, 0.15, 'sine', 0.07);
      tone(659, 0.15, 'sine', 0.07, 0.12);
      tone(784, 0.3, 'sine', 0.07, 0.24);
    },
    win() {
      tone(523, 0.18, 'sine', 0.07);
      tone(659, 0.18, 'sine', 0.07, 0.15);
      tone(784, 0.18, 'sine', 0.07, 0.3);
      tone(1046, 0.4, 'sine', 0.07, 0.45);
    },
  };
}
