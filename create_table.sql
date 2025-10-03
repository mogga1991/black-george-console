
-- Create CRE Properties Table
CREATE TABLE IF NOT EXISTS cre_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notion_id TEXT UNIQUE,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code VARCHAR(10),
    building_types TEXT[] NOT NULL,
    tenancy TEXT,
    square_footage TEXT,
    square_footage_min INTEGER,
    square_footage_max INTEGER,
    number_of_suites INTEGER DEFAULT 0,
    rate_text TEXT NOT NULL,
    rate_per_sqft DECIMAL(10, 2),
    longitude DECIMAL(11, 8),
    latitude DECIMAL(10, 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create essential indexes
CREATE INDEX IF NOT EXISTS idx_cre_properties_city_state ON cre_properties (city, state);
CREATE INDEX IF NOT EXISTS idx_cre_properties_building_types ON cre_properties USING GIN (building_types);
CREATE INDEX IF NOT EXISTS idx_cre_properties_location ON cre_properties (latitude, longitude);

-- Enable Row Level Security
ALTER TABLE cre_properties ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "cre_properties_select" ON cre_properties FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to do everything (for imports)
CREATE POLICY "cre_properties_service" ON cre_properties FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
