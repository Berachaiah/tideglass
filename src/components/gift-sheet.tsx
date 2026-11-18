import { Check, ChevronRight, Flame, X } from "lucide-react";
import { PALETTES } from "@/game/engine";
import { GIFTS, giftFor, rewardText, type Reward } from "@/game/rewards";
import { RewardArt } from "@/components/reward-art";

const swatch = (rgb: [number, number, number] | number[]) => `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;

function artFor(reward: Reward) {
  if (reward.kind === "keys") return <RewardArt kind="keys" className="size-8 sm:size-9" />;
  if (reward.kind === "boost") return <RewardArt kind="boost" className="size-8 sm:size-9" />;
  return (
    <RewardArt
      kind="palette"
      color={swatch(PALETTES[reward.palette].colors[0])}
      className="size-8 sm:size-9"
    />
  );
}

/** Short, glanceable amount for a calendar cell. */
function chipText(reward: Reward) {
  if (reward.kind === "keys") return `+${reward.amount}`;
  if (reward.kind === "boost") return `×${reward.amount}`;
  return reward.label;
}

function untilTomorrow() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const minutes = Math.max(0, Math.round((next.getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function GiftSheet({
  claimed,
  canClaim,
  streak = 0,
  onClaim,
  onClose,
}: {
  claimed: number;
  canClaim: boolean;
  streak?: number;
  onClaim: () => void;
  onClose: () => void;
}) {
  const done = claimed % GIFTS.length;
  const nextDay = done + 1;
  const today = giftFor(nextDay);
  const cycle = Math.round((done / GIFTS.length) * 100);

  return (
    <div className="sheet pointer-events-auto absolute inset-0 z-20 flex justify-center sm:items-center sm:p-6">
      <div aria-hidden className="absolute inset-0 bg-ink/92 backdrop-blur-2xl" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-80 opacity-70"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, var(--color-ember) 16%, transparent), transparent 70%)",
        }}
      />

      <section className="safe-pad relative flex h-full w-full max-w-md flex-col pb-5 sm:h-auto sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-[2rem] sm:border sm:border-foam/10 sm:bg-ink/80 sm:overflow-y-auto sm:pb-6 sm:shadow-2xl sm:backdrop-blur-2xl lg:max-w-5xl">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-[0.32em] text-ember uppercase">
              Tide calendar
            </p>
            <h2 className="mt-1.5 font-serif text-[2.1rem] leading-none font-semibold tracking-tight sm:text-[2.4rem]">
              Daily gifts
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close daily gifts"
            className="btn-ghost grid size-11 shrink-0 place-items-center rounded-full"
            onClick={onClose}
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </header>

        <div className="mt-4 flex min-h-0 flex-1 flex-col lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-6">
          <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-mist tabular-nums">
            Day <span className="font-semibold text-foam">{nextDay}</span> of {GIFTS.length}
          </p>
          {streak > 0 ? (
            <span className="tile flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-foam tabular-nums">
              <Flame className="size-3.5 text-ember" strokeWidth={1.9} />
              {streak} day{streak === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-foam/10">
          <div
            className="h-full rounded-full bg-ember transition-[width] duration-500"
            style={{ width: `${cycle}%` }}
          />
        </div>

        <div className="mt-3 grid min-h-0 flex-1 auto-rows-fr grid-cols-5 gap-2 sm:flex-none sm:auto-rows-[minmax(0,5rem)] sm:grid-cols-6 sm:gap-2.5 lg:auto-rows-[minmax(0,6.4rem)]">
          {GIFTS.map((reward, index) => {
            const day = index + 1;
            const isClaimed = index < done;
            const isToday = day === nextDay;
            return (
              <div
                key={day}
                aria-current={isToday ? "step" : undefined}
                className={`relative flex min-h-0 flex-col items-center justify-center rounded-2xl px-1 py-1.5 text-center transition ${
                  isClaimed
                    ? "border border-foam/5 bg-foam/[0.02] text-mist/40"
                    : isToday
                      ? `halo bg-ember/12 text-foam ${canClaim ? "halo-pulse" : ""}`
                      : "tile text-foam/85"
                }`}
              >
                {isClaimed ? (
                  <Check className="absolute top-1.5 right-1.5 size-3 text-mist/50" strokeWidth={2.4} />
                ) : null}
                <span
                  className={`text-[9px] leading-none font-semibold tracking-[0.14em] uppercase ${
                    isToday ? "text-ember" : ""
                  }`}
                >
                  {isToday ? "today" : day}
                </span>
                <span className={`mt-1 ${isClaimed ? "opacity-45 saturate-50" : ""}`}>
                  {artFor(reward)}
                </span>
                <span className="mt-0.5 text-[10px] leading-none font-semibold tabular-nums sm:text-[11px]">
                  {chipText(reward)}
                </span>
              </div>
            );
          })}
        </div>
          </div>

        <div className="flex flex-col gap-3 lg:mt-0">
        <div className="glass mt-4 rounded-3xl p-2 sm:mt-5 lg:mt-0">
          <div key={nextDay} className="reward-pop flex items-center gap-3 px-2 py-2">
            <span
              className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
                canClaim ? "bg-ember/15" : "bg-foam/8"
              }`}
            >
              {artFor(today)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium tracking-[0.22em] text-mist uppercase">
                {canClaim ? `Day ${nextDay}` : "Next up"}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-balance text-foam">{rewardText(today)}</p>
            </div>
            {canClaim ? (
              <span className="rounded-full bg-ember/15 px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-ember uppercase lg:hidden">
                ready
              </span>
            ) : null}
          </div>
          <button
            type="button"
            disabled={!canClaim}
            className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-full text-base font-semibold ${
              canClaim ? "btn-ember sheen" : "bg-foam/8 text-mist"
            }`}
            onClick={onClaim}
          >
            {canClaim ? (
              <>
                Claim day {nextDay}
                <ChevronRight className="size-4" strokeWidth={2.2} />
              </>
            ) : (
              <>
                <Check className="size-4" strokeWidth={2.2} />
                Claimed today
              </>
            )}
          </button>
          <p className="mt-2 pb-1 text-center text-[11px] text-mist tabular-nums">
            {canClaim
              ? "One gift a day. Keys keep a run alive after a miss."
              : `Next gift in ${untilTomorrow()} · miss a day and the calendar waits`}
          </p>
        </div>

          <div className="tile hidden rounded-2xl p-3 lg:block">
            <p className="text-[10px] font-medium tracking-[0.22em] text-mist uppercase">
              Day {GIFTS.length} jackpot
            </p>
            <div className="mt-2 flex items-center gap-2.5">
              <RewardArt kind="keys" className="size-7" />
              <span className="text-sm font-semibold text-foam">
                {rewardText(GIFTS[GIFTS.length - 1])}
              </span>
            </div>
          </div>

          <div className="tile hidden rounded-2xl p-3 lg:block">
            <p className="text-[10px] font-medium tracking-[0.22em] text-mist uppercase">
              What they do
            </p>
            <ul className="mt-2.5 space-y-2.5 text-[11px] leading-snug text-mist">
              <li className="flex items-center gap-2">
                <RewardArt kind="keys" className="size-6 shrink-0" />
                Keys buy one more drop after a miss.
              </li>
              <li className="flex items-center gap-2">
                <RewardArt kind="boost" className="size-6 shrink-0" />
                A boost doubles or triples one run.
              </li>
              <li className="flex items-center gap-2">
                <RewardArt kind="palette" color="rgb(143 211 196)" className="size-6 shrink-0" />
                Glass sets recolour every pane.
              </li>
            </ul>
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}
