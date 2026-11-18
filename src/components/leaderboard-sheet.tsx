import { useEffect, useState } from "react";
import { Crown, Sunrise, Timer, Waves, X, type LucideIcon } from "lucide-react";
import { getBoard, type Board, type Period } from "@/lib/leaderboard";

type Mode = "free" | "daily" | "blitz";
type Difficulty = "easy" | "medium" | "hard";

const MODES: { id: Mode; label: string; icon: LucideIcon }[] = [
  { id: "free", label: "Free", icon: Waves },
  { id: "daily", label: "Daily", icon: Sunrise },
  { id: "blitz", label: "Rush", icon: Timer },
];

const WINDOWS: { id: Period; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "week", label: "Week" },
  { id: "day", label: "Today" },
];

const DIFFS: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-ember text-[11px] font-semibold text-ink tabular-nums">
        <Crown className="size-4" strokeWidth={2.1} />
      </span>
    );
  }
  return (
    <span
      className={`grid size-8 shrink-0 place-items-center rounded-xl text-[11px] font-semibold tabular-nums ${
        rank <= 3 ? "bg-foam/15 text-foam" : "text-mist"
      }`}
    >
      {rank}
    </span>
  );
}

export function LeaderboardSheet({
  name,
  initial = "all",
  difficulty = "medium",
  mode: initialMode,
  onClose,
}: {
  name: string | null;
  initial?: Period;
  difficulty?: Difficulty;
  /** Which board to open on: survival, daily tide, or the timed rush. */
  mode?: Mode;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode ?? "free");
  const [period, setPeriod] = useState<Period>(initial);
  const [diff, setDiff] = useState<Difficulty>(difficulty);
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);

  // The daily board only ever has one window: today's pattern.
  const span: Period = mode === "daily" ? "day" : period;

  useEffect(() => {
    let dead = false;
    setBoard(null);
    setFailed(false);
    getBoard({
      data: { period: span, name: name ?? undefined, limit: 50, difficulty: diff, mode },
    })
      .then((result) => {
        if (!dead) setBoard(result);
      })
      .catch(() => {
        if (!dead) setFailed(true);
      });
    return () => {
      dead = true;
    };
  }, [span, name, diff, mode]);

  const pickMode = (next: Mode) => {
    setMode(next);
    setPeriod(next === "daily" ? "day" : "all");
  };

  const myIndex = board?.rows.findIndex((row) => row.name === name) ?? -1;
  const myRank = myIndex >= 0 ? myIndex + 1 : (board?.me?.rank ?? null);
  const myScore = myIndex >= 0 ? board?.rows[myIndex].score : (board?.me?.score ?? null);
  const modeLabel =
    mode === "blitz" ? "Tide rush" : mode === "daily" ? "Daily tide" : "Free play";

  return (
    <div className="sheet pointer-events-auto absolute inset-0 z-20 flex justify-center sm:items-center sm:p-6">
      <div aria-hidden className="absolute inset-0 bg-ink/92 backdrop-blur-2xl" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-72 opacity-60"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, var(--color-ember) 13%, transparent), transparent 70%)",
        }}
      />

      <section className="safe-pad relative flex h-full w-full max-w-md flex-col pb-5 sm:h-auto sm:max-h-[92dvh] sm:max-w-xl sm:rounded-[2rem] sm:border sm:border-foam/10 sm:bg-ink/80 sm:pb-6 sm:shadow-2xl sm:backdrop-blur-2xl">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium tracking-[0.32em] text-ember uppercase">
              Tide standings
            </p>
            <h2 className="mt-1.5 font-serif text-[2.1rem] leading-none font-semibold tracking-tight">
              Leaderboard
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close leaderboard"
            className="btn-ghost grid size-11 shrink-0 place-items-center rounded-full"
            onClick={onClose}
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </header>

        <div role="group" aria-label="Game mode" className="mt-4 grid grid-cols-3 gap-2">
          {MODES.map((item) => {
            const Icon = item.icon;
            const on = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                className={`flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border text-[13px] font-semibold transition ${
                  on
                    ? "border-ember/40 bg-ember/12 text-foam"
                    : "border-foam/10 bg-foam/[0.03] text-mist hover:text-foam"
                }`}
                onClick={() => pickMode(item.id)}
              >
                <Icon className={`size-4 ${on ? "text-ember" : ""}`} strokeWidth={1.9} />
                {item.label}
              </button>
            );
          })}
        </div>

        {mode !== "daily" ? (
          <div
            role="tablist"
            aria-label="Time window"
            className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-foam/10 bg-ink/50 p-1"
          >
            {WINDOWS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={period === tab.id}
                className={`min-h-9 rounded-full px-2 text-xs font-medium transition ${
                  period === tab.id ? "bg-foam text-ink" : "text-mist hover:text-foam"
                }`}
                onClick={() => setPeriod(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-foam/10 bg-foam/[0.03] px-3 py-2 text-center text-[11px] text-mist">
            Today&apos;s tide · one pattern for everyone
          </p>
        )}

        <div role="group" aria-label="Difficulty" className="mt-2 grid grid-cols-3 gap-1">
          {DIFFS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={diff === item.id}
              className={`min-h-9 rounded-full text-[11px] font-medium tracking-wide uppercase transition ${
                diff === item.id ? "bg-foam/12 text-foam" : "text-mist/70 hover:text-foam"
              }`}
              onClick={() => setDiff(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="tile mt-3 grid grid-cols-3 items-center gap-2 rounded-2xl px-4 py-3 text-center">
          <div>
            <p className="text-[9px] font-medium tracking-[0.18em] text-mist uppercase">Best</p>
            <p className="mt-1 font-serif text-2xl leading-none font-semibold tabular-nums">
              {myScore ?? "—"}
            </p>
          </div>
          <div className="border-x border-foam/10">
            <p className="text-[9px] font-medium tracking-[0.18em] text-mist uppercase">Rank</p>
            <p className="mt-1 font-serif text-2xl leading-none font-semibold tabular-nums">
              {myRank ? `#${myRank}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-medium tracking-[0.18em] text-mist uppercase">Players</p>
            <p className="mt-1 font-serif text-2xl leading-none font-semibold tabular-nums">
              {board?.total ?? "—"}
            </p>
          </div>
        </div>
        {!name ? (
          <p className="mt-1.5 text-center text-[11px] text-mist">
            Pick a name on the menu to take a rank.
          </p>
        ) : null}

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {failed ? (
            <p className="tile rounded-2xl px-4 py-8 text-center text-sm text-mist">
              Could not load the board. Check your connection.
            </p>
          ) : !board ? (
            <div className="space-y-1.5">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="tile h-14 animate-pulse rounded-2xl opacity-60" />
              ))}
            </div>
          ) : board.rows.length === 0 ? (
            <p className="tile rounded-2xl px-4 py-8 text-center text-sm text-mist">
              No scores here yet. Be the first.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {board.rows.map((row, index) => {
                const mine = row.name === name;
                return (
                  <li
                    key={`${row.name}-${index}`}
                    className={`flex items-center gap-3 rounded-2xl px-2.5 py-3 ${
                      mine ? "tile-lit" : "tile"
                    }`}
                  >
                    <RankBadge rank={index + 1} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
                    {mine ? (
                      <span className="rounded-full bg-ember/20 px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-ember uppercase">
                        you
                      </span>
                    ) : null}
                    <span className="font-serif text-xl leading-none font-semibold tabular-nums">
                      {row.score}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <p className="mt-3 text-center text-[11px] text-mist">
          {modeLabel}
          {mode === "daily" ? " · today" : period === "week" ? " · last 7 days" : ""}
          {diff !== "medium" ? ` · ${diff}` : ""}
          {board ? ` · ${board.total} ${board.total === 1 ? "player" : "players"}` : ""}
        </p>
      </section>
    </div>
  );
}
