-- A gift boost multiplies score, so the run has to carry the multiplier it was
-- played with: it is what makes the submitted score verifiable.
alter table runs add column if not exists boost smallint not null default 1;
alter table plays add column if not exists boost smallint;
