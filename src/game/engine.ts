import { createAudio, type AudioBus } from "@/game/audio";
import { bestFor, loadSave, writeSave, type Difficulty, type Palette } from "@/game/save";

export type { Difficulty, Palette };

export type Phase = "menu" | "play" | "over";
export type Mode = "free" | "daily";

export type DifficultySpec = {
  label: string;
  note: string;
  /** Multiplies the mover's sway speed. */
  speed: number;
  /** Share of the pane below a drop must land on to survive. */
  slack: number;
  /** Width of the perfect window, as a share of the pane below. */
  perfect: number;
  /** Starting pane size, relative to the standard slab. */
  startScale: number;
  secondChance: boolean;
};

export const DIFFICULTIES: Record<Difficulty, DifficultySpec> = {
  easy: {
    label: "Easy",
    note: "Wide panes, gentler sway, forgiving edges, one second chance.",
    speed: 0.78,
    slack: 0.06,
    perfect: 0.2,
    startScale: 1.05,
    secondChance: true,
  },
  medium: {
    label: "Medium",
    note: "The tide as designed.",
    speed: 1,
    slack: 0.12,
    perfect: 0.1,
    startScale: 1,
    secondChance: true,
  },
  hard: {
    label: "Hard",
    note: "Quick sway, a tight perfect window, no second chance.",
    speed: 1.28,
    slack: 0.16,
    perfect: 0.065,
    startScale: 0.94,
    secondChance: false,
  },
};

export const TITLES: [number, string][] = [
  [0, "Shoreline"],
  [5, "Jetty"],
  [12, "Lantern"],
  [25, "Moonpier"],
  [40, "Skyreef"],
  [60, "Tidecrown"],
];

function titleIndex(drops: number) {
  let at = 0;
  for (let i = 0; i < TITLES.length; i++) if (drops >= TITLES[i][0]) at = i;
  return at;
}

export type Snapshot = {
  phase: Phase;
  score: number;
  best: number;
  difficulty: Difficulty;
  palette: Palette;
  /** Score multiplier banked for this run. */
  boost: number;
  combo: number;
  sound: boolean;
  shake: boolean;
  crowned: boolean;
  mode: Mode;
  title: string;
  drops: number;
  seconds: number;
  maxCombo: number;
  perfects: number;
  second: boolean;
};

export const INITIAL_SNAPSHOT: Snapshot = {
  phase: "menu",
  score: 0,
  best: 0,
  difficulty: "medium",
  palette: "shore",
  boost: 1,
  combo: 0,
  sound: true,
  shake: true,
  crowned: false,
  mode: "free",
  title: "Shoreline",
  drops: 0,
  seconds: 0,
  maxCombo: 0,
  perfects: 0,
  second: true,
};

export type Game = {
  begin: () => void;
  drop: () => void;
  setMode: (mode: Mode) => void;
  setDifficulty: (next: Difficulty) => void;
  setPalette: (next: Palette) => void;
  /** Resume an ended run from the move that missed. False when nothing to resume. */
  revive: () => boolean;
  setGate: (gate: () => boolean) => void;
  toggleSound: () => void;
  toggleShake: () => void;
  destroy: () => void;
};

type RGB = [number, number, number];
type Kind = "wood" | "glass";
type Axis = "x" | "z";
type Pt = [number, number];

type Block = {
  x: number;
  z: number;
  y: number;
  w: number;
  d: number;
  thick: number;
  kind: Kind;
  layer: number;
  settle: number;
  flash: number;
};

type Shard = {
  x: number;
  z: number;
  y: number;
  w: number;
  d: number;
  thick: number;
  kind: Kind;
  layer: number;
  vy: number;
  vx: number;
  vz: number;
  rot: number;
  vr: number;
  life: number;
};

