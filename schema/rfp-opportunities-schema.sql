-- =========================
-- RFP Opportunities Schema
-- Government commercial real estate opportunities
-- =========================

-- =========================
-- Enums for RFP opportunities
-- =========================
create type rfp_status as enum ('open','closed','awarded','cancelled','draft');
create type rfp_type as enum ('rfp','rfq','ifb','sources_sought','presolicitation');
create type procurement_method as enum ('sealed_bidding','competitive_proposal','simplified_acquisition','sole_source');
create type set_aside_type as enum ('none','small_business','8a','hubzone','wosb','vosb','sdvosb');

-- =========================
-- Main RFP Opportunities Table
-- =========================
create table if not exists rfp_opportunities (
  id uuid primary key default gen_random_uuid(),
  
  -- Basic Information
  solicitation_number text not null unique,
  title text not null,
  description text,
  synopsis text,
  
  -- Government Agency Details
  issuing_agency text not null,
  agency_code text,
  sub_agency text,
  office_address text,
  
  -- Opportunity Details
  rfp_type rfp_type not null default 'rfp',
  status rfp_status not null default 'open',
  procurement_method procurement_method,
  set_aside_type set_aside_type not null default 'none',
  
  -- Commercial Real Estate Specific
  naics_codes text[], -- NAICS codes (e.g., 236220 for commercial construction)
  property_type text, -- office, retail, warehouse, etc.
  space_requirements jsonb, -- square footage, floors, special needs
  location_requirements jsonb, -- state, city, zip codes, proximity requirements
  
  -- Financial Information
  estimated_value_min numeric,
  estimated_value_max numeric,
  budget_range jsonb, -- detailed budget breakdown
  
  -- Timeline
  posted_date timestamptz,
  response_due_date timestamptz,
  questions_due_date timestamptz,
  proposal_due_date timestamptz,
  estimated_award_date timestamptz,
  performance_start_date timestamptz,
  performance_end_date timestamptz,
  
  -- Location Data
  place_of_performance_state text,
  place_of_performance_city text,
  place_of_performance_zip text,
  place_of_performance_country text default 'USA',
  coordinates_lat numeric,
  coordinates_lng numeric,
  
  -- Contact Information
  contact_info jsonb, -- primary contact, contracting officer, etc.
  
  -- Documents and Links
  sam_gov_url text,
  documents jsonb, -- array of document links and descriptions
  
  -- Compliance and Requirements
  compliance_requirements jsonb, -- accessibility, environmental, security, etc.
  special_requirements text[],
  
  -- AI Analysis Fields
  ai_summary text, -- AI-generated concise summary
  commercial_real_estate_score numeric, -- relevance score (0-100)
  key_highlights text[], -- important points extracted by AI
  risk_factors text[], -- potential challenges or deal breakers
  
  -- Data Source and Processing
  source text not null default 'sam.gov', -- sam.gov, grants.gov, etc.
  source_id text, -- original ID from source system
  last_updated_at_source timestamptz,
  extraction_confidence numeric, -- AI confidence in data extraction (0-1)
  
  -- System Fields
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  is_active boolean default true,
  
  -- Search and Matching
  search_vector tsvector,
  tags text[]
);

