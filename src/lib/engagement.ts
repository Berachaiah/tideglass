import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

const KINDS = ["open", "start", "finish"] as const;
type Kind = (typeof KINDS)[number];

export type Slice = { label: string; count: number };

/** Per-mode finish totals, for the admin's mode breakdown. */
export type ModeStat = { label: string; runs: number; average: number; best: number };

export type Engagement = {
  visitors: number;
  players: number;
  opens: number;
  starts: number;
  finishes: number;
  quits: number;
  average: number;
  best: number;
  avgSeconds: number;
  avgPerfects: number;
  days: { day: string; opens: number; starts: number; finishes: number; quits: number }[];
  hours: { hour: number; starts: number; finishes: number }[];
  buckets: Slice[];
  streaks: Slice[];
  durations: Slice[];
  devices: Slice[];
  visitorsMix: Slice[];
  sound: Slice[];
  shake: Slice[];
  modes: Slice[];
  modeStats: ModeStat[];
  difficulties: Slice[];
  rush: { runs: number; average: number; best: number; avgSeconds: number };
  places: Slice[];
  countries: Slice[];
  recent: {
    score: number;
    combo: number;
    seconds: number | null;
    mode: string | null;
    difficulty: string | null;
    at: string;
  }[];
};

type EventInput = {
  visitor: string;
  kind: Kind;
  score?: number;
  combo?: number;
  seconds?: number;
  perfects?: number;
  device?: "phone" | "desktop";
  returning?: boolean;
  sound?: boolean;
  shake?: boolean;
  hour?: number;
  mode?: "free" | "daily" | "blitz";
  difficulty?: "easy" | "medium" | "hard";
  boost?: number;
};

function cleanEvent(input: EventInput): EventInput {
  const visitor = String(input?.visitor ?? "");
  if (!/^[a-z0-9]{16,40}$/.test(visitor)) throw new Error("Bad visitor");
  if (!KINDS.includes(input?.kind)) throw new Error("Bad kind");
  const out: EventInput = { visitor, kind: input.kind };
  if (input.kind === "finish") {
    const score = Math.floor(Number(input.score));
    const combo = Math.floor(Number(input.combo));
    if (!Number.isFinite(score) || score < 0 || score > 99999) throw new Error("Bad score");
    if (!Number.isFinite(combo) || combo < 0 || combo > 999) throw new Error("Bad combo");
    out.score = score;
    out.combo = combo;
    const seconds = Math.floor(Number(input.seconds));
    const perfects = Math.floor(Number(input.perfects));
    if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 86400) out.seconds = seconds;
    if (Number.isFinite(perfects) && perfects >= 0 && perfects <= 5000) out.perfects = perfects;
    const boost = Math.floor(Number(input.boost));
    if (Number.isFinite(boost) && boost > 1 && boost <= 3) out.boost = boost;
  }
  if (input.device === "phone" || input.device === "desktop") out.device = input.device;
  if (typeof input.returning === "boolean") out.returning = input.returning;
  if (typeof input.sound === "boolean") out.sound = input.sound;
  if (typeof input.shake === "boolean") out.shake = input.shake;
  const hour = Math.floor(Number(input.hour));
  if (Number.isFinite(hour) && hour >= 0 && hour <= 23) out.hour = hour;
  if (input.mode === "daily" || input.mode === "free" || input.mode === "blitz") {
    out.mode = input.mode;
  }
  if (input.difficulty === "easy" || input.difficulty === "medium" || input.difficulty === "hard") {
    out.difficulty = input.difficulty;
  }
  return out;
}

