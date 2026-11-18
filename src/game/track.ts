import { recordEvent } from "@/lib/engagement";
import { submitRun, type RunResult } from "@/lib/leaderboard";
import { loadSave, type Difficulty } from "@/game/save";

const VISITOR = "tideglass.visitor";
const OPENED = "tideglass.opened";
const FIRST = "tideglass.first";
const PENDING = "tideglass.pending";

export type Mode = "free" | "daily";

export function visitorId() {
  try {
    const current = localStorage.getItem(VISITOR);
    if (current && /^[a-z0-9]{16,40}$/.test(current)) return current;
    const next = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    localStorage.setItem(VISITOR, next);
    return next;
  } catch {
    return "";
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function returning() {
  try {
    const first = localStorage.getItem(FIRST);
    if (!first) {
      localStorage.setItem(FIRST, today());
      return false;
    }
    return first !== today();
  } catch {
    return undefined;
  }
}

function device(): "phone" | "desktop" {
  try {
    return window.matchMedia("(pointer: coarse)").matches ? "phone" : "desktop";
  } catch {
    return "desktop";
  }
}

type Extra = {
  score?: number;
  combo?: number;
  seconds?: number;
  perfects?: number;
  mode?: Mode;
  difficulty?: Difficulty;
  boost?: number;
};

function send(kind: "open" | "start" | "finish", extra: Extra = {}) {
  const visitor = visitorId();
  if (!visitor) return;
  const save = loadSave();
  void recordEvent({
    data: {
      visitor,
      kind,
      ...extra,
      device: device(),
      returning: returning(),
      sound: save.sound,
      shake: save.shake ?? true,
      hour: new Date().getHours(),
    },
  }).catch(() => undefined);
}

export function trackOpen() {
  try {
    if (localStorage.getItem(OPENED) === today()) return;
    localStorage.setItem(OPENED, today());
  } catch {
    return;
  }
  send("open");
}

export function trackStart(mode: Mode) {
  send("start", { mode });
}

export type Finish = {
  score: number;
  combo: number;
  drops: number;
  seconds: number;
  perfects: number;
  mode: Mode;
  difficulty: Difficulty;
  /** Score multiplier the run was played with; 1 means none. */
  boost: number;
};

export function trackFinish(run: Finish) {
  send("finish", {
    score: run.score,
    combo: run.combo,
    seconds: run.seconds,
    perfects: run.perfects,
    mode: run.mode,
    difficulty: run.difficulty,
    boost: run.boost,
  });
}

type Pending = Finish & { day: string };

function keepPending(run: Pending) {
  try {
    const list: Pending[] = JSON.parse(localStorage.getItem(PENDING) ?? "[]");
    list.push(run);
    localStorage.setItem(PENDING, JSON.stringify(list.slice(-5)));
  } catch {
    /* ignore */
  }
}

/** Posts a finished run to the leaderboard. Network trouble is kept for a retry. */
export async function postRun(run: Finish): Promise<RunResult | null> {
  const save = loadSave();
  if (!save.name || !save.token) return null;
  const day = today();
  try {
    return await submitRun({ data: { name: save.name, token: save.token, ...run, day } });
  } catch {
    keepPending({ ...run, day });
    return null;
  }
}

export async function retryPending() {
  const save = loadSave();
  if (!save.name || !save.token) return;
  let list: Pending[] = [];
  try {
    list = JSON.parse(localStorage.getItem(PENDING) ?? "[]");
    localStorage.removeItem(PENDING);
  } catch {
    return;
  }
  for (const run of list) {
    try {
      await submitRun({ data: { name: save.name, token: save.token, ...run } });
    } catch {
      keepPending(run);
    }
  }
}
