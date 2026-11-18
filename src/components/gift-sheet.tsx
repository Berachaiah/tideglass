import { GIFTS, giftFor, rewardChip, rewardText } from "@/game/rewards";

export function GiftSheet({
  claimed,
  canClaim,
  onClaim,
  onClose,
}: {
  claimed: number;
  canClaim: boolean;
  onClaim: () => void;
  onClose: () => void;
}) {
  const done = claimed % GIFTS.length;
  const nextDay = done + 1;

  return (
    <div className="sheet pointer-events-auto absolute inset-0 z-20 flex justify-center bg-ink/90 backdrop-blur-md">
      <section className="safe-pad flex h-full w-full max-w-md flex-col pb-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-widest text-ember uppercase">Tide calendar</p>
            <h2 className="mt-1 font-serif text-3xl font-semibold">Daily gifts</h2>
          </div>
          <button
            type="button"
            aria-label="Close daily gifts"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foam/10 text-xl text-foam"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p className="mt-2 text-sm leading-relaxed text-pretty text-mist">
          One gift a day for thirty days. Keys keep a run alive after a miss; new glass unlocks on days 7, 14 and 21.
        </p>

        <div className="mt-4 grid min-h-0 flex-1 grid-cols-5 content-start gap-2 overflow-y-auto pr-1">
          {GIFTS.map((reward, index) => {
            const day = index + 1;
            const isClaimed = index < done;
            const isNext = day === nextDay;
            return (
              <div
                key={day}
                className={`flex h-16 flex-col items-center justify-center rounded-xl border text-center ${
                  isClaimed
                    ? "border-foam/10 bg-foam/5 text-mist/50"
                    : isNext
                      ? "border-ember bg-ember/15 text-ember"
                      : "border-foam/10 bg-ink/60 text-mist"
                }`}
              >
                <span className="text-[10px] font-medium tracking-widest uppercase opacity-70">{day}</span>
                <span className="mt-0.5 text-sm font-semibold">{rewardChip(reward)}</span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!canClaim}
          className="mt-4 flex min-h-14 w-full items-center justify-center rounded-full bg-ember px-4 text-center text-base font-semibold text-ink disabled:bg-foam/10 disabled:text-mist"
          onClick={onClaim}
        >
          {canClaim ? `Claim day ${nextDay} · ${rewardText(giftFor(nextDay))}` : "Claimed — come back tomorrow"}
        </button>
      </section>
    </div>
  );
}
