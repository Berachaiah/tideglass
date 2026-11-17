export const NAME_MIN = 2;
export const NAME_MAX = 16;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

export function graphemes(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);
}

const LETTER = /^[\p{L}\p{N}][\p{M}]*$/u;
const SEPARATOR = /^[ _.-]$/;
const EMOJI = /\p{Extended_Pictographic}/u;
const FLAG = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;
const KEYCAP = /^[#*0-9]\uFE0F?\u20E3$/u;

function allowed(piece: string) {
  return LETTER.test(piece) || SEPARATOR.test(piece) || EMOJI.test(piece) || FLAG.test(piece) || KEYCAP.test(piece);
}

const BLOCKED = new Set([
  "fuck",
  "fucker",
  "shit",
  "bitch",
  "nigga",
  "nigger",
  "cunt",
  "pussy",
  "rape",
  "rapist",
  "nazi",
  "whore",
  "slut",
  "asshole",
  "bastard",
  "faggot",
  "hitler",
]);

const RESERVED = new Set(["admin", "administrator", "moderator", "staff", "support", "tideglass", "system", "owner"]);

function leet(word: string) {
  return word
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t");
}

export function nameKey(name: string) {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ _.-]+/g, "");
}

export type NameCheck = { ok: true; name: string; key: string } | { ok: false; reason: string };

export function checkName(input: unknown): NameCheck {
  const raw = typeof input === "string" ? input : "";
  const name = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  const pieces = graphemes(name);
  if (pieces.length < NAME_MIN) return { ok: false, reason: `Use at least ${NAME_MIN} characters.` };
  if (pieces.length > NAME_MAX) return { ok: false, reason: `Keep it to ${NAME_MAX} characters or fewer.` };
  if (!pieces.every(allowed)) return { ok: false, reason: "Use letters, numbers, emoji, spaces, dots, dashes or underscores." };
  const key = nameKey(name);
  if (key.length < 1) return { ok: false, reason: "Pick a name with a letter, number or emoji." };
  const words = name.toLowerCase().split(/[\s_.-]+/).filter(Boolean);
  for (const word of words) {
    if (BLOCKED.has(word) || BLOCKED.has(leet(word))) return { ok: false, reason: "Pick a friendlier name." };
  }
  if (BLOCKED.has(key) || BLOCKED.has(leet(key))) return { ok: false, reason: "Pick a friendlier name." };
  if (RESERVED.has(key)) return { ok: false, reason: "That name is reserved." };
  return { ok: true, name, key };
}
