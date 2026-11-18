import type { Palette } from "@/game/save";

/** Keys a run may spend to keep the stack alive after a miss. */
export const MAX_REVIVES = 2;

/** Keys one revive costs. */
export const REVIVE_COST = 1;

export type Reward =
  | { kind: "keys"; amount: number }
  | { kind: "boost"; amount: number }
  | { kind: "palette"; palette: Palette; label: string };

/**
 * One gift per day, 30 days a cycle. Keys are the currency; boosts are worth
 * saving for a good run; palettes are the long-tail prize. Days 7, 14 and 21
 * unlock glass, day 30 pays out the most keys.
 */
export const GIFTS: Reward[] = [
  { kind: "keys", amount: 1 },
  { kind: "keys", amount: 2 },
  { kind: "boost", amount: 2 },
  { kind: "keys", amount: 1 },
  { kind: "keys", amount: 3 },
  { kind: "keys", amount: 2 },
  { kind: "palette", palette: "moon", label: "Moon" },
  { kind: "keys", amount: 2 },
  { kind: "keys", amount: 3 },
  { kind: "boost", amount: 2 },
  { kind: "keys", amount: 2 },
  { kind: "keys", amount: 4 },
  { kind: "keys", amount: 3 },
  { kind: "palette", palette: "ember", label: "Ember" },
  { kind: "keys", amount: 3 },
  { kind: "boost", amount: 3 },
  { kind: "keys", amount: 4 },
  { kind: "keys", amount: 2 },
  { kind: "keys", amount: 5 },
  { kind: "keys", amount: 3 },
  { kind: "palette", palette: "moss", label: "Moss" },
  { kind: "keys", amount: 4 },
  { kind: "boost", amount: 2 },
  { kind: "keys", amount: 5 },
  { kind: "keys", amount: 3 },
  { kind: "keys", amount: 6 },
  { kind: "keys", amount: 4 },
  { kind: "boost", amount: 3 },
  { kind: "keys", amount: 5 },
  { kind: "keys", amount: 10 },
];

/** The reward for a calendar day (1-based), wrapping around the cycle. */
export function giftFor(day: number): Reward {
  const index = (((Math.max(1, Math.floor(day)) - 1) % GIFTS.length) + GIFTS.length) % GIFTS.length;
  return GIFTS[index];
}

/** Full sentence for the claim button and the claim result. */
export function rewardText(reward: Reward): string {
  if (reward.kind === "keys") return `${reward.amount} ${reward.amount === 1 ? "key" : "keys"}`;
  if (reward.kind === "boost") return `×${reward.amount} score on your next run`;
  return `${reward.label} glass`;
}

/** Short label for a calendar cell. */
export function rewardChip(reward: Reward): string {
  if (reward.kind === "keys") return `+${reward.amount}`;
  if (reward.kind === "boost") return `×${reward.amount}`;
  return reward.label;
}
