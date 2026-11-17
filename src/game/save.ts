const KEY = "tideglass.save";
const VERSION = 1;

export type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_IDS: Difficulty[] = ["easy", "medium", "hard"];

export function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

export type Save = {
  version: number;
  best: number;
  bests: Partial<Record<Difficulty, number>>;
  difficulty: Difficulty;
  sound: boolean;
  shake: boolean | null;
  name: string | null;
  token: string | null;
  guest: boolean;
  place: "on" | "off" | null;
  streak: number;
  lastDay: string | null;
};

const FALLBACK: Save = {
  version: VERSION,
  best: 0,
  bests: {},
  difficulty: "medium",
  sound: true,
  shake: null,
  name: null,
  token: null,
  guest: false,
  place: null,
  streak: 0,
  lastDay: null,
};

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...FALLBACK };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...FALLBACK };
    const row = parsed as Partial<Save>;
    const bests: Partial<Record<Difficulty, number>> = {};
    if (row.bests && typeof row.bests === "object") {
      const map = row.bests as Partial<Record<string, unknown>>;
      for (const id of DIFFICULTY_IDS) {
        const value = map[id];
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          bests[id] = Math.floor(value);
        }
      }
    }
    return {
      version: VERSION,
      best: typeof row.best === "number" && Number.isFinite(row.best) && row.best > 0 ? Math.floor(row.best) : 0,
      bests,
      difficulty: isDifficulty(row.difficulty) ? row.difficulty : "medium",
      sound: typeof row.sound === "boolean" ? row.sound : true,
      shake: typeof row.shake === "boolean" ? row.shake : null,
      name: typeof row.name === "string" && row.name ? row.name : null,
      token: typeof row.token === "string" && /^[a-f0-9]{32,64}$/.test(row.token) ? row.token : null,
      guest: row.guest === true,
      place: row.place === "on" || row.place === "off" ? row.place : null,
      streak: typeof row.streak === "number" && row.streak > 0 ? Math.floor(row.streak) : 0,
      lastDay: typeof row.lastDay === "string" ? row.lastDay : null,
    };
  } catch {
    return { ...FALLBACK };
  }
}

/** Merges into what is already stored, so the engine and the screen can both write. */
export function writeSave(patch: Partial<Save>) {
  try {
    const next = { ...loadSave(), ...patch, version: VERSION };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode or quota: keep playing in memory */
  }
}

export function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function localDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Call once per finished run. Returns the streak of consecutive days played. */
export function touchStreak(): number {
  const save = loadSave();
  const today = localDay();
  if (save.lastDay === today) return save.streak || 1;
  const streak = save.lastDay === localDay(-1) ? save.streak + 1 : 1;
  writeSave({ streak, lastDay: today });
  return streak;
}

/** The local best for one difficulty. Legacy saves only carry the medium best. */
export function bestFor(save: Save, difficulty: Difficulty): number {
  const value = save.bests[difficulty];
  if (typeof value === "number") return value;
  return difficulty === "medium" ? save.best : 0;
}

/** The streak to show: zero once a day has been missed. */
export function currentStreak(): number {
  const save = loadSave();
  if (save.lastDay === localDay() || save.lastDay === localDay(-1)) return save.streak;
  return 0;
}
