-- ─── HospoSearch Database Schema ─────────────────────────────────────────────
-- Run this entire file in your Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → paste this → Run

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Profiles (both employers and candidates) ─────────────────────────────────
create table if not exists profiles (
  id           uuid primary key default uuid_generate_v4(),
  auth_id      uuid unique,              -- links to Supabase auth.users
  email        text unique not null,
  name         text not null,
  handle       text unique,
  avatar       text default '🍽️',
  type         text not null check (type in ('employer','employee','admin')),
  bio          text default '',
  verified     boolean default false,
  available    boolean default true,
  -- employer fields
  cuisine      text default '',
  venue_size   text default '',
  awards       jsonb default '[]',
  is_trial     boolean default false,
  -- employee fields
  role         text default '',
  experience   text default '',
  location     text default '',
  cuisine_tags jsonb default '[]',
  skills       jsonb default '[]',
  work_history jsonb default '[]',
  portfolio_photos jsonb default '[]',
  portfolio_links  jsonb default '[]',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── Jobs ─────────────────────────────────────────────────────────────────────
create table if not exists jobs (
  id           uuid primary key default uuid_generate_v4(),
  emp_id       uuid references profiles(id) on delete cascade,
  title        text not null,
  venue        text not null,
  loc          text default 'Australia',
  country      text default 'Australia',
  state        text default '',
  city         text default '',
  sector       text default '',
  role_type    text default '',
  salary       text default 'Competitive',
  salary_band  text default '',
  type         text default 'Full-time',
  tags         jsonb default '[]',
  short        text default '',
  full_desc    text default '',
  link         text default '#',
  photos       jsonb default '[]',
  video_url    text,
  verified     boolean default false,
  featured     boolean default false,
  views        integer default 0,
  active       boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── Applications ─────────────────────────────────────────────────────────────
create table if not exists applications (
  id           uuid primary key default uuid_generate_v4(),
  job_id       uuid references jobs(id) on delete cascade,
  applicant_id uuid references profiles(id) on delete cascade,
  name         text not null,
  message      text default '',
  visa         text default '',
  availability jsonb default '[]',
  hours        jsonb default '[]',
  notice       text default '',
  resume_name  text,
  resume_size  integer,
  cover_name   text,
  status       text default 'Sent' check (status in ('Sent','Viewed','Shortlisted','No thanks')),
  created_at   timestamptz default now(),
  unique(job_id, applicant_id)
);

-- ─── Messages ─────────────────────────────────────────────────────────────────
create table if not exists messages (
  id           uuid primary key default uuid_generate_v4(),
  from_id      uuid references profiles(id) on delete cascade,
  to_id        uuid references profiles(id) on delete cascade,
  text         text not null,
  read         boolean default false,
  created_at   timestamptz default now()
);

-- ─── Bookmarks ────────────────────────────────────────────────────────────────
create table if not exists bookmarks (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references profiles(id) on delete cascade,
  job_id       uuid references jobs(id) on delete cascade,
  created_at   timestamptz default now(),
  unique(user_id, job_id)
);

-- ─── Following (candidates following employers) ───────────────────────────────
create table if not exists following (
  id           uuid primary key default uuid_generate_v4(),
  follower_id  uuid references profiles(id) on delete cascade,
  employer_id  uuid references profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  unique(follower_id, employer_id)
);

-- ─── Job Alerts ───────────────────────────────────────────────────────────────
create table if not exists job_alerts (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references profiles(id) on delete cascade,
  role         text not null,
  location     text default '',
  emp_type     text default 'Any',
  salary_band  text default 'Any',
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ─── References ───────────────────────────────────────────────────────────────
create table if not exists references_table (
  id             uuid primary key default uuid_generate_v4(),
  candidate_id   uuid references profiles(id) on delete cascade,
  venue          text not null,
  ref_name       text not null,
  ref_role       text default '',
  ref_email      text default '',
  status         text default 'pending' check (status in ('pending','confirmed','declined')),
  reference_text text default '',
  skills         jsonb default '[]',
  created_at     timestamptz default now()
);

-- ─── Skill Endorsements ───────────────────────────────────────────────────────
create table if not exists endorsements (
  id           uuid primary key default uuid_generate_v4(),
  candidate_id uuid references profiles(id) on delete cascade,
  endorser_id  uuid references profiles(id) on delete cascade,
  skill        text not null,
  created_at   timestamptz default now(),
  unique(candidate_id, endorser_id, skill)
);

-- ─── Discount Codes ───────────────────────────────────────────────────────────
create table if not exists discount_codes (
  id           uuid primary key default uuid_generate_v4(),
  code         text unique not null,
  pct          integer not null check (pct > 0 and pct <= 100),
  max_uses     integer default 100,
  used         integer default 0,
  description  text default '',
  expires_at   timestamptz,
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ─── Notifications ────────────────────────────────────────────────────────────
create table if not exists notifications (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references profiles(id) on delete cascade,
  type         text not null,
  text         text not null,
  sub          text default '',
  icon         text default '🔔',
  read         boolean default false,
  created_at   timestamptz default now()
);

-- ─── Row Level Security (RLS) ─────────────────────────────────────────────────
-- Enable RLS on all tables
alter table profiles          enable row level security;
alter table jobs              enable row level security;
alter table applications      enable row level security;
alter table messages          enable row level security;
alter table bookmarks         enable row level security;
alter table following         enable row level security;
alter table job_alerts        enable row level security;
alter table references_table  enable row level security;
alter table endorsements      enable row level security;
alter table discount_codes    enable row level security;
alter table notifications     enable row level security;

-- Profiles: anyone can read, only owner can update
create policy "Public profiles readable" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = auth_id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = auth_id);

-- Jobs: anyone can read active jobs, employers can manage own
create policy "Anyone can read active jobs" on jobs for select using (active = true);
create policy "Employers can insert jobs" on jobs for insert with check (
  exists (select 1 from profiles where auth_id = auth.uid() and type = 'employer' and id = emp_id)
);
create policy "Employers can update own jobs" on jobs for update using (
  exists (select 1 from profiles where auth_id = auth.uid() and id = emp_id)
);

-- Applications: applicants see own, employers see apps for their jobs
create policy "Applicants can see own applications" on applications for select using (
  exists (select 1 from profiles where auth_id = auth.uid() and id = applicant_id)
);
create policy "Employers can see apps for their jobs" on applications for select using (
  exists (select 1 from jobs j join profiles p on p.id = j.emp_id where j.id = job_id and p.auth_id = auth.uid())
);
create policy "Applicants can insert applications" on applications for insert with check (
  exists (select 1 from profiles where auth_id = auth.uid() and id = applicant_id)
);
create policy "Employers can update application status" on applications for update using (
  exists (select 1 from jobs j join profiles p on p.id = j.emp_id where j.id = job_id and p.auth_id = auth.uid())
);

-- Messages: only sender and recipient can see
create policy "Message participants can read" on messages for select using (
  exists (select 1 from profiles where auth_id = auth.uid() and (id = from_id or id = to_id))
);
create policy "Authenticated users can send messages" on messages for insert with check (
  exists (select 1 from profiles where auth_id = auth.uid() and id = from_id)
);

-- Bookmarks: users manage own
create policy "Users manage own bookmarks" on bookmarks for all using (
  exists (select 1 from profiles where auth_id = auth.uid() and id = user_id)
);

-- Following: users manage own
create policy "Users manage own following" on following for all using (
  exists (select 1 from profiles where auth_id = auth.uid() and id = follower_id)
);

-- Job alerts: users manage own
create policy "Users manage own alerts" on job_alerts for all using (
  exists (select 1 from profiles where auth_id = auth.uid() and id = user_id)
);

-- References: candidates manage own, public can read confirmed
create policy "Candidates manage own references" on references_table for all using (
  exists (select 1 from profiles where auth_id = auth.uid() and id = candidate_id)
);
create policy "Anyone can read confirmed references" on references_table for select using (status = 'confirmed');

-- Endorsements: anyone can read, employers can endorse
create policy "Anyone can read endorsements" on endorsements for select using (true);
create policy "Employers can endorse" on endorsements for insert with check (
  exists (select 1 from profiles where auth_id = auth.uid() and type = 'employer' and id = endorser_id)
);

-- Discount codes: only admin can manage, anyone can read active ones
create policy "Anyone can read active codes" on discount_codes for select using (active = true);

-- Notifications: users see own
create policy "Users see own notifications" on notifications for all using (
  exists (select 1 from profiles where auth_id = auth.uid() and id = user_id)
);

-- ─── Seed discount codes ──────────────────────────────────────────────────────
insert into discount_codes (code, pct, max_uses, used, description, expires_at) values
  ('HOSPO25',    25, 100, 0, '25% off — early partner offer',    '2026-12-31'),
  ('LAUNCH50',   50,  20, 0, '50% off — launch special',         '2026-06-30'),
  ('FEATURED20', 20,  50, 0, '20% off featured listing upgrade', '2026-09-30'),
  ('FRIEND10',   10, 999, 0, '10% off — referral code',          '2027-01-01')
on conflict (code) do nothing;

-- ─── Functions ────────────────────────────────────────────────────────────────
-- Increment job view count
create or replace function increment_job_views(job_id uuid)
returns void language plpgsql security definer as $$
begin
  update jobs set views = views + 1 where id = job_id;
end;
$$;

-- Auto-update updated_at timestamp
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_updated_at     before update on jobs     for each row execute function update_updated_at();
create trigger profiles_updated_at before update on profiles for each row execute function update_updated_at();
