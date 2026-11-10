-- Map coordinates for listings.
--
-- Adds lat/lng to jobs and fills them in automatically from the listing's
-- address, using Photon, a free address lookup built on OpenStreetMap data
-- (photon.komoot.io). A background job looks up ONE listing a minute, which is
-- well inside fair use and needs no API key.
--
--   geo_precise = true   the pin is the street address (shown on the job page)
--   geo_precise = false  only the suburb/city was found (used on the browse map)
--
-- Safe to run more than once.

alter table public.jobs add column if not exists lat double precision;
alter table public.jobs add column if not exists lng double precision;
alter table public.jobs add column if not exists geo_precise boolean;
alter table public.jobs add column if not exists geocode_tries smallint not null default 0;

create table if not exists public.geocode_requests (
  request_id bigint primary key,
  job_id uuid not null references public.jobs(id) on delete cascade,
  precise boolean not null,
  created_at timestamptz not null default now()
);
alter table public.geocode_requests enable row level security; -- no policies: server-side only

-- If the address or city changes, forget the old pin so it is looked up again.
create or replace function public.reset_job_coordinates() returns trigger
language plpgsql as $$
begin
  if new.address is distinct from old.address or new.city is distinct from old.city
     or new.country is distinct from old.country then
    new.lat := null; new.lng := null; new.geo_precise := null; new.geocode_tries := 0;
  end if;
  return new;
end $$;

drop trigger if exists reset_job_coordinates on public.jobs;
create trigger reset_job_coordinates before update on public.jobs
for each row execute function public.reset_job_coordinates();

create or replace function public.geocode_step() returns void
language plpgsql security definer set search_path = public, net, extensions as $$
declare
  r record;
  j record;
  q text;
  by_address boolean;
  rid bigint;
  hit jsonb;
begin
  -- 1. Read the answers to earlier lookups
  for r in
    select g.request_id, g.job_id, g.precise, resp.status_code, resp.content
    from public.geocode_requests g
    join net._http_response resp on resp.id = g.request_id
  loop
    begin
      if r.status_code = 200 then
        hit := (r.content::jsonb) -> 'features' -> 0;
        if hit is not null and jsonb_array_length(hit -> 'geometry' -> 'coordinates') = 2 then
          update public.jobs
             set lng = (hit -> 'geometry' -> 'coordinates' ->> 0)::double precision,
                 lat = (hit -> 'geometry' -> 'coordinates' ->> 1)::double precision,
                 -- exact only when we asked by street address and got a building or street back
                 geo_precise = r.precise and (hit -> 'properties' ->> 'type') in ('house', 'street')
           where id = r.job_id and lat is null;
        end if;
      end if;
    exception when others then null; -- a bad answer just means no pin
    end;
    delete from public.geocode_requests where request_id = r.request_id;
  end loop;

  -- Lookups that never got an answer
  delete from public.geocode_requests where created_at < now() - interval '15 minutes';

  -- 2. One new lookup at a time
  if exists (select 1 from public.geocode_requests) then return; end if;

  select id, address, city, state, country, geocode_tries into j
  from public.jobs
  where active is not false and lat is null and geocode_tries < 2
    and coalesce(nullif(trim(address), ''), nullif(trim(city), '')) is not null
  order by geocode_tries, created_at desc
  limit 1;
  if not found then return; end if;

  -- First try the street address; if that found nothing, fall back to the city.
  by_address := j.geocode_tries = 0 and coalesce(j.address, '') ~ '\d' and j.address !~* 'not stated';
  if by_address then
    -- "Shop 2/130 Lonsdale St" -> "130 Lonsdale St": unit numbers confuse the lookup
    q := regexp_replace(trim(j.address), '^(shop|unit|suite|level|lot|tenancy)\s*[\w.-]+\s*[/,]\s*', '', 'i');
    q := regexp_replace(q, '^\d+[a-z]?\s*/\s*(?=\d)', '', 'i');
    if coalesce(j.city, '') <> '' and position(lower(split_part(j.city, ' (', 1)) in lower(q)) = 0 then
      q := q || ', ' || split_part(j.city, ' (', 1);
    end if;
    q := q || ', ' || coalesce(j.country, '');
  else
    q := concat_ws(', ', nullif(split_part(coalesce(j.city, ''), ' (', 1), ''), nullif(j.state, ''), nullif(j.country, ''));
  end if;

  update public.jobs set geocode_tries = case when by_address then 1 else 2 end where id = j.id;

  select net.http_get(
    url := 'https://photon.komoot.io/api/',
    params := jsonb_build_object('q', q, 'limit', '1', 'lang', 'en'),
    headers := jsonb_build_object('User-Agent', 'HospoSearch job board (https://www.hosposearch.com)'),
    timeout_milliseconds := 20000
  ) into rid;
  insert into public.geocode_requests (request_id, job_id, precise) values (rid, j.id, by_address);
end $$;

revoke all on function public.geocode_step() from public, anon, authenticated;

-- Run every minute. Re-running this file replaces the schedule rather than adding a second one.
select cron.unschedule(jobid) from cron.job where jobname = 'geocode-jobs';
select cron.schedule('geocode-jobs', '* * * * *', $cron$select public.geocode_step()$cron$);
