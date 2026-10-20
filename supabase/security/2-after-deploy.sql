-- ════════════════════════════════════════════════════════════════════════════
-- HospoSearch security fixes — PART 2 of 2
-- Run AFTER the new site code is live (the old code relies on what this removes).
-- Safe to re-run. To reverse it, run 2-undo.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Profiles: hide private details from everyone else ───────────────────────
-- Emails, phone numbers, CV links, Stripe ids and plan details are no longer
-- readable through the public API. People get their own full profile through
-- get_my_profile(); employers get opted-in contact details through
-- discoverable_profiles(); admins use admin_list_profiles().
revoke select on public.profiles from anon, authenticated;
grant select (
  id, auth_id, name, handle, avatar, type, bio, verified, available, cuisine, venue_size, awards,
  is_trial, role, experience, location, cuisine_tags, skills, work_history, portfolio_photos,
  portfolio_links, created_at, updated_at, avatar_url, instagram, is_public, country, work_photos,
  sector, headline, show_email, show_phone, show_resume, show_link, state, city, years_exp,
  email_notifications
) on public.profiles to anon, authenticated;

-- ─── CVs on profiles: private bucket, opened with short-lived links ──────────
update storage.buckets set public = false where id = 'documents';

-- ─── Jobs: listings only go live through payment or a plan slot ──────────────
-- Helper: take one plan slot for this employer if they have one free.
create or replace function public.take_subscription_slot(p_emp_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.profiles
     set subscription_used = coalesce(subscription_used, 0) + 1
   where id::text = p_emp_id
     and (auth_id = auth.uid() or auth.uid() is null)   -- only ever your own slots
     and subscription_active is true
     and coalesce(subscription_used, 0) < coalesce(subscription_limit, 0);
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke execute on function public.take_subscription_slot(text) from public, anon;
grant execute on function public.take_subscription_slot(text) to authenticated;

create or replace function public.employer_is_verified(p_emp_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select verified from public.profiles where id::text = p_emp_id), false)
$$;

create or replace function public.protect_job_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Only direct edits from the website (roles anon/authenticated) are limited.
  -- The Stripe webhook, admins, dashboard edits and counters are not.
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified := public.employer_is_verified(new.emp_id);
    new.featured := false;
    new.tier := 'bronze';
    new.views := 0;
    new.share_count := 0;
    if coalesce(new.active, true) or coalesce(new.paid, false) then
      -- Wants to go live straight away: only with a free plan slot
      if public.take_subscription_slot(new.emp_id) then
        new.active := true;
        new.paid := true;
        new.expires_at := now() + interval '30 days';
      else
        new.active := false;
        new.paid := false;
      end if;
    else
      new.paid := false;
    end if;
    return new;
  end if;

  -- UPDATE: owners can edit the listing text and photos, pause it, or relist it
  -- with a plan slot. Payment, tier, featured, verified and counters stay as they were.
  new.id := old.id;
  new.emp_id := old.emp_id;
  new.paid := old.paid;
  new.tier := old.tier;
  new.featured := old.featured;
  new.verified := old.verified;
  new.views := old.views;
  new.share_count := old.share_count;
  new.last_shared_at := old.last_shared_at;
  new.created_at := old.created_at;
  new.expires_at := old.expires_at;

  if coalesce(new.active, false) and not coalesce(old.active, false) then
    -- Re-listing: needs a free plan slot (paid relists go through Stripe instead)
    if public.take_subscription_slot(old.emp_id) then
      new.active := true;
      new.paid := true;
      new.tier := 'bronze';
      new.featured := false;
      new.expires_at := now() + interval '30 days';
    else
      new.active := old.active;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_job_fields on public.jobs;
create trigger protect_job_fields before insert or update on public.jobs
  for each row execute function public.protect_job_fields();

-- The website used to take the plan slot with a separate call. The rule above
-- now does it, so this call just reports status without taking another slot.
create or replace function public.consume_subscription_listing() returns json
language plpgsql security definer set search_path = public as $$
declare prof public.profiles%rowtype;
begin
  select * into prof from public.profiles where auth_id = auth.uid() order by created_at limit 1;
  if not found then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  return json_build_object('ok', true, 'used', coalesce(prof.subscription_used,0), 'limit', coalesce(prof.subscription_limit,0));
end $$;
