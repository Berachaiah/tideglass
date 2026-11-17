create table if not exists plays (
  id bigserial primary key,
  visitor text not null,
  kind text not null,
  score integer,
  combo integer,
  created_at timestamptz not null default now()
);

create index if not exists plays_created_idx on plays (created_at);
create index if not exists plays_kind_idx on plays (kind);
