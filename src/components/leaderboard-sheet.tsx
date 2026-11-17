import { useEffect, useState } from "react";
import { getBoard, type Board, type Period } from "@/lib/leaderboard";

const TABS: { id: Period; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "week", label: "This week" },
  { id: "day", label: "Today's tide" },
];

export function LeaderboardSheet({
  name,
  initial = "all",
  onClose,
}: {
  name: string | null;
  initial?: Period;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<Period>(initial);
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dead = false;
    setBoard(null);
    setFailed(false);
    getBoard({ data: { period, name: name ?? undefined, limit: 50 } })
      .then((result) => {
        if (!dead) setBoard(result);
      })
      .catch(() => {
        if (!dead) setFailed(true);
      });
    return () => {
      dead = true;
    };
  }, [period, name]);

  const inList = board?.rows.some((row) => row.name === name) ?? false;

  return (
    <div className="sheet pointer-events-auto absolute inset-0 z-20 flex justify-center bg-ink/90 backdrop-blur-md">
      <section className="safe-pad flex h-full w-full max-w-md flex-col pb-6">
        <header className="flex items-center justify-between">
          <h2 className="font-serif text-3xl font-semibold">Leaderboard</h2>
          <button
            type="button"
            aria-label="Close leaderboard"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-foam/10 text-xl text-foam"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="mt-4 flex gap-2" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={period === tab.id}
              className={`min-h-11 flex-1 rounded-full px-2 text-sm font-medium ${
                period === tab.id ? "bg-ember text-ink" : "bg-foam/10 text-mist"
              }`}
              onClick={() => setPeriod(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {failed ? (
            <p className="py-10 text-center text-sm text-mist">Could not load the board. Check your connection.</p>
          ) : !board ? (
            <p className="py-10 text-center text-sm text-mist">Loading</p>
          ) : board.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-mist">No scores here yet. Be the first.</p>
          ) : (
            <ol className="divide-y divide-foam/10">
              {board.rows.map((row, index) => (
                <li
                  key={`${row.name}-${index}`}
                  className={`flex items-center gap-3 px-2 py-3 ${row.name === name ? "rounded-xl bg-ember/15" : ""}`}
                >
                  <span className="w-8 text-sm text-mist tabular-nums">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-base">{row.name}</span>
                  <span className="font-serif text-2xl tabular-nums">{row.score}</span>
                </li>
              ))}
            </ol>
          )}
          {board?.me && !inList ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-ember/15 px-2 py-3">
              <span className="w-8 text-sm text-mist tabular-nums">{board.me.rank}</span>
              <span className="min-w-0 flex-1 truncate text-base">{name}</span>
              <span className="font-serif text-2xl tabular-nums">{board.me.score}</span>
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-center text-xs text-mist">
          {board ? `${board.total} ${board.total === 1 ? "player" : "players"}` : ""}
          {period === "day" ? " · same pattern for everyone today" : ""}
        </p>
      </section>
    </div>
  );
}