export const recordEvent = createServerFn({ method: "POST" })
  .validator(cleanEvent)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into plays (visitor, kind, score, combo, seconds, perfects, device, returning_player, sound_on, shake_on, local_hour, mode, difficulty, boost)
      values (
        ${data.visitor}, ${data.kind}, ${data.score ?? null}, ${data.combo ?? null},
        ${data.seconds ?? null}, ${data.perfects ?? null}, ${data.device ?? null},
        ${data.returning ?? null}, ${data.sound ?? null}, ${data.shake ?? null},
        ${data.hour ?? null}, ${data.mode ?? null}, ${data.difficulty ?? null},
        ${data.boost ?? null}
      )
    `;
    return { ok: true as const };
  });

function dayKey(offset: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function fill(order: string[], rows: Slice[]): Slice[] {
  const counted = new Map(rows.map((row) => [row.label, row.count]));
  return order.map((label) => ({ label, count: counted.get(label) ?? 0 }));
}

export const getEngagement = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => ({ token: String(input?.token ?? "") }))
  .handler(async ({ data }): Promise<Engagement> => {
    await requireAdmin(data.token);
    const sql = await getSql();

    const totals = await sql<{
      visitors: number;
      opens: number;
      starts: number;
      finishes: number;
      average: number | null;
      best: number | null;
      seconds: number | null;
      perfects: number | null;
    }>`
      select
        count(distinct visitor)::int as visitors,
        count(*) filter (where kind = 'open')::int as opens,
        count(*) filter (where kind = 'start')::int as starts,
        count(*) filter (where kind = 'finish')::int as finishes,
        avg(score) filter (where kind = 'finish') as average,
        max(score) filter (where kind = 'finish')::int as best,
        avg(seconds) filter (where kind = 'finish' and seconds is not null) as seconds,
        sum(perfects) filter (where kind = 'finish')::int as perfects
      from plays
    `;
    const playerCount = await sql<{ n: number }>`select count(*)::int as n from players`;

    const daily = await sql<{ day: string; opens: number; starts: number; finishes: number }>`
      select
        created_at::date as day,
        count(*) filter (where kind = 'open')::int as opens,
        count(*) filter (where kind = 'start')::int as starts,
        count(*) filter (where kind = 'finish')::int as finishes
      from plays
      where created_at >= now() - interval '13 days'
      group by 1
      order by 1
    `;
    const hourly = await sql<{ hour: number; starts: number; finishes: number }>`
      select
        coalesce(local_hour, extract(hour from created_at)::int)::int as hour,
        count(*) filter (where kind = 'start')::int as starts,
        count(*) filter (where kind = 'finish')::int as finishes
      from plays
      group by 1
      order by 1
    `;
    const spread = await sql<Slice>`
      select
        case
          when score < 5 then '0 to 4'
          when score < 10 then '5 to 9'
          when score < 20 then '10 to 19'
          when score < 40 then '20 to 39'
          else '40+'
        end as label,
        count(*)::int as count
      from plays where kind = 'finish'
      group by 1
    `;
    const streaks = await sql<Slice>`
      select
        case
          when coalesce(combo, 0) < 2 then 'None'
          when combo < 4 then '2 to 3'
          when combo < 7 then '4 to 6'
          when combo < 11 then '7 to 10'
          else '11+'
        end as label,
        count(*)::int as count
      from plays where kind = 'finish'
      group by 1
    `;
    const durations = await sql<Slice>`
      select
        case
          when seconds < 30 then 'Under 30s'
          when seconds < 60 then '30 to 60s'
          when seconds < 120 then '1 to 2 min'
          when seconds < 300 then '2 to 5 min'
          else '5 min+'
        end as label,
        count(*)::int as count
      from plays where kind = 'finish' and seconds is not null
      group by 1
    `;
    const devices = await sql<Slice>`
      select case when device = 'desktop' then 'Desktop' else 'Phone' end as label, count(*)::int as count
      from plays where kind = 'start' and device is not null
      group by 1
    `;
    const mix = await sql<Slice>`
      select case when returning_player then 'Coming back' else 'New' end as label, count(*)::int as count
      from plays where kind = 'open' and returning_player is not null
      group by 1
    `;
    const sound = await sql<Slice>`
      select case when sound_on then 'Sound on' else 'Sound off' end as label, count(*)::int as count
      from plays where kind = 'start' and sound_on is not null
      group by 1
    `;
    const shake = await sql<Slice>`
      select case when shake_on then 'Shake on' else 'Shake off' end as label, count(*)::int as count
      from plays where kind = 'start' and shake_on is not null
      group by 1
    `;
    const modes = await sql<Slice>`
      select
        case
          when mode = 'daily' then 'Daily tide'
          when mode = 'blitz' then 'Tide rush'
          else 'Free play'
        end as label,
        count(*)::int as count
      from plays where kind = 'start' and mode is not null
      group by 1
    `;
    const modeStats = await sql<ModeStat>`
      select
        case
          when mode = 'daily' then 'Daily tide'
          when mode = 'blitz' then 'Tide rush'
          else 'Free play'
        end as label,
        count(*)::int as runs,
        coalesce(avg(score), 0)::float8 as average,
        coalesce(max(score), 0)::int as best
      from plays where kind = 'finish' and mode is not null
      group by 1
    `;
    const rushRows = await sql<{
      runs: number;
      average: number | null;
      best: number | null;
      seconds: number | null;
    }>`
      select count(*)::int as runs, avg(score) as average, max(score)::int as best, avg(seconds) as seconds
      from plays where kind = 'finish' and mode = 'blitz'
    `;
    const difficulties = await sql<Slice>`
      select
        case
          when difficulty = 'easy' then 'Easy'
          when difficulty = 'hard' then 'Hard'
          else 'Medium'
        end as label,
        count(*)::int as count
      from plays where kind = 'finish' and difficulty is not null
      group by 1
    `;
    const places = await sql<Slice>`
      select
        case when pl.region is null then pl.country else pl.region || ', ' || pl.country end as label,
        count(*)::int as count
      from plays p join places pl on pl.visitor = p.visitor
      where p.kind = 'start'
      group by 1
      order by 2 desc
      limit 12
    `;
    const countries = await sql<Slice>`
      select pl.country as label, count(*)::int as count
      from plays p join places pl on pl.visitor = p.visitor
      where p.kind = 'start'
      group by 1
      order by 2 desc
      limit 8
    `;
    const recent = await sql<{
      score: number;
      combo: number;
      seconds: number | null;
      mode: string | null;
      difficulty: string | null;
      at: string;
    }>`
      select
        score::int as score,
        coalesce(combo, 0)::int as combo,
        seconds::int as seconds,
        mode,
        difficulty,
        created_at::text as at
      from plays
      where kind = 'finish'
      order by created_at desc
      limit 8
    `;

    const byDay = new Map(daily.map((row) => [String(row.day).slice(0, 10), row]));
    const days = Array.from({ length: 14 }, (_, i) => {
      const day = dayKey(13 - i);
      const row = byDay.get(day);
      const starts = row?.starts ?? 0;
      const finishes = row?.finishes ?? 0;
      return { day, opens: row?.opens ?? 0, starts, finishes, quits: Math.max(0, starts - finishes) };
    });
    const byHour = new Map(hourly.map((row) => [row.hour, row]));
    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      starts: byHour.get(hour)?.starts ?? 0,
      finishes: byHour.get(hour)?.finishes ?? 0,
    }));
    const row = totals[0];
    const finished = row?.finishes ?? 0;
    return {
      visitors: row?.visitors ?? 0,
      players: playerCount[0]?.n ?? 0,
      opens: row?.opens ?? 0,
      starts: row?.starts ?? 0,
      finishes: row?.finishes ?? 0,
      quits: Math.max(0, (row?.starts ?? 0) - (row?.finishes ?? 0)),
      average: row?.average == null ? 0 : Math.round(Number(row.average) * 10) / 10,
      best: row?.best ?? 0,
      avgSeconds: row?.seconds == null ? 0 : Math.round(Number(row.seconds)),
      avgPerfects: finished > 0 ? Math.round(((row?.perfects ?? 0) / finished) * 10) / 10 : 0,
      days,
      hours,
      buckets: fill(["0 to 4", "5 to 9", "10 to 19", "20 to 39", "40+"], spread),
      streaks: fill(["None", "2 to 3", "4 to 6", "7 to 10", "11+"], streaks),
      durations: fill(["Under 30s", "30 to 60s", "1 to 2 min", "2 to 5 min", "5 min+"], durations),
      devices,
      visitorsMix: mix,
      sound,
      shake,
      modes,
      modeStats: modeStats.map((row) => ({
        label: row.label,
        runs: row.runs,
        average: Math.round(Number(row.average) * 10) / 10,
        best: row.best,
      })),
      difficulties: fill(["Easy", "Medium", "Hard"], difficulties),
      rush: {
        runs: rushRows[0]?.runs ?? 0,
        average:
          rushRows[0]?.average == null ? 0 : Math.round(Number(rushRows[0].average) * 10) / 10,
        best: rushRows[0]?.best ?? 0,
        avgSeconds:
          rushRows[0]?.seconds == null ? 0 : Math.round(Number(rushRows[0].seconds)),
      },
      places,
      countries,
      recent: recent.map((item) => ({
        score: item.score,
        combo: item.combo,
        seconds: item.seconds == null ? null : Number(item.seconds),
        mode: item.mode,
        difficulty: item.difficulty,
        at: item.at,
      })),
    };
  });
