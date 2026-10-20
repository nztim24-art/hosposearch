-- ════════════════════════════════════════════════════════════════════════════
-- HospoSearch security fixes — PART 1 of 2
-- Run BEFORE the new site code goes live. Everything here is compatible with
-- the site that's live now, so nothing breaks in between.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Admins: a private list of admin login accounts ──────────────────────────
create table if not exists public.admins (
  auth_id    uuid primary key,
  email      text,
  created_at timestamptz default now()
);
alter table public.admins enable row level security;   -- no policies = nobody can read/write it via the API
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.admins where auth_id = auth.uid())
$$;

-- The signed-in user's profile id (their first profile if they have two)
create or replace function public.my_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_id = auth.uid() order by created_at limit 1
$$;

-- Every profile id belonging to the signed-in user (some people have an employer and a job-seeker profile)
create or replace function public.my_profile_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_id = auth.uid()
$$;

-- True if the signed-in user has applied to this job (lets applicants still see a job after it closes)
create or replace function public.i_applied_to(p_job uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.applications a
                 where a.job_id = p_job and a.applicant_id in (select public.my_profile_ids()))
$$;

-- True if the signed-in user owns the employer profile behind this job
create or replace function public.i_own_job(p_emp_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_emp_id is not null and p_emp_id in (select x::text from public.my_profile_ids() x)
$$;

-- ─── Profiles: protect account, payment and verification fields ─────────────
-- Users can still edit their own name, bio, photos, contact settings etc.
-- They can no longer change their plan, slot count, verified tick, account
-- type, Stripe ids or login email. Changes to those are silently kept as they were.
create or replace function public.protect_profile_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Only direct edits from the website (roles anon/authenticated) are limited.
  -- The server (service role), admins, dashboard edits and built-in functions are not.
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verified := false;
    new.is_trial := false;
    new.subscription_tier := null;
    new.subscription_active := false;
    new.subscription_limit := 0;
    new.subscription_used := 0;
    new.subscription_start := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    if new.type is distinct from 'employer' then new.type := 'employee'; end if;
    new.auth_id := auth.uid();
    new.email := coalesce(auth.email(), new.email);
  else
    new.id := old.id;
    new.auth_id := old.auth_id;
    new.email := old.email;
    new.type := old.type;
    new.verified := old.verified;
    new.is_trial := old.is_trial;
    new.subscription_tier := old.subscription_tier;
    new.subscription_active := old.subscription_active;
    new.subscription_limit := old.subscription_limit;
    new.subscription_used := old.subscription_used;
    new.subscription_start := old.subscription_start;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields before insert or update on public.profiles
  for each row execute function public.protect_profile_fields();

-- New profiles must belong to the person creating them
drop policy if exists "Anyone can insert profile" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
  for insert to authenticated with check (auth_id = auth.uid());

-- Full own profile (all columns) — the app uses this instead of select('*')
create or replace function public.get_my_profile() returns setof public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where auth_id = auth.uid() order by created_at limit 1
$$;

-- The user's other profile (employer ↔ job seeker) for the account switcher
create or replace function public.get_my_alt_profile(p_type text) returns setof public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles
   where type = p_type
     and (auth_id = auth.uid() or (auth.email() is not null and lower(email) = lower(auth.email())))
   order by created_at limit 1
$$;

-- Admin: every profile, all columns
create or replace function public.admin_list_profiles() returns setof public.profiles
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  return query select * from public.profiles order by created_at desc;
end $$;

-- Admin: look up a profile by email (used to transfer a listing)
create or replace function public.admin_find_profile(p_email text)
returns table (id uuid, name text, handle text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  return query select p.id, p.name, p.handle from public.profiles p where lower(p.email) = lower(p_email) limit 1;
end $$;

-- Job seekers who chose to be discoverable. Contact details and CV are only
-- included when the candidate switched them on, and only for signed-in employers.
create or replace function public.discoverable_profiles() returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  is_emp boolean := public.is_admin() or exists (
    select 1 from public.profiles where auth_id = auth.uid() and type = 'employer');
begin
  return query
  select (to_jsonb(p) - array['email','phone','contact_email','contact_phone','resume_url','resume_name',
                              'cover_url','cover_name','work_link','stripe_customer_id','stripe_subscription_id',
                              'subscription_tier','subscription_active','subscription_limit','subscription_used',
                              'subscription_start','auth_id'])
         || jsonb_build_object(
              'contact_email', case when is_emp and p.show_email is not false then coalesce(p.contact_email, p.email) end,
              'contact_phone', case when is_emp and p.show_phone is true then coalesce(p.contact_phone, p.phone) end,
              'resume_url',    case when is_emp and p.show_resume is not false then p.resume_url end,
              'resume_name',   case when is_emp and p.show_resume is not false then p.resume_name end,
              'work_link',     case when is_emp and p.show_link is not false then p.work_link end)
    from public.profiles p
   where p.type = 'employee' and p.is_public = true
   order by p.updated_at desc;
end $$;

-- ─── Jobs: unpaid drafts are private to their owner ─────────────────────────
drop policy if exists "Read active or own jobs" on public.jobs;
drop policy if exists "Read live, own or applied jobs" on public.jobs;
create policy "Read live, own or applied jobs" on public.jobs for select using (
  active = true or public.i_own_job(emp_id) or public.is_admin() or public.i_applied_to(id)
);
drop policy if exists "Admins manage jobs" on public.jobs;
create policy "Admins manage jobs" on public.jobs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Applications: admin access ──────────────────────────────────────────────
drop policy if exists "Admins manage applications" on public.applications;
create policy "Admins manage applications" on public.applications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Discount codes: no more public list ─────────────────────────────────────
drop policy if exists "Anyone can read active codes" on public.discount_codes;
drop policy if exists "Admins manage codes" on public.discount_codes;
create policy "Admins manage codes" on public.discount_codes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Check one code at checkout (returns nothing if it's not valid)
create or replace function public.check_discount_code(p_code text)
returns table (code text, pct integer)
language sql stable security definer set search_path = public as $$
  select d.code, d.pct from public.discount_codes d
   where upper(d.code) = upper(trim(p_code)) and d.active = true
     and (d.expires_at is null or d.expires_at > now())
     and (d.max_uses is null or coalesce(d.used,0) < d.max_uses)
   limit 1
$$;

-- Only the server (payments) may count a code as used
revoke execute on function public.increment_code_usage(text) from public, anon, authenticated;
grant execute on function public.increment_code_usage(text) to service_role;
alter function public.increment_code_usage(text) set search_path = public;

-- ─── Sent emails log: admin only ─────────────────────────────────────────────
drop policy if exists "Anyone can read sent emails" on public.sent_emails;
drop policy if exists "Admins read sent emails" on public.sent_emails;
create policy "Admins read sent emails" on public.sent_emails for select to authenticated using (public.is_admin());

-- ─── Storage: CVs can no longer be listed or deleted by other people ─────────
-- job-photos: public photos stay public, but nobody can list the applicants/ folder
drop policy if exists "Anyone can read job photos" on storage.objects;
drop policy if exists "Read job photos (not CVs)" on storage.objects;
create policy "Read job photos (not CVs)" on storage.objects for select using (
  bucket_id = 'job-photos' and (left(name, 11) <> 'applicants/' or public.is_admin())
);
drop policy if exists "Anyone can upload job photos" on storage.objects;
drop policy if exists "Signed-in users upload job photos" on storage.objects;
create policy "Signed-in users upload job photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'job-photos');

-- documents (profile CVs, stored as profiles/<profile id>/...):
-- the owner, admins, and employers the candidate applied to or shared their CV with
create or replace function public.can_read_document(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  parts text[] := string_to_array(p_name, '/');
  pid uuid;
begin
  if public.is_admin() then return true; end if;
  if array_length(parts, 1) < 3 or parts[1] not in ('profiles','applicants') then return false; end if;
  begin pid := parts[2]::uuid; exception when others then return false; end;
  if pid in (select public.my_profile_ids()) then return true; end if;
  -- employer reading a CV from someone who applied to one of their jobs
  if exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id
              where a.applicant_id = pid and public.i_own_job(j.emp_id)) then return true; end if;
  -- employer reading a CV the candidate chose to share on their public profile
  if exists (select 1 from public.profiles c where c.id = pid and c.is_public and c.show_resume is not false)
     and exists (select 1 from public.profiles e where e.auth_id = auth.uid() and e.type = 'employer') then
    return true;
  end if;
  return false;
end $$;

create or replace function public.owns_document_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(p_name, '/'); pid uuid;
begin
  if array_length(parts, 1) < 3 or parts[1] not in ('profiles','applicants') then return false; end if;
  begin pid := parts[2]::uuid; exception when others then return false; end;
  return pid in (select public.my_profile_ids());
end $$;

drop policy if exists "Anyone can upload documents" on storage.objects;
drop policy if exists "Authenticated can read documents" on storage.objects;
drop policy if exists "Authenticated can upload documents" on storage.objects;
drop policy if exists "Authenticated can delete own documents" on storage.objects;
drop policy if exists "Read permitted documents" on storage.objects;
drop policy if exists "Upload own documents" on storage.objects;
drop policy if exists "Replace own documents" on storage.objects;
drop policy if exists "Delete own documents" on storage.objects;
create policy "Read permitted documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.can_read_document(name));
create policy "Upload own documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.owns_document_path(name));
create policy "Replace own documents" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.owns_document_path(name))
  with check (bucket_id = 'documents' and public.owns_document_path(name));
create policy "Delete own documents" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (public.owns_document_path(name) or public.is_admin()));

-- ─── Function permissions ────────────────────────────────────────────────────
revoke execute on function public.admin_list_profiles() from public, anon;
revoke execute on function public.admin_find_profile(text) from public, anon;
grant execute on function public.admin_list_profiles(), public.admin_find_profile(text),
  public.get_my_profile(), public.get_my_alt_profile(text), public.discoverable_profiles(),
  public.check_discount_code(text), public.is_admin() to authenticated;
grant execute on function public.check_discount_code(text), public.discoverable_profiles(), public.is_admin() to anon;
