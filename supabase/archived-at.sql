-- HospoSearch: tell "archived" apart from "expired".
-- Additive and safe to re-run. The site works with or without it: until it is
-- run, archiving a listing falls back to the old behaviour (shows as Expired).
alter table public.jobs add column if not exists archived_at timestamptz;

-- A listing that goes live again (relist, renewal, Stripe webhook) is no longer
-- archived, so clear the marker automatically whichever code path reactivates it.
create or replace function public.clear_archived_at() returns trigger
language plpgsql as $$
begin
  if new.active is true and old.active is distinct from true then
    new.archived_at := null;
  end if;
  return new;
end $$;

drop trigger if exists jobs_clear_archived_at on public.jobs;
create trigger jobs_clear_archived_at before update on public.jobs
  for each row execute function public.clear_archived_at();
