create table if not exists players (
  id bigserial primary key,
  name text not null,
  name_key text not null unique,
  token_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists runs (
  id bigserial primary key,
  player_id bigint not null references players(id) on delete cascade,
  score integer not null,
  combo integer not null default 0,
  drops integer not null default 0,
  seconds integer not null default 0,
  mode text not null default 'free',
  day date,
  created_at timestamptz not null default now()
);

create index if not exists runs_created_idx on runs (created_at);
create index if not exists runs_player_idx on runs (player_id);
create index if not exists runs_mode_day_idx on runs (mode, day);

create table if not exists places (
  visitor text primary key,
  country text not null,
  region text,
  updated_at timestamptz not null default now()
);

alter table plays add column if not exists device text;
alter table plays add column if not exists returning_player boolean;
alter table plays add column if not exists sound_on boolean;
alter table plays add column if not exists shake_on boolean;
alter table plays add column if not exists local_hour smallint;
alter table plays add column if not exists seconds integer;
alter table plays add column if not exists perfects integer;
alter table plays add column if not exists mode text;
