-- =========================
-- CRE Console Database Schema
-- =========================
-- Run this in your Supabase SQL editor to set up the database

-- =========================
-- Enums
-- =========================
create type lead_status as enum ('new','qualified','in_discussion','touring','negotiating','won','lost');
create type lead_priority as enum ('low','med','high');
create type opp_stage as enum ('sourcing','outreach','tour','proposal','loi','lease','closed_won','closed_lost');
create type activity_entity as enum ('lead','opportunity');
create type activity_type as enum ('note','status_change','assignment','import');
create type user_role as enum ('admin','agent','viewer');

-- =========================
-- Profiles (mirror of auth.users)
-- =========================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'agent',
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_profiles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
before update on profiles
for each row execute procedure public.touch_profiles_updated_at();

-- Helper functions
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists(
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_viewer() returns boolean
language sql stable as $$
  select exists(
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'viewer'
  );
$$;

-- =========================
-- Core tables
-- =========================
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id),
  source_lead_id text unique,
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  market text,
  budget_min numeric,
  budget_max numeric,
  message text,
  tags text[],
  status lead_status not null default 'new',
  priority lead_priority not null default 'med',
  assigned_to uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  normalized_phone text
);

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  address1 text,
  address2 text,
  city text,
  state text,
  postal_code text,
  county text,
  msa text,
  sqft numeric,
  units int,
  lat numeric,
  lng numeric,
  asking_price numeric,
  noi numeric,
  cap_rate numeric,
  price_sqft numeric,
  price_acre numeric,
  days_on_market int,
  opportunity_zone boolean,
  created_at timestamptz not null default now(),
  address_key text -- lower(address1)||lower(city)||upper(state)||postal
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  property_id uuid references properties(id),
  title text not null,
  stage opp_stage not null default 'sourcing',
  value numeric,
  probability int check (probability between 0 and 100),
  expected_close_date date,
  owner_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  entity_type activity_entity not null,
  entity_id uuid not null,
  type activity_type not null,
  body text,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- =========================
-- Indexes / uniqueness
-- =========================
create index if not exists idx_leads_email on leads (lower(email));
create index if not exists idx_leads_normalized_phone on leads (normalized_phone);
create index if not exists idx_leads_company_market on leads (lower(company), market);
create index if not exists idx_leads_assigned_to on leads (assigned_to);
create index if not exists idx_leads_status on leads (status);

create index if not exists idx_properties_addrkey on properties (address_key);
create unique index if not exists uq_properties_addrkey on properties (address_key);

create index if not exists idx_opps_stage on opportunities (stage);
create index if not exists idx_opps_owner on opportunities (owner_id);

-- Keep updated_at current
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at
before update on leads for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_opps_updated_at on opportunities;
create trigger trg_opps_updated_at
before update on opportunities for each row execute procedure public.touch_updated_at();

-- Maintain address_key
create or replace function public.make_address_key()
returns trigger language plpgsql as $$
begin
  new.address_key :=
    case
      when new.address1 is not null and new.city is not null and new.state is not null and new.postal_code is not null
      then lower(coalesce(new.address1,'')) || '|' ||
           lower(coalesce(new.city,''))    || '|' ||
           upper(coalesce(new.state,''))   || '|' ||
           coalesce(new.postal_code,'')
      else null
    end;
  return new;
end $$;

drop trigger if exists trg_properties_addrkey on properties;
create trigger trg_properties_addrkey
before insert or update on properties
for each row execute procedure public.make_address_key();

-- =========================
-- Storage bucket for raw imports
-- =========================
insert into storage.buckets (id, name, public) 
select 'imports','imports', false
where not exists (select 1 from storage.buckets where id = 'imports');

-- =========================
-- Row Level Security
-- =========================
alter table profiles enable row level security;
alter table sources enable row level security;
alter table leads enable row level security;
alter table properties enable row level security;
alter table opportunities enable row level security;
alter table activities enable row level security;

-- Basic profiles RLS (self read/write; admins can read all)
drop policy if exists "profiles select" on profiles;
create policy "profiles select" on profiles
for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles update" on profiles;
create policy "profiles update" on profiles
for update using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles insert" on profiles;
create policy "profiles insert" on profiles
for insert with check (auth.uid() = id or public.is_admin());

-- Sources: read for all authenticated; write admin only
drop policy if exists "sources read all" on sources;
create policy "sources read all" on sources
for select using (auth.role() = 'authenticated');

drop policy if exists "sources write admin" on sources;
create policy "sources write admin" on sources
for all using (public.is_admin())
with check (public.is_admin());

-- Leads:
-- Select: admins or viewers can read all; agents limited to assigned/created_by
drop policy if exists "leads select policy" on leads;
create policy "leads select policy" on leads
for select using (
  public.is_admin() or public.is_viewer()
  or assigned_to = auth.uid()
  or created_by = auth.uid()
);

-- Insert: anyone authenticated; set created_by = auth.uid() via check
drop policy if exists "leads insert policy" on leads;
create policy "leads insert policy" on leads
for insert with check (auth.role() = 'authenticated');

-- Update: admin OR owner/assignee
drop policy if exists "leads update policy" on leads;
create policy "leads update policy" on leads
for update using (
  public.is_admin() or created_by = auth.uid() or assigned_to = auth.uid()
);

-- Properties: read all authenticated; write admin
drop policy if exists "properties select" on properties;
create policy "properties select" on properties
for select using (auth.role() = 'authenticated');

drop policy if exists "properties write admin" on properties;
create policy "properties write admin" on properties
for all using (public.is_admin())
with check (public.is_admin());

-- Opportunities: read like leads (admin/viewer all, else owner or related lead)
drop policy if exists "opps select" on opportunities;
create policy "opps select" on opportunities
for select using (
  public.is_admin() or public.is_viewer()
  or owner_id = auth.uid()
  or exists(select 1 from leads l where l.id = opportunities.lead_id
            and (l.created_by = auth.uid() or l.assigned_to = auth.uid()))
);

drop policy if exists "opps insert" on opportunities;
create policy "opps insert" on opportunities
for insert with check (auth.role() = 'authenticated');

drop policy if exists "opps update" on opportunities;
create policy "opps update" on opportunities
for update using (
  public.is_admin() or owner_id = auth.uid()
  or exists(select 1 from leads l where l.id = opportunities.lead_id
            and (l.created_by = auth.uid() or l.assigned_to = auth.uid()))
);

-- Activities: read all authenticated; insert by authenticated; no updates
drop policy if exists "activities read" on activities;
create policy "activities read" on activities
for select using (auth.role() = 'authenticated');

drop policy if exists "activities insert" on activities;
create policy "activities insert" on activities
for insert with check (auth.role() = 'authenticated');

-- =========================
-- Seeds
-- =========================
insert into sources (name, description)
values
  ('CREXI', 'CREXI leads and inventory export'),
  ('LeasingOffice', 'Internal leasing opportunities export')
on conflict (name) do nothing;

-- =========================
-- Optional: Dashboard function
-- =========================
create or replace function dashboard_counts()
returns table(
  new_leads bigint,
  qualified_leads bigint,
  open_opportunities bigint,
  closed_won_opportunities bigint
)
language plpgsql
as $$
begin
  return query
  select
    (select count(*) from leads where status = 'new')::bigint,
    (select count(*) from leads where status = 'qualified')::bigint,
    (select count(*) from opportunities where stage not in ('closed_won', 'closed_lost'))::bigint,
    (select count(*) from opportunities where stage = 'closed_won')::bigint;
end
$$;