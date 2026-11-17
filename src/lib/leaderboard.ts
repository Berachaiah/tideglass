import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { checkName } from "@/lib/names";

export type Period = "all" | "week" | "day";

export type BoardRow = { name: string; score: number };
export type Board = {
  rows: BoardRow[];
  me: { rank: number; score: number } | null;
  total: number;
  /** Where a finished run's score lands, computed server-side. */
  percentile: { beaten: number; total: number } | null;
};

const TOKEN = /^[a-f0-9]{32,64}$/;

async function sha(token: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(token).digest("hex");
}

function utcDay(offset = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

type ClaimInput = { name: string; token: string };

function cleanClaim(input: ClaimInput): ClaimInput {
  const checked = checkName(input?.name);
  if (!checked.ok) throw new Error(checked.reason);
  const token = String(input?.token ?? "");
  if (!TOKEN.test(token)) throw new Error("Bad token");
  return { name: checked.name, token };
}

type Claimed = { ok: true; id: number; name: string } | { ok: false; error: string };

async function claim(name: string, token: string): Promise<Claimed> {
  const checked = checkName(name);
  if (!checked.ok) return { ok: false, error: checked.reason };
  const sql = await getSql();
  const hash = await sha(token);
  const found = await sql<{ id: number; token_hash: string; name: string }>`
    select id, token_hash, name from players where name_key = ${checked.key}
  `;
  if (found[0]) {
    if (found[0].token_hash !== hash) return { ok: false, error: "That name is taken. Try another." };
    return { ok: true, id: found[0].id, name: found[0].name };
  }
  await sql`
    insert into players (name, name_key, token_hash)
    values (${checked.name}, ${checked.key}, ${hash})
    on conflict (name_key) do nothing
  `;
  const again = await sql<{ id: number; token_hash: string; name: string }>`
    select id, token_hash, name from players where name_key = ${checked.key}
  `;
  if (!again[0] || again[0].token_hash !== hash) return { ok: false, error: "That name is taken. Try another." };
  return { ok: true, id: again[0].id, name: again[0].name };
}

export const claimName = createServerFn({ method: "POST" })
  .validator(cleanClaim)
  .handler(async ({ data }) => {
    const result = await claim(data.name, data.token);
    return result.ok ? ({ ok: true as const, name: result.name }) : result;
  });

type RunInput = {
  name: string;
  token: string;
  score: number;
  combo: number;
  drops: number;
  seconds: number;
  mode: "free" | "daily";
  day: string;
};

function int(value: unknown, max: number) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error("Bad number");
  return n;
}

