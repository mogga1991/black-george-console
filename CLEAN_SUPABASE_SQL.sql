-- Clean SQL for Supabase (PostgreSQL)
-- Copy and paste this ENTIRE block into Supabase SQL Editor

-- Drop table if it exists (to start fresh)
DROP TABLE IF EXISTS cre_properties CASCADE;

-- Create CRE Properties Table
CREATE TABLE cre_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notion_id TEXT UNIQUE,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code VARCHAR(10),
    building_types TEXT[] NOT NULL DEFAULT '{}',
    tenancy TEXT,
    square_footage TEXT,
    square_footage_min INTEGER,
    square_footage_max INTEGER,
    number_of_suites INTEGER DEFAULT 0,
    rate_text TEXT NOT NULL DEFAULT '',
    rate_per_sqft DECIMAL(10, 2),
    longitude DECIMAL(11, 8),
    latitude DECIMAL(10, 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create essential indexes
CREATE INDEX idx_cre_properties_city_state ON cre_properties (city, state);
CREATE INDEX idx_cre_properties_building_types ON cre_properties USING GIN (building_types);
CREATE INDEX idx_cre_properties_location ON cre_properties (latitude, longitude);

-- Enable Row Level Security
ALTER TABLE cre_properties ENABLE ROW LEVEL SECURITY;

-- Create policies (fresh, no conflicts)
CREATE POLICY "cre_properties_select_policy" ON cre_properties 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "cre_properties_insert_policy" ON cre_properties 
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "cre_properties_update_policy" ON cre_properties 
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "cre_properties_delete_policy" ON cre_properties 
    FOR DELETE TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON cre_properties TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;