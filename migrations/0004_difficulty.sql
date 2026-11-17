-- Difficulty (easy / medium / hard) is a first-class property of a run, so each
-- difficulty keeps its own board. Existing rows stay on the default.
alter table runs add column if not exists difficulty text not null default 'medium';
create index if not exists runs_mode_difficulty_idx on runs (mode, difficulty, day);

alter table plays add column if not exists difficulty text;
