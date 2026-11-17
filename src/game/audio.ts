/**
 * Glass chimes through a tiny mixer. All resume() calls stay inside the
 * user-gesture stack so iOS actually unlocks sound.
 */
export type AudioBus = {
  unlock: () => void;
  resume: () => void;
  setMuted: (muted: boolean) => void;
  place: (layer: number, perfect: boolean) => void;
  miss: () => void;
  begin: () => void;
  title: (index: number) => void;
  chance: () => void;
  destroy: () => void;
};

const SEMI = [0, 2, 4, 7, 9];

function freqFor(layer: number) {
  const semi = SEMI[layer % 5] + Math.min(2, Math.floor(layer / 5)) * 12;
  return 261.63 * 2 ** ((semi - 12) / 12);
}

export function createAudio(): AudioBus {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfx: GainNode | null = null;
  let music: GainNode | null = null;
  let muted = false;
  let drone: OscillatorNode[] = [];
  let dead = false;

  function ensure() {
    if (dead) return null;
    if (ctx) return ctx;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC({ latencyHint: "interactive" });
    } catch {
      return null;
    }
    master = ctx.createGain();
    sfx = ctx.createGain();
    music = ctx.createGain();
    sfx.gain.value = 0.9;
    music.gain.value = 0.22;
    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);
    master.gain.value = muted ? 0 : 1;
    return ctx;
  }

  function applyMute() {
    if (!ctx || !master) return;
    master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.03);
  }

  function startDrone() {
    if (!ctx || !music || drone.length || muted) return;
    const base = ctx.currentTime;
    for (const freq of [110, 164.81]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, base);
      gain.gain.exponentialRampToValueAtTime(0.045, base + 0.6);
      osc.connect(gain);
      gain.connect(music);
      osc.start();
      drone.push(osc);
    }
  }

  function tone(freq: number, dur: number, type: OscillatorType, gainValue: number, delay = 0) {
    if (muted || !ctx || !sfx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const wobble = 1 + (Math.random() * 2 - 1) * 0.012;
    osc.frequency.exponentialRampToValueAtTime(freq * wobble, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  function noise(dur: number, gainValue: number) {
    if (muted || !ctx || !sfx) return;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfx);
    src.start();
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  return {
    unlock() {
      const audio = ensure();
      if (!audio) return;
      if (audio.state === "suspended") void audio.resume();
      applyMute();
      startDrone();
    },
    resume() {
      if (ctx && ctx.state === "suspended") void ctx.resume();
    },
    setMuted(next) {
      muted = next;
      if (!ctx) return;
      if (!next) {
        if (ctx.state === "suspended") void ctx.resume();
        startDrone();
      }
      applyMute();
    },
    place(layer, perfect) {
      const f = freqFor(layer);
      tone(f, perfect ? 0.28 : 0.16, "sine", perfect ? 0.16 : 0.12);
      tone(f * 2.01, 0.09, "triangle", 0.05);
      if (perfect) {
        tone(f * 1.5, 0.32, "sine", 0.1, 0.06);
        tone(f * 2, 0.36, "sine", 0.06, 0.1);
      }
    },
    miss() {
      noise(0.28, 0.22);
      tone(92, 0.34, "sine", 0.22);
      tone(54, 0.42, "triangle", 0.1, 0.03);
    },
    begin() {
      noise(0.18, 0.08);
      tone(196, 0.12, "sine", 0.06);
    },
    title(index) {
      const base = 392 * 2 ** (Math.min(index, 5) / 12);
      tone(base, 0.5, "sine", 0.14);
      tone(base * 1.25, 0.5, "sine", 0.1, 0.1);
      tone(base * 1.5, 0.6, "sine", 0.1, 0.2);
      tone(base * 2, 0.7, "triangle", 0.06, 0.3);
    },
    chance() {
      tone(330, 0.3, "sine", 0.12);
      tone(247, 0.4, "triangle", 0.08, 0.08);
    },
    destroy() {
      dead = true;
      for (const osc of drone) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          /* already stopped */
        }
      }
      drone = [];
      void ctx?.close();
      ctx = null;
    },
  };
}