-- =========================
-- RFP Documents Table
-- =========================
create table if not exists rfp_documents (
  id uuid primary key default gen_random_uuid(),
  rfp_opportunity_id uuid references rfp_opportunities(id) on delete cascade,
  
  document_name text not null,
  document_type text, -- solicitation, amendment, q_and_a, etc.
  file_url text,
  file_size_bytes bigint,
  mime_type text,
  
  -- AI Processing
  extracted_text text,
  ai_analysis jsonb, -- structured analysis of document content
  processing_status text default 'pending', -- pending, processed, error
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- RFP Matching Results Table
-- =========================
create table if not exists rfp_property_matches (
  id uuid primary key default gen_random_uuid(),
  rfp_opportunity_id uuid references rfp_opportunities(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  
  -- Matching Scores
  overall_match_score numeric not null, -- 0-100
  location_score numeric,
  space_score numeric,
  financial_score numeric,
  compliance_score numeric,
  timeline_score numeric,
  
  -- Match Analysis
  advantages text[],
  disadvantages text[],
  deal_breakers text[],
  compliance_issues text[],
  
  -- AI Analysis
  ai_recommendation text,
  confidence_level numeric, -- 0-1
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  unique(rfp_opportunity_id, property_id)
);

-- =========================
-- Notification Preferences
-- =========================
create table if not exists rfp_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  
  -- Geographic Filters
  states text[],
  cities text[],
  zip_codes text[],
  
  -- Opportunity Filters
  rfp_types rfp_type[],
  min_value numeric,
  max_value numeric,
  property_types text[],
  naics_codes text[],
  
  -- Notification Settings
  email_notifications boolean default true,
  instant_notifications boolean default false,
  daily_digest boolean default true,
  weekly_summary boolean default true,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  unique(user_id)
);

-- =========================
-- Indexes for Performance
-- =========================
create index if not exists idx_rfp_opportunities_status on rfp_opportunities (status);
create index if not exists idx_rfp_opportunities_type on rfp_opportunities (rfp_type);
create index if not exists idx_rfp_opportunities_agency on rfp_opportunities (issuing_agency);
create index if not exists idx_rfp_opportunities_posted_date on rfp_opportunities (posted_date desc);
create index if not exists idx_rfp_opportunities_due_date on rfp_opportunities (response_due_date);
create index if not exists idx_rfp_opportunities_naics on rfp_opportunities using gin (naics_codes);
create index if not exists idx_rfp_opportunities_location on rfp_opportunities (place_of_performance_state, place_of_performance_city);
create index if not exists idx_rfp_opportunities_coordinates on rfp_opportunities (coordinates_lat, coordinates_lng);
create index if not exists idx_rfp_opportunities_search on rfp_opportunities using gin (search_vector);
create index if not exists idx_rfp_opportunities_cre_score on rfp_opportunities (commercial_real_estate_score desc);
create index if not exists idx_rfp_opportunities_source on rfp_opportunities (source, source_id);

create index if not exists idx_rfp_documents_rfp_id on rfp_documents (rfp_opportunity_id);
create index if not exists idx_rfp_documents_type on rfp_documents (document_type);
create index if not exists idx_rfp_documents_status on rfp_documents (processing_status);

create index if not exists idx_rfp_matches_rfp_id on rfp_property_matches (rfp_opportunity_id);
create index if not exists idx_rfp_matches_property_id on rfp_property_matches (property_id);
create index if not exists idx_rfp_matches_score on rfp_property_matches (overall_match_score desc);

-- =========================
-- Triggers
-- =========================
create or replace function public.touch_rfp_updated_at()
returns trigger language plpgsql as $
begin
  new.updated_at = now();
  return new;
end $;

drop trigger if exists trg_rfp_opportunities_updated_at on rfp_opportunities;
create trigger trg_rfp_opportunities_updated_at
before update on rfp_opportunities
for each row execute procedure public.touch_rfp_updated_at();

drop trigger if exists trg_rfp_documents_updated_at on rfp_documents;
create trigger trg_rfp_documents_updated_at
before update on rfp_documents
for each row execute procedure public.touch_rfp_updated_at();

drop trigger if exists trg_rfp_matches_updated_at on rfp_property_matches;
create trigger trg_rfp_matches_updated_at
before update on rfp_property_matches
for each row execute procedure public.touch_rfp_updated_at();

-- =========================
-- Search Vector Maintenance
-- =========================
create or replace function public.update_rfp_search_vector()
returns trigger language plpgsql as $
begin
  new.search_vector := 
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.synopsis, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.issuing_agency, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.special_requirements, ' '), '')), 'D');
  return new;
end $;

drop trigger if exists trg_rfp_search_vector on rfp_opportunities;
create trigger trg_rfp_search_vector
before insert or update on rfp_opportunities
for each row execute procedure public.update_rfp_search_vector();

