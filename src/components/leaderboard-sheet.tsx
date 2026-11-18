import { useEffect, useState } from "react";
import { Crown, X } from "lucide-react";
import { getBoard, type Board, type Period } from "@/lib/leaderboard";

const TABS: { id: Period; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "week", label: "This week" },
  { id: "day", label: "Today" },
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
  onClose,
}: {
  name: string | null;
  initial?: Period;
  difficulty?: "easy" | "medium" | "hard";
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<Period>(initial);
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dead = false;
    setBoard(null);
    setFailed(false);
    getBoard({ data: { period, name: name ?? undefined, limit: 50, difficulty } })
      .then((result) => {
        if (!dead) setBoard(result);
      })
      .catch(() => {
        if (!dead) setFailed(true);
      });
    return () => {
      dead = true;
    };
  }, [period, name, difficulty]);

  const inList = board?.rows.some((row) => row.name === name) ?? false;

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

        <div
          role="tablist"
          className="mt-4 grid grid-cols-3 gap-1 rounded-full border border-foam/10 bg-ink/50 p-1"
        >
          {TABS.map((tab) => (
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

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {failed ? (
            <p className="tile mt-1 rounded-2xl px-4 py-8 text-center text-sm text-mist">
              Could not load the board. Check your connection.
            </p>
          ) : !board ? (
            <div className="mt-1 space-y-1.5">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="tile h-14 animate-pulse rounded-2xl opacity-60" />
              ))}
            </div>
          ) : board.rows.length === 0 && !board.me ? (
            <p className="tile mt-1 rounded-2xl px-4 py-8 text-center text-sm text-mist">
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

          {board?.me && !inList ? (
            <div className="tile-lit mt-2 flex items-center gap-3 rounded-2xl px-2.5 py-3">
              <RankBadge rank={board.me.rank} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
              <span className="rounded-full bg-ember/20 px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-ember uppercase">
                you
              </span>
              <span className="font-serif text-xl leading-none font-semibold tabular-nums">
                {board.me.score}
              </span>
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-center text-[11px] text-mist">
          {board ? `${board.total} ${board.total === 1 ? "player" : "players"}` : ""}
          {period === "day" ? " · same pattern for everyone today" : ""}
          {difficulty !== "medium" ? ` · ${difficulty} tide` : ""}
        </p>
      </section>
    </div>
  );
}