type Floater = { text: string; x: number; y: number; life: number; perfect: boolean; edge?: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
type Ring = { x: number; y: number; life: number };

type Mover = {
  x: number;
  z: number;
  y: number;
  w: number;
  d: number;
  axis: Axis;
  phase: number;
  originX: number;
  originZ: number;
  k: number;
};

const THICK = 0.56;
const SLAB = 2.05;
const PIER = 2.75;
const HOVER = 0.18;
const VY = 1.08;

/** Glass tints. Gift days unlock the three beyond `shore`. */
export const PALETTES: Record<Palette, { label: string; colors: RGB[] }> = {
  shore: {
    label: "Shore",
    colors: [
      [232, 156, 96],
      [214, 112, 102],
      [232, 196, 154],
      [78, 184, 168],
      [64, 142, 176],
      [186, 206, 216],
    ],
  },
  moon: {
    label: "Moon",
    colors: [
      [186, 206, 216],
      [140, 176, 200],
      [104, 140, 176],
      [78, 110, 150],
      [200, 220, 230],
      [120, 160, 190],
    ],
  },
  ember: {
    label: "Ember",
    colors: [
      [232, 150, 96],
      [214, 98, 84],
      [232, 196, 140],
      [196, 120, 80],
      [168, 72, 64],
      [240, 180, 120],
    ],
  },
  moss: {
    label: "Moss",
    colors: [
      [120, 168, 120],
      [78, 144, 116],
      [168, 196, 150],
      [96, 128, 96],
      [60, 104, 88],
      [190, 214, 170],
    ],
  },
};

const WOOD: RGB = [138, 86, 52];
const POST: RGB = [96, 62, 40];

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgb(c: RGB, a = 1) {
  const r = Math.round(Math.max(0, Math.min(255, c[0])));
  const g = Math.round(Math.max(0, Math.min(255, c[1])));
  const b = Math.round(Math.max(0, Math.min(255, c[2])));
  return a < 1 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`;
}

function tri(phase: number) {
  const t = ((phase % 2) + 2) % 2;
  const up = t < 1 ? t : 2 - t;
  return up * 2 - 1;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type TideglassDebug = {
  getState: () => Snapshot & { blocks: number; hasMover: boolean; resolving: boolean };
  begin: () => void;
  drop: () => void;
  dropPerfect: () => void;
  dropMiss: () => void;
};

declare global {
  interface Window {
    __tideglass?: TideglassDebug;
  }
}

export function createGame(
  canvas: HTMLCanvasElement,
  root: HTMLElement,
  onChange: (snap: Snapshot) => void,
): Game {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const save = loadSave();
  const audio: AudioBus = createAudio();

  let phase: Phase = "menu";
  let score = 0;
  let difficulty: Difficulty = save.difficulty;
  let palette: Palette = save.palette;
  let boost = save.boost > 1 ? save.boost : 1;
  // The mover that missed, kept so a key can resume the run from it.
  let pendingRevive: Mover | null = null;
  let best = bestFor(save, difficulty);
  let combo = 0;
  let sound = save.sound;
  let shake = save.shake ?? !reduced;
  let shakeTouched = save.shake !== null;
  let crowned = false;
  let mode: Mode = "free";
  let drops = 0;
  let seconds = 0;
  let maxCombo = 0;
  let perfects = 0;
  let secondUsed = false;
  let gate: () => boolean = () => true;
  let titleAt = 0;
  let runStartedAt = 0;
  let stack: Block[] = [];
  let shards: Shard[] = [];
  let sparks: Spark[] = [];
  let floaters: Floater[] = [];
  let rings: Ring[] = [];
  let mover: Mover | null = null;
  let landing = 0;
  let resolving = false;
  let overTimer = 0;
  let inputLock = 0;
  let camY = 0;
  let trauma = 0;
  let dead = false;
  let raf = 0;
  let last = performance.now();

  const rand = mulberry32(0x71de);
  const stars = Array.from({ length: 42 }, () => ({
    x: rand(),
    y: rand() * 0.62,
    r: rand() * 1.25 + 0.35,
    tw: rand() * Math.PI * 2,
  }));

  audio.setMuted(!sound);

  function glassColor(layer: number): RGB {
    const colors = PALETTES[palette].colors;
    const i = ((layer % colors.length) + colors.length) % colors.length;
    return colors[i];
  }

  function glassCount() {
    let n = 0;
    for (const b of stack) if (b.kind === "glass") n++;
    return n;
  }

  function lastGlass() {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].kind === "glass") return stack[i];
    }
    return null;
  }

  function footprint() {
    const glass = lastGlass();
    if (glass) {
      return { x: glass.x, z: glass.z, w: glass.w, d: glass.d, yTop: glass.y + glass.thick };
    }
    const pier = stack[0];
    return { x: 0, z: 0, w: SLAB, d: SLAB, yTop: pier.y + pier.thick };
  }

  function perfectTol(size: number) {
    return Math.max(0.05, size * DIFFICULTIES[difficulty].perfect);
  }

  function makeBase(): Block {
    return {
      x: 0,
      z: 0,
      y: -0.22,
      w: PIER,
      d: PIER,
      thick: 0.22,
      kind: "wood",
      layer: -1,
      settle: 0,
      flash: 0,
    };
  }

  function foundation(): Block {
    const size = SLAB * DIFFICULTIES[difficulty].startScale;
    return {
      x: 0,
      z: 0,
      y: 0,
      w: size,
      d: size,
      thick: THICK,
      kind: "glass",
      layer: 0,
      settle: 0,
      flash: 0,
    };
  }

  function daySeed() {
    const day = new Date().toISOString().slice(0, 10);
    let h = 2166136261;
    for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function layerRand(layer: number, salt: number) {
    return mulberry32((daySeed() ^ Math.imul(layer + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0)();
  }

  function spawnMover() {
    const fp = footprint();
    const count = glassCount();
    const seeded = mode === "daily" && phase === "play";
    mover = {
      x: fp.x,
      z: fp.z,
      y: fp.yTop,
      w: fp.w,
      d: fp.d,
      axis: count % 2 === 0 ? "x" : "z",
      phase: seeded ? 0.5 + layerRand(count, 1) * 2 : 0.5,
      originX: fp.x,
      originZ: fp.z,
      k: seeded ? 0.85 + layerRand(count, 2) * 0.35 : 1,
    };
  }

  function buildAttract() {
    stack = [makeBase()];
    let w = SLAB;
    let d = SLAB;
    for (let i = 0; i < 5; i++) {
      const prev = stack[stack.length - 1];
      if (i % 2 === 0) w *= 0.88;
      else d *= 0.88;
      stack.push({
        x: 0,
        z: 0,
        y: prev.y + prev.thick,
        w,
        d,
        thick: THICK,
        kind: "glass",
        layer: i,
        settle: 0,
        flash: 0,
      });
    }
    spawnMover();
    camY = mover ? mover.y : 0;
  }

  function persist() {
    const current = loadSave();
    writeSave({
      version: 1,
      best: difficulty === "medium" ? best : current.best,
      bests: { ...current.bests, [difficulty]: best },
      difficulty,
      palette,
      sound,
      shake: shakeTouched ? shake : null,
    });
  }

  function snap(): Snapshot {
    return {
      phase,
      score,
      best,
      difficulty,
      palette,
      boost,
      combo,
      sound,
      shake,
      crowned,
      mode,
      title: TITLES[titleAt][1],
      drops,
      seconds,
      maxCombo,
      perfects,
      second: DIFFICULTIES[difficulty].secondChance && !secondUsed,
    };
  }

  function notify() {
    if (!dead) onChange(snap());
  }

  function buzz(ms: number) {
    if (!shake || reduced) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* unsupported */
    }
  }

  function view() {
    return {
      w: Math.max(1, canvas.clientWidth),
      h: Math.max(1, canvas.clientHeight),
    };
  }

  function metrics(time: number) {
    const { w, h } = view();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const mag = !shake || reduced ? 0 : trauma * trauma;
    const shakeX = Math.sin(time * 47) * 14 * mag;
    const shakeY = Math.cos(time * 39) * 10 * mag;
    const S = Math.min(96, Math.min(w, h) * 0.148);
    return {
      w,
      h,
      dpr,
      S,
      ox: w / 2 + shakeX,
      oy: h * 0.5 + shakeY,
    };
  }

  function project(x: number, y: number, z: number, m: ReturnType<typeof metrics>): Pt {
    return [
      m.ox + (x - z) * m.S,
      m.oy + (x + z) * m.S * 0.5 - (y - camY) * m.S * VY,
    ];
  }

  function crumble() {
    for (const b of stack) {
      if (b.kind !== "glass") continue;
      shards.push({
        x: b.x,
        z: b.z,
        y: b.y,
        w: b.w,
        d: b.d,
        thick: b.thick,
        kind: "glass",
        layer: b.layer,
        vy: 0.8 + Math.random() * 1.6,
        vx: (Math.random() - 0.5) * 1.4,
        vz: (Math.random() - 0.5) * 1.4,
        rot: 0,
        vr: (Math.random() - 0.5) * 3.2,
        life: 2.2,
      });
    }
    if (shards.length > 36) shards.splice(0, shards.length - 36);
  }

  function begin() {
    audio.unlock();
    audio.begin();
    crumble();
    // A boost is banked in the save; it applies to the run it was claimed for.
    const fresh = loadSave();
    boost = fresh.boost > 1 ? fresh.boost : 1;
    pendingRevive = null;
    score = 0;
    combo = 0;
    crowned = false;
    drops = 0;
    seconds = 0;
    maxCombo = 0;
    perfects = 0;
    secondUsed = false;
    titleAt = 0;
    runStartedAt = performance.now();
    resolving = false;
    overTimer = 0;
    landing = 0;
    inputLock = 0.28;
    stack = [makeBase(), foundation()];
    phase = "play";
    spawnMover();
    persist();
    notify();
  }

  function pushShard(partial: Omit<Shard, "vy" | "vx" | "vz" | "rot" | "vr" | "life">, sign: number, axis: Axis) {
    shards.push({
      ...partial,
      vy: 0.45,
      vx: axis === "x" ? sign * (0.7 + Math.random() * 0.45) : (Math.random() - 0.5) * 0.2,
      vz: axis === "z" ? sign * (0.7 + Math.random() * 0.45) : (Math.random() - 0.5) * 0.2,
      rot: 0,
      vr: sign * (1.6 + Math.random()),
      life: 1.7,
    });
  }

  function burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = 40 + Math.random() * 90;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0.45 + Math.random() * 0.25,
        max: 0.7,
        color,
      });
    }
    if (sparks.length > 80) sparks.splice(0, sparks.length - 80);
  }

  function drop() {
    if (phase !== "play" || resolving || landing > 0 || inputLock > 0 || !mover) return;
    const fp = footprint();
    const axis = mover.axis;
    const prevC = axis === "x" ? fp.x : fp.z;
    const movC = axis === "x" ? mover.x : mover.z;
    const prevS = axis === "x" ? fp.w : fp.d;
    const movS = axis === "x" ? mover.w : mover.d;
    const prevL = prevC - prevS / 2;
    const prevR = prevC + prevS / 2;
    const movL = movC - movS / 2;
    const movR = movC + movS / 2;
    const left = Math.max(prevL, movL);
    const right = Math.min(prevR, movR);
    const overlap = right - left;
    const tol = perfectTol(prevS);
    const m = metrics(performance.now() / 1000);
    const [sx, sy] = project(mover.x, mover.y + THICK + HOVER, mover.z, m);

    if (overlap <= 0.02 || overlap < prevS * DIFFICULTIES[difficulty].slack) {
      const lost = mover;
      pushShard(
        {
          x: mover.x,
          z: mover.z,
          y: mover.y,
          w: mover.w,
          d: mover.d,
          thick: THICK,
          kind: "glass",
          layer: glassCount(),
        },
        movC >= prevC ? 1 : -1,
        axis,
      );
      mover = null;
      combo = 0;
      if (!secondUsed && DIFFICULTIES[difficulty].secondChance) {
        secondUsed = true;
        landing = 0.7;
        trauma = Math.min(1, trauma + 0.3);
        audio.chance();
        buzz(12);
        floaters.push({ text: "Second chance", x: m.w / 2, y: m.h * 0.3, life: 1.4, perfect: true });
        if (floaters.length > 6) floaters.shift();
        notify();
        return;
      }
      pendingRevive = lost;
      resolving = true;
      overTimer = 0.62;
      trauma = Math.min(1, trauma + 0.62);
      audio.miss();
      buzz(18);
      notify();
      return;
    }

    const perfect = Math.abs(movC - prevC) <= tol;
    let newC = (left + right) / 2;
    let newS = overlap;
    let gain = 1;
    if (perfect) {
      newC = prevC;
      newS = prevS;
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      perfects += 1;
      gain = combo;
      audio.place(glassCount(), true);
      trauma = Math.min(1, trauma + 0.26 + Math.min(0.28, combo * 0.035));
      rings.push({ x: sx, y: sy, life: 1 });
      burst(sx, sy, "rgba(232,243,238,0.95)", 10 + Math.min(8, combo));
      buzz(10);
    } else {
      combo = 0;
      audio.place(glassCount(), false);
      trauma = Math.min(1, trauma + 0.16);
      burst(sx, sy, rgb(glassColor(glassCount())), 6);
      if (movL < prevL - 0.001) {
        const width = prevL - movL;
        const center = (movL + prevL) / 2;
        pushShard(
          {
            x: axis === "x" ? center : mover.x,
            z: axis === "z" ? center : mover.z,
            y: mover.y,
            w: axis === "x" ? width : mover.w,
            d: axis === "z" ? width : mover.d,
            thick: THICK,
            kind: "glass",
            layer: glassCount(),
          },
          -1,
          axis,
        );
      } else if (movR > prevR + 0.001) {
        const width = movR - prevR;
        const center = (prevR + movR) / 2;
        pushShard(
          {
            x: axis === "x" ? center : mover.x,
            z: axis === "z" ? center : mover.z,
            y: mover.y,
            w: axis === "x" ? width : mover.w,
            d: axis === "z" ? width : mover.d,
            thick: THICK,
            kind: "glass",
            layer: glassCount(),
          },
          1,
          axis,
        );
      }
    }

    const layer = glassCount();
    stack.push({
      x: axis === "x" ? newC : mover.x,
      z: axis === "z" ? newC : mover.z,
      y: mover.y,
      w: axis === "x" ? newS : mover.w,
      d: axis === "z" ? newS : mover.d,
      thick: THICK,
      kind: "glass",
      layer,
      settle: 1,
      flash: perfect ? 1 : 0.45,
    });
    score += gain * boost;
    drops += 1;
    if (mode === "free" && score > best) {
      best = score;
      crowned = true;
      persist();
    } else if (mode === "daily" && score > best) {
      crowned = false;
    }
    const nextTitle = titleIndex(drops);
    if (nextTitle !== titleAt) {
      titleAt = nextTitle;
      audio.title(nextTitle);
      floaters.push({ text: TITLES[nextTitle][1], x: m.w / 2, y: m.h * 0.3, life: 1.6, perfect: true });
      if (floaters.length > 6) floaters.shift();
    }
    const edge = !perfect && newS <= prevS * 0.42;
    floaters.push({
      text: perfect ? (combo > 1 ? `×${combo}` : "Perfect") : edge ? "Edge" : "+1",
      x: sx,
      y: sy - 18,
      life: 0.9,
      perfect,
      edge,
    });
    if (floaters.length > 6) floaters.shift();
    mover = null;
    landing = perfect ? 0.12 : 0.08;
    notify();
  }

  function dropPerfect() {
    if (phase === "menu") begin();
    if (!mover || phase !== "play") return;
    mover.x = mover.originX;
    mover.z = mover.originZ;
    inputLock = 0;
    landing = 0;
    drop();
  }

  function dropMiss() {
    if (phase === "menu") begin();
    if (!mover || phase !== "play") return;
    const fp = footprint();
    if (mover.axis === "x") mover.x = fp.x + fp.w + 2.4;
    else mover.z = fp.z + fp.d + 2.4;
    inputLock = 0;
    landing = 0;
    drop();
  }

  function updateMover(dt: number) {
    if (!mover) return;
    const size = mover.axis === "x" ? mover.w : mover.d;
    const overhang = Math.max(0.38, size * 0.62);
    const amp = size / 2 + overhang;
    const speed = (0.78 + Math.min(1.2, glassCount() * 0.038)) * mover.k * DIFFICULTIES[difficulty].speed;
    mover.phase += speed * dt;
    const offset = tri(mover.phase) * amp;
    if (mover.axis === "x") {
      mover.x = mover.originX + offset;
      mover.z = mover.originZ;
    } else {
      mover.z = mover.originZ + offset;
      mover.x = mover.originX;
    }
  }

  function update(dt: number) {
    if (inputLock > 0) inputLock = Math.max(0, inputLock - dt);
    trauma = Math.max(0, trauma - dt * 1.55);

    const moving = phase === "menu" || (phase === "play" && !resolving && landing <= 0);
    if (moving) updateMover(dt);

    if (landing > 0) {
      landing -= dt;
      if (landing <= 0) {
        landing = 0;
        if (phase === "play" && !mover && !resolving) spawnMover();
      }
    }

    if (resolving) {
      overTimer -= dt;
      if (overTimer <= 0) {
        resolving = false;
        phase = "over";
        mover = null;
        seconds = Math.max(0, Math.round((performance.now() - runStartedAt) / 1000));
        notify();
      }
    }

    for (const b of stack) {
      if (b.settle > 0) b.settle = Math.max(0, b.settle - dt * 5.5);
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 3.4);
    }

    for (const s of shards) {
      s.vy -= 13 * dt;
      s.y += s.vy * dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.rot += s.vr * dt;
      s.life -= dt;
    }
    if (shards.length) shards = shards.filter((s) => s.life > 0 && s.y > camY - 12);

    let i = 0;
    while (i < sparks.length) {
      const s = sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 80 * dt;
      i++;
    }

    for (const f of floaters) {
      f.life -= dt;
      f.y -= 28 * dt;
    }
    if (floaters.length) floaters = floaters.filter((f) => f.life > 0);

    for (const r of rings) r.life -= dt * 1.6;
    if (rings.length) rings = rings.filter((r) => r.life > 0);

    const focus = mover ? mover.y : footprint().yTop;
    camY += (focus - camY) * (1 - Math.exp(-5 * dt));
  }

  function poly(ctx: CanvasRenderingContext2D, pts: Pt[]) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function rotatePts(pts: Pt[], ang: number): Pt[] {
    if (!ang) return pts;
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
      cx += p[0];
      cy += p[1];
    }
    cx /= pts.length;
    cy /= pts.length;
    const co = Math.cos(ang);
    const si = Math.sin(ang);
    return pts.map(([x, y]) => {
      const dx = x - cx;
      const dy = y - cy;
      return [cx + dx * co - dy * si, cy + dx * si + dy * co];
    });
  }

  function drawBlock(
    ctx: CanvasRenderingContext2D,
    b: Block | Shard,
    m: ReturnType<typeof metrics>,
    rot = 0,
    alpha = 1,
    lift = 0,
  ) {
    const squash = "settle" in b ? b.settle * b.settle : 0;
    const thick = b.thick * (1 - squash * 0.16) + 0.02;
    const grow = 1 + squash * 0.05;
    const y0 = b.y + lift;
    const y1 = y0 + thick;
    const w = b.w * grow;
    const d = b.d * grow;
    const x0 = b.x - w / 2;
    const x1 = b.x + w / 2;
    const z0 = b.z - d / 2;
    const z1 = b.z + d / 2;
    const P = (x: number, y: number, z: number) => project(x, y, z, m);
    let top = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)];
    let faceX = [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)];
    let faceZ = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
    if (rot) {
      top = rotatePts(top, rot);
      faceX = rotatePts(faceX, rot);
      faceZ = rotatePts(faceZ, rot);
    }
    const [, sy] = top[0];
    if (sy > m.h + 220) return;

    const col = b.kind === "wood" ? (b.w < 0.4 ? POST : WOOD) : glassColor(b.layer);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = rgb(mix(col, [6, 8, 10], 0.48));
    poly(ctx, faceX);
    ctx.fill();
    ctx.fillStyle = rgb(mix(col, [255, 255, 255], b.kind === "glass" ? 0.14 : 0.04));
    poly(ctx, faceZ);
    ctx.fill();

    if (b.kind === "glass") {
      const g = ctx.createLinearGradient(top[0][0], top[0][1], top[2][0], top[2][1]);
      g.addColorStop(0, rgb(mix(col, [255, 255, 255], 0.48)));
      g.addColorStop(0.55, rgb(mix(col, [255, 255, 255], 0.18)));
      g.addColorStop(1, rgb(mix(col, [20, 28, 32], 0.08)));
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = rgb(mix(col, [255, 236, 214], 0.16));
    }
    poly(ctx, top);
    ctx.fill();

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(6,16,22,0.38)";
    poly(ctx, faceX);
    ctx.stroke();
    poly(ctx, faceZ);
    ctx.stroke();
    ctx.strokeStyle = b.kind === "glass" ? "rgba(255,255,255,0.42)" : "rgba(255,236,214,0.18)";
    poly(ctx, top);
    ctx.stroke();

    if (b.kind === "wood" && b.w > 1) {
      ctx.strokeStyle = "rgba(48,26,14,0.35)";
      for (const t of [0.34, 0.67]) {
        const z = z0 + (z1 - z0) * t;
        const a = P(x0, y1, z);
        const c = P(x1, y1, z);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.stroke();
      }
    }

    if ("flash" in b && b.flash > 0) {
      ctx.globalAlpha = alpha * b.flash * 0.72;
      ctx.fillStyle = "#f7fffb";
      poly(ctx, top);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(time: number) {
    const m = metrics(time);
    const cw = Math.round(m.w * m.dpr);
    const ch = Math.round(m.h * m.dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
    ctx.lineJoin = "round";

    const night = Math.max(0, Math.min(1, (camY - 0.4) / 16));
    const dawn = Math.max(0, Math.min(1, (camY - 26) / 18));
    const sky = ctx.createLinearGradient(0, 0, 0, m.h);
    sky.addColorStop(0, rgb(mix(mix([28, 44, 68], [6, 10, 18], night), [64, 56, 104], dawn)));
    sky.addColorStop(0.48, rgb(mix(mix([214, 132, 108], [14, 32, 44], night), [236, 150, 124], dawn * 0.9)));
    sky.addColorStop(1, rgb(mix(mix([16, 74, 88], [6, 18, 24], night), [34, 88, 104], dawn)));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, m.w, m.h);

    const seaY = project(0, -0.45, 0, m)[1];
    if (night > 0.04) {
      for (const star of stars) {
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 1.7 + star.tw));
        ctx.globalAlpha = night * tw * (1 - dawn * 0.75);
        ctx.fillStyle = "#e8f3ee";
        ctx.beginPath();
        ctx.arc(star.x * m.w, star.y * m.h * 0.7, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    const moonX = m.w * 0.78;
    const moonY = m.h * 0.16 + (1 - night) * 26;
    const glow = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 78);
    glow.addColorStop(0, `rgba(232,243,238,${0.22 + night * 0.28})`);
    glow.addColorStop(1, "rgba(232,243,238,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(232,243,238,${0.78 + night * 0.22})`;
    ctx.beginPath();
    ctx.arc(moonX, moonY, Math.min(m.w, m.h) * 0.028 + 10, 0, Math.PI * 2);
    ctx.fill();

    if (seaY < m.h + 40) {
      const top = Math.max(0, seaY - 70);
      const haze = ctx.createLinearGradient(0, top, 0, Math.min(m.h, seaY + 24));
      haze.addColorStop(0, "rgba(232,149,106,0)");
      haze.addColorStop(1, `rgba(232,149,106,${0.28 * (1 - night)})`);
      ctx.fillStyle = haze;
      ctx.fillRect(0, top, m.w, Math.min(m.h, seaY + 24) - top);

      const water = ctx.createLinearGradient(0, seaY, 0, m.h);
      water.addColorStop(0, rgb(mix([22, 96, 108], [8, 28, 36], night), 0.95));
      water.addColorStop(1, rgb(mix([6, 32, 42], [3, 10, 14], night)));
      ctx.fillStyle = water;
      ctx.fillRect(0, seaY, m.w, m.h - seaY + 2);
      ctx.strokeStyle = `rgba(232,243,238,${0.28 * (1 - night * 0.4)})`;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (let x = 0; x <= m.w; x += 6) {
        const y = seaY + Math.sin(x * 0.02 + time * 1.25) * 2.4 + Math.sin(x * 0.008 + time * 0.7) * 1.4;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(232,243,238,${0.14 + night * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(moonX, seaY + 22, 7, 34, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const posts: Array<[number, number]> = [
      [-1.15, -1.15],
      [1.15, -1.15],
      [-1.15, 1.15],
      [1.15, 1.15],
    ];
    for (const [x, z] of posts) {
      drawBlock(
        ctx,
        {
          x,
          z,
          y: -3.5,
          w: 0.16,
          d: 0.16,
          thick: 3.5 - 0.22 + 0.05,
          kind: "wood",
          layer: -1,
          settle: 0,
          flash: 0,
        },
        m,
      );
    }

    for (const b of stack) drawBlock(ctx, b, m);

    if (mover && (phase === "menu" || phase === "play")) {
      const fp = footprint();
      const y = fp.yTop + 0.015;
      const x0 = mover.x - mover.w / 2;
      const x1 = mover.x + mover.w / 2;
      const z0 = mover.z - mover.d / 2;
      const z1 = mover.z + mover.d / 2;
      const shadow = [
        project(x0, y, z0, m),
        project(x1, y, z0, m),
        project(x1, y, z1, m),
        project(x0, y, z1, m),
      ];
      ctx.fillStyle = "rgba(4,10,14,0.28)";
      poly(ctx, shadow);
      ctx.fill();

      // The window a drop has to land inside to count as perfect.
      const guideTol = perfectTol(mover.axis === "x" ? fp.w : fp.d);
      const guideC = mover.axis === "x" ? fp.x : fp.z;
      const guideY = fp.yTop + 0.004;
      const band =
        mover.axis === "x"
          ? [
              project(Math.max(fp.x - fp.w / 2, guideC - guideTol), guideY, fp.z - fp.d / 2, m),
              project(Math.min(fp.x + fp.w / 2, guideC + guideTol), guideY, fp.z - fp.d / 2, m),
              project(Math.min(fp.x + fp.w / 2, guideC + guideTol), guideY, fp.z + fp.d / 2, m),
              project(Math.max(fp.x - fp.w / 2, guideC - guideTol), guideY, fp.z + fp.d / 2, m),
            ]
          : [
              project(fp.x - fp.w / 2, guideY, Math.max(fp.z - fp.d / 2, guideC - guideTol), m),
              project(fp.x + fp.w / 2, guideY, Math.max(fp.z - fp.d / 2, guideC - guideTol), m),
              project(fp.x + fp.w / 2, guideY, Math.min(fp.z + fp.d / 2, guideC + guideTol), m),
              project(fp.x - fp.w / 2, guideY, Math.min(fp.z + fp.d / 2, guideC + guideTol), m),
            ];
      ctx.fillStyle = "rgba(232,243,238,0.15)";
      poly(ctx, band);
      ctx.fill();
      ctx.strokeStyle = "rgba(232,243,238,0.32)";
      ctx.lineWidth = 1;
      poly(ctx, band);
      ctx.stroke();

      const bob = reduced ? 0 : Math.sin(time * 2.4) * 0.025;
      drawBlock(ctx, { ...mover, thick: THICK, kind: "glass", layer: glassCount(), settle: 0, flash: 0 }, m, 0, 1, HOVER + bob);
    }

    for (const s of shards) {
      const alpha = Math.min(1, s.life / 0.4);
      drawBlock(ctx, s, m, s.rot, alpha);
    }

    for (const spark of sparks) {
      ctx.globalAlpha = Math.max(0, spark.life / spark.max);
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const ring of rings) {
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, (1 - ring.life) * 72 + 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(232,243,238,${ring.life * 0.7})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 22px Fraunces, Georgia, serif";
    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.perfect ? "#e8956a" : f.edge ? "#93b0a8" : "#e8f3ee";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    const vignette = ctx.createRadialGradient(m.w / 2, m.h * 0.42, m.h * 0.2, m.w / 2, m.h * 0.5, m.h * 0.72);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, m.w, m.h);
  }

  function frame(now: number) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    draw(now / 1000);
  }

  function act() {
    if (phase === "menu" || phase === "over") {
      if (gate()) begin();
    } else drop();
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("button, a, input, .sheet")) return;
    audio.unlock();
    e.preventDefault();
    act();
  }

  function onKey(e: KeyboardEvent) {
    if (e.repeat) return;
    if (e.code !== "Space" && e.code !== "Enter") return;
    const t = e.target;
    if (t instanceof Element && t.closest("button, a, input")) return;
    audio.unlock();
    e.preventDefault();
    act();
  }

  function onVis() {
    if (!document.hidden) audio.resume();
  }

  function onContext(e: Event) {
    e.preventDefault();
  }

  buildAttract();
  root.addEventListener("pointerdown", onPointerDown, { passive: false });
  root.addEventListener("contextmenu", onContext);
  window.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", persist);

  // Dev-only harness (browser QA drives the game through it). It must never
  // reach a built bundle, where it would let anyone autoplay perfect drops.
  if (import.meta.env.DEV) {
    const debug: TideglassDebug = {
      getState: () => ({ ...snap(), blocks: glassCount(), hasMover: !!mover, resolving }),
      begin,
      drop,
      dropPerfect,
      dropMiss,
    };
    window.__tideglass = debug;
  }

  notify();
  raf = requestAnimationFrame(frame);

  return {
    begin,
    drop,
    setGate(next: () => boolean) {
      gate = next;
    },
    setMode(next: Mode) {
      if (phase === "play") return;
      mode = next;
      notify();
    },
    setDifficulty(next: Difficulty) {
      if (phase === "play" || next === difficulty) return;
      difficulty = next;
      best = bestFor(loadSave(), next);
      crowned = false;
      persist();
      notify();
    },
    setPalette(next: Palette) {
      if (phase === "play" || next === palette) return;
      palette = next;
      persist();
      notify();
    },
    revive() {
      if (phase !== "over" || !pendingRevive) return false;
      mover = pendingRevive;
      pendingRevive = null;
      phase = "play";
      resolving = false;
      overTimer = 0;
      combo = 0;
      landing = 0.15;
      inputLock = 0.3;
      notify();
      return true;
    },
    toggleSound() {
      sound = !sound;
      audio.unlock();
      audio.setMuted(!sound);
      persist();
      notify();
    },
    toggleShake() {
      shake = !shake;
      shakeTouched = true;
      if (!shake) trauma = 0;
      persist();
      notify();
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", persist);
      if (import.meta.env.DEV) delete window.__tideglass;
      audio.destroy();
    },
  };
}