-- =========================
-- Row Level Security
-- =========================
alter table rfp_opportunities enable row level security;
alter table rfp_documents enable row level security;
alter table rfp_property_matches enable row level security;
alter table rfp_notification_preferences enable row level security;

-- RFP Opportunities: read for all authenticated users
drop policy if exists "rfp_opportunities_select" on rfp_opportunities;
create policy "rfp_opportunities_select" on rfp_opportunities
for select using (auth.role() = 'authenticated');

-- Insert/Update: admin only for now (automated processes will need service role)
drop policy if exists "rfp_opportunities_write" on rfp_opportunities;
create policy "rfp_opportunities_write" on rfp_opportunities
for all using (public.is_admin())
with check (public.is_admin());

-- Documents: same as opportunities
drop policy if exists "rfp_documents_select" on rfp_documents;
create policy "rfp_documents_select" on rfp_documents
for select using (auth.role() = 'authenticated');

drop policy if exists "rfp_documents_write" on rfp_documents;
create policy "rfp_documents_write" on rfp_documents
for all using (public.is_admin())
with check (public.is_admin());

-- Matches: read for all authenticated, write for admin
drop policy if exists "rfp_matches_select" on rfp_property_matches;
create policy "rfp_matches_select" on rfp_property_matches
for select using (auth.role() = 'authenticated');

drop policy if exists "rfp_matches_write" on rfp_property_matches;
create policy "rfp_matches_write" on rfp_property_matches
for all using (public.is_admin())
with check (public.is_admin());

-- Notification preferences: users can manage their own
drop policy if exists "rfp_notifications_policy" on rfp_notification_preferences;
create policy "rfp_notifications_policy" on rfp_notification_preferences
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =========================
-- Helper Functions
-- =========================

-- Function to get active RFP opportunities with optional filters
create or replace function get_active_rfp_opportunities(
  p_state text default null,
  p_property_type text default null,
  p_min_score numeric default 0,
  p_limit int default 50
)
returns table(
  id uuid,
  solicitation_number text,
  title text,
  issuing_agency text,
  status rfp_status,
  response_due_date timestamptz,
  estimated_value_min numeric,
  estimated_value_max numeric,
  ai_summary text,
  commercial_real_estate_score numeric,
  coordinates_lat numeric,
  coordinates_lng numeric
)
language plpgsql
as $$
begin
  return query
  select 
    ro.id,
    ro.solicitation_number,
    ro.title,
    ro.issuing_agency,
    ro.status,
    ro.response_due_date,
    ro.estimated_value_min,
    ro.estimated_value_max,
    ro.ai_summary,
    ro.commercial_real_estate_score,
    ro.coordinates_lat,
    ro.coordinates_lng
  from rfp_opportunities ro
  where ro.is_active = true
    and ro.status = 'open'
    and ro.commercial_real_estate_score >= p_min_score
    and (p_state is null or ro.place_of_performance_state = p_state)
    and (p_property_type is null or ro.property_type = p_property_type)
    and (ro.response_due_date is null or ro.response_due_date > now())
  order by ro.commercial_real_estate_score desc, ro.posted_date desc
  limit p_limit;
end
$$;

-- Function to search RFP opportunities with full-text search
create or replace function search_rfp_opportunities(
  p_search_query text,
  p_limit int default 20
)
returns table(
  id uuid,
  solicitation_number text,
  title text,
  issuing_agency text,
  ai_summary text,
  rank real
)
language plpgsql
as $$
begin
  return query
  select 
    ro.id,
    ro.solicitation_number,
    ro.title,
    ro.issuing_agency,
    ro.ai_summary,
    ts_rank(ro.search_vector, plainto_tsquery('english', p_search_query)) as rank
  from rfp_opportunities ro
  where ro.search_vector @@ plainto_tsquery('english', p_search_query)
    and ro.is_active = true
    and ro.status = 'open'
  order by rank desc, ro.commercial_real_estate_score desc
  limit p_limit;
end
$$;