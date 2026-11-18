import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ActivityChart, BarChart, DonutChart, HourChart } from "@/components/engagement-charts";
import { adminLogin } from "@/lib/admin";
import { getEngagement, type Engagement } from "@/lib/engagement";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const TOKEN_KEY = "tideglass.admin";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile rounded-2xl px-4 py-3">
      <p className="text-[10px] font-medium tracking-[0.16em] text-mist uppercase">{label}</p>
      <p className="mt-1 font-serif text-3xl leading-none font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl px-3 pt-4 pb-2">
      <h2 className="px-2 font-serif text-xl font-semibold">{title}</h2>
      {note ? <p className="px-2 text-xs text-mist">{note}</p> : null}
      {children}
    </section>
  );
}

const MODE_LABEL: Record<string, string> = {
  free: "Free play",
  daily: "Daily tide",
  blitz: "Tide rush",
};

function modeName(value: string | null) {
  return value ? (MODE_LABEL[value] ?? value) : "—";
}

function diffName(value: string | null) {
  if (value === "easy" || value === "hard") return value;
  return "medium";
}

function Login({ onToken }: { onToken: (token: string) => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await adminLogin({ data: { login, password } });
      if (result.ok) {
        try {
          sessionStorage.setItem(TOKEN_KEY, result.token);
        } catch {
          /* ignore */
        }
        onToken(result.token);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex h-dvh items-center justify-center bg-tide px-5 text-foam">
      <div className="glass w-full max-w-sm rounded-3xl p-6">
        <p className="text-xs font-medium tracking-widest text-ember uppercase">Tide log</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold">Sign in</h1>
        <label className="mt-5 block text-sm text-mist" htmlFor="login">
          Username or email
        </label>
        <input
          id="login"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          className="mt-1 h-12 w-full rounded-xl border border-foam/15 bg-tide px-4 text-base text-foam"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
        <label className="mt-4 block text-sm text-mist" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="mt-1 h-12 w-full rounded-xl border border-foam/15 bg-tide px-4 text-base text-foam"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        {error ? <p className="mt-3 text-sm text-ember">{error}</p> : null}
        <button
          type="button"
          disabled={busy || !login || !password}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-ember text-base font-semibold text-ink disabled:opacity-50"
          onClick={() => void submit()}
        >
          {busy ? "Checking" : "Sign in"}
        </button>
        <Link to="/" className="mt-4 block text-center text-sm text-mist underline">
          Back to the game
        </Link>
      </div>
    </main>
  );
}

function Dashboard({ token, onLock }: { token: string; onLock: () => void }) {
  const [data, setData] = useState<Engagement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      setData(await getEngagement({ data: { token } }));
    } catch {
      try {
        sessionStorage.removeItem(TOKEN_KEY);
      } catch {
        /* ignore */
      }
      onLock();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empty = data ? data.opens + data.starts + data.finishes === 0 : false;

  return (
    <main className="h-dvh overflow-y-auto bg-tide text-foam">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 pt-6 pb-16">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-widest text-ember uppercase">Engagement</p>
            <h1 className="mt-1 font-serif text-4xl leading-none font-semibold">Tide log</h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-mist">
              Visits, runs and scores across free play, the daily tide and the timed rush. Places are
              state and country only, from players who chose to share.
            </p>
          </div>
          <Link
            to="/"
            className="flex h-11 shrink-0 items-center rounded-full bg-ember px-4 text-sm font-semibold text-ink"
          >
            Play
          </Link>
        </header>

        <div className="flex gap-2">
          <button type="button" className="min-h-11 rounded-full border border-foam/15 px-4 text-sm text-mist" onClick={() => void load()} disabled={busy}>
            {busy ? "Updating" : "Refresh"}
          </button>
          <button
            type="button"
            className="min-h-11 rounded-full border border-foam/15 px-4 text-sm text-mist"
            onClick={() => {
              try {
                sessionStorage.removeItem(TOKEN_KEY);
              } catch {
                /* ignore */
              }
              onLock();
            }}
          >
            Sign out
          </button>
        </div>

        {!data ? (
          <p className="py-10 text-center text-sm text-mist">Loading</p>
        ) : empty ? (
          <p className="rounded-2xl border border-foam/10 bg-ink/70 px-4 py-8 text-center text-sm text-mist">
            Nothing logged yet. Play a round and it will show up here.
          </p>
        ) : (
          <>
            {error ? <p className="text-sm text-ember">{error}</p> : null}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="People" value={String(data.visitors)} />
              <Stat label="Named" value={String(data.players)} />
              <Stat label="Visits" value={String(data.opens)} />
              <Stat label="Plays" value={String(data.starts)} />
              <Stat label="Finishes" value={String(data.finishes)} />
              <Stat label="Quits" value={String(data.quits)} />
              <Stat label="Average" value={String(data.average)} />
              <Stat label="Best" value={String(data.best)} />
              <Stat label="Avg run" value={`${data.avgSeconds}s`} />
              <Stat label="Perfects per run" value={String(data.avgPerfects)} />
              <Stat label="Rush runs" value={String(data.rush.runs)} />
              <Stat label="Best rush" value={String(data.rush.best)} />
            </section>

            <Card
              title="Tide rush"
              note="45s opening clock · perfect +4s · miss −2s · no revives"
            >
              <div className="grid grid-cols-2 gap-2 px-2 pt-3 pb-2 sm:grid-cols-4">
                <Stat label="Finishes" value={String(data.rush.runs)} />
                <Stat label="Average" value={String(data.rush.average)} />
                <Stat label="Best" value={String(data.rush.best)} />
                <Stat label="Avg clock" value={`${data.rush.avgSeconds}s`} />
              </div>
            </Card>

            <Card title="Last 14 days" note="Plays, finishes and quits by day">
              <ActivityChart days={data.days} />
            </Card>
            <Card title="Time of day" note="Local hour on the player's phone">
              <HourChart hours={data.hours} />
            </Card>
            <Card title="Score spread">
              <BarChart data={data.buckets} />
            </Card>
            <Card title="Perfect streaks" note="Longest streak in each finished run">
              <BarChart data={data.streaks} />
            </Card>
            <Card title="How long a run lasts">
              <BarChart data={data.durations} />
            </Card>
            <Card title="Phone or desktop">
              <DonutChart data={data.devices} />
            </Card>
            <Card title="New or coming back">
              <DonutChart data={data.visitorsMix} />
            </Card>
            <Card title="Game modes" note="Starts by mode, then finishes and scores in each">
              <DonutChart data={data.modes} />
              <ul className="mt-1 divide-y divide-foam/10 border-t border-foam/10">
                {data.modeStats.length === 0 ? (
                  <li className="px-2 py-4 text-sm text-mist">No finished runs yet.</li>
                ) : (
                  data.modeStats.map((row) => (
                    <li key={row.label} className="flex items-baseline justify-between gap-3 px-2 py-2.5">
                      <span className="text-sm font-medium">{row.label}</span>
                      <span className="text-xs text-mist tabular-nums">
                        {row.runs} {row.runs === 1 ? "run" : "runs"} · avg {row.average} · best {row.best}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Card>
            <Card title="Difficulty" note="The tide each finished run was played on">
              <DonutChart data={data.difficulties} />
            </Card>
            <Card title="Sound">
              <DonutChart data={data.sound} />
            </Card>
            <Card title="Screen shake">
              <DonutChart data={data.shake} />
            </Card>
            <Card title="Where people play" note="State and country, plays counted">
              {data.places.length === 0 ? (
                <p className="px-2 py-8 text-sm text-mist">Nobody has shared a place yet.</p>
              ) : (
                <BarChart data={data.places} horizontal height="h-80" />
              )}
            </Card>
            <Card title="Countries">
              {data.countries.length === 0 ? (
                <p className="px-2 py-8 text-sm text-mist">Nobody has shared a place yet.</p>
              ) : (
                <BarChart data={data.countries} horizontal height="h-64" />
              )}
            </Card>

            <section className="rounded-2xl border border-foam/10 bg-ink/70 px-4 py-4">
              <h2 className="font-serif text-xl font-semibold">Latest finishes</h2>
              {data.recent.length === 0 ? (
                <p className="py-6 text-sm text-mist">No finished runs yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-foam/10">
                  {data.recent.map((row, index) => (
                    <li
                      key={`${row.at}-${index}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-3"
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="font-serif text-2xl tabular-nums">{row.score}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] uppercase ${
                            row.mode === "blitz"
                              ? "bg-ember/20 text-ember"
                              : "bg-foam/10 text-mist"
                          }`}
                        >
                          {modeName(row.mode)}
                        </span>
                        {diffName(row.difficulty) !== "medium" ? (
                          <span className="text-[10px] tracking-[0.12em] text-mist/70 uppercase">
                            {diffName(row.difficulty)}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-sm text-mist tabular-nums">
                        {row.combo > 1 ? `×${row.combo} · ` : ""}
                        {row.seconds != null ? `${row.seconds}s · ` : ""}
                        {formatWhen(row.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem(TOKEN_KEY));
    } catch {
      setToken(null);
    }
    setReady(true);
  }, []);

  if (!ready) return <main className="h-dvh bg-tide" />;
  if (!token) return <Login onToken={setToken} />;
  return <Dashboard token={token} onLock={() => setToken(null)} />;
}