function cleanRun(input: RunInput): RunInput {
  const base = cleanClaim({ name: input?.name, token: input?.token });
  const mode = input?.mode === "daily" ? "daily" : "free";
  const day = String(input?.day ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Bad day");
  return {
    ...base,
    score: int(input?.score, 99999),
    combo: int(input?.combo, 999),
    drops: int(input?.drops, 5000),
    seconds: int(input?.seconds, 86400),
    mode,
    day,
  };
}

export type RunResult =
  | { ok: true; rank: number; total: number; best: number }
  | { ok: false; error: string };

export const submitRun = createServerFn({ method: "POST" })
  .validator(cleanRun)
  .handler(async ({ data }): Promise<RunResult> => {
    const { score, drops, seconds } = data;
    // A run has to be physically possible: every drop takes time, every
    // successful drop is worth at least 1, and a perfect streak caps the score.
    if (score < 1) return { ok: false, error: "Nothing to post." };
    if (score < drops || score > (drops * (drops + 1)) / 2) return { ok: false, error: "That run did not add up." };
    if (seconds + 2 < drops * 0.35) return { ok: false, error: "That run was too fast." };
    if (data.mode === "daily" && data.day !== utcDay() && data.day !== utcDay(-1)) {
      return { ok: false, error: "That tide has already passed." };
    }
    const who = await claim(data.name, data.token);
    if (!who.ok) return who;
    const sql = await getSql();
    const recent = await sql<{ n: number }>`
      select count(*)::int as n from runs
      where player_id = ${who.id} and created_at > now() - interval '4 seconds'
    `;
    if ((recent[0]?.n ?? 0) > 0) return { ok: false, error: "Slow down a moment." };
    await sql`
      insert into runs (player_id, score, combo, drops, seconds, mode, day)
      values (${who.id}, ${score}, ${data.combo}, ${drops}, ${seconds}, ${data.mode}, ${data.mode === "daily" ? data.day : null})
    `;
    const mine = await sql<{ score: number }>`
      select max(score)::int as score from runs
      where player_id = ${who.id} and mode = ${data.mode}
        and (${data.mode} = 'free' or day = ${data.day})
    `;
    const best = mine[0]?.score ?? score;
    const ahead = await sql<{ n: number; total: number }>`
      select
        count(*) filter (where top > ${best})::int as n,
        count(*)::int as total
      from (
        select max(score) as top from runs
        where mode = ${data.mode} and (${data.mode} = 'free' or day = ${data.day})
        group by player_id
      ) t
    `;
    return { ok: true, rank: (ahead[0]?.n ?? 0) + 1, total: ahead[0]?.total ?? 1, best };
  });

type BoardInput = { period: Period; name?: string; limit?: number; score?: number };

function cleanBoard(input: BoardInput): BoardInput {
  const period: Period = input?.period === "week" || input?.period === "day" ? input.period : "all";
  const checked = input?.name ? checkName(input.name) : null;
  const limit = Math.max(1, Math.min(100, Math.floor(Number(input?.limit ?? 50)) || 50));
  // A finished run's score, so the board can place it without needing a name.
  const score = Math.floor(Number(input?.score));
  const cleanScore = Number.isFinite(score) && score > 0 ? Math.min(99999, score) : undefined;
  return { period, name: checked && checked.ok ? checked.name : undefined, limit, score: cleanScore };
}

export const getBoard = createServerFn({ method: "POST" })
  .validator(cleanBoard)
  .handler(async ({ data }): Promise<Board> => {
    const sql = await getSql();
    const mode = data.period === "day" ? "daily" : "free";
    const today = utcDay();
    const since = data.period === "week" ? utcDay(-6) : "1970-01-01";
    const rows = await sql<{ name: string; score: number; player_id: number }>`
      select p.name, max(r.score)::int as score, r.player_id
      from runs r join players p on p.id = r.player_id
      where r.mode = ${mode}
        and (${mode} = 'free' or r.day = ${today})
        and r.created_at >= ${since}::date
      group by r.player_id, p.name
      order by score desc, min(r.created_at) asc
      limit ${data.limit ?? 50}
    `;
    const totalRow = await sql<{ total: number }>`
      select count(distinct r.player_id)::int as total from runs r
      where r.mode = ${mode}
        and (${mode} = 'free' or r.day = ${today})
        and r.created_at >= ${since}::date
    `;
    let percentile: Board["percentile"] = null;
    if (data.score != null) {
      const ahead = await sql<{ beaten: number; total: number }>`
        select
          count(*) filter (where top < ${data.score})::int as beaten,
          count(*)::int as total
        from (
          select max(r.score) as top from runs r
          where r.mode = ${mode}
            and (${mode} = 'free' or r.day = ${today})
            and r.created_at >= ${since}::date
          group by r.player_id
        ) t
      `;
      percentile = { beaten: ahead[0]?.beaten ?? 0, total: ahead[0]?.total ?? 0 };
    }

    let me: Board["me"] = null;
    if (data.name) {
      const key = checkName(data.name);
      if (key.ok) {
        const mine = await sql<{ score: number }>`
          select max(r.score)::int as score
          from runs r join players p on p.id = r.player_id
          where p.name_key = ${key.key} and r.mode = ${mode}
            and (${mode} = 'free' or r.day = ${today})
            and r.created_at >= ${since}::date
        `;
        const score = mine[0]?.score;
        if (score != null) {
          const ahead = await sql<{ n: number }>`
            select count(*)::int as n from (
              select max(r.score) as top from runs r
              where r.mode = ${mode}
                and (${mode} = 'free' or r.day = ${today})
                and r.created_at >= ${since}::date
              group by r.player_id
            ) t where top > ${score}
          `;
          me = { rank: (ahead[0]?.n ?? 0) + 1, score };
        }
      }
    }
    return {
      rows: rows.map((row) => ({ name: row.name, score: row.score })),
      me,
      total: totalRow[0]?.total ?? 0,
      percentile,
    };
  });

// Location: state and country only. Coordinates are used for one lookup and are
// never written anywhere.
type PlaceInput = { visitor: string; lat: number; lng: number };

function cleanPlaceInput(input: PlaceInput): PlaceInput {
  const visitor = String(input?.visitor ?? "");
  if (!/^[a-z0-9]{16,40}$/.test(visitor)) throw new Error("Bad visitor");
  const lat = Number(input?.lat);
  const lng = Number(input?.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error("Bad place");
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error("Bad place");
  return { visitor, lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10 };
}

function tidyPlace(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/\s*\((the)\)\s*$/i, "")
    .replace(/\s+(State|Province|Region|Governorate|Prefecture|County|Department)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 2 || text.length > 60) return null;
  if (!/^[\p{L}][\p{L}\p{M} .'’-]*$/u.test(text)) return null;
  return text;
}

async function lookup(lat: number, lng: number) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { countryName?: string; principalSubdivision?: string };
    const country = tidyPlace(json.countryName);
    if (!country) return null;
    return { country, region: tidyPlace(json.principalSubdivision) };
  } catch {
    return null;
  }
}

async function fromHeaders() {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const code = getRequestHeader("x-vercel-ip-country");
    if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase());
    const country = tidyPlace(name);
    return country ? { country, region: null } : null;
  } catch {
    return null;
  }
}

export type Place = { country: string; region: string | null };

export const savePlace = createServerFn({ method: "POST" })
  .validator(cleanPlaceInput)
  .handler(async ({ data }): Promise<Place | null> => {
    const found = (await lookup(data.lat, data.lng)) ?? (await fromHeaders());
    if (!found) return null;
    const sql = await getSql();
    await sql`
      insert into places (visitor, country, region)
      values (${data.visitor}, ${found.country}, ${found.region})
      on conflict (visitor) do update set country = excluded.country, region = excluded.region, updated_at = now()
    `;
    return found;
  });

export const clearPlace = createServerFn({ method: "POST" })
  .validator((input: { visitor: string }) => {
    const visitor = String(input?.visitor ?? "");
    if (!/^[a-z0-9]{16,40}$/.test(visitor)) throw new Error("Bad visitor");
    return { visitor };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from places where visitor = ${data.visitor}`;
    return { ok: true as const };
  });
