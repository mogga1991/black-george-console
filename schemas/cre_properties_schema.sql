-- =====================================================================
-- Enhanced CRE Properties Table Schema for Supabase
-- =====================================================================
-- This schema creates a comprehensive CRE properties table optimized for 
-- commercial real estate data with Notion sync capabilities
-- Run this in your Supabase SQL editor

-- =====================================================================
-- Enhanced Enums for CRE Properties
-- =====================================================================

-- Property status enum
CREATE TYPE IF NOT EXISTS property_status AS ENUM (
    'available', 
    'under_contract', 
    'leased', 
    'sold', 
    'off_market', 
    'pending',
    'withdrawn'
);

-- Tenancy type enum  
CREATE TYPE IF NOT EXISTS tenancy_type AS ENUM (
    'single', 
    'multiple'
);

-- =====================================================================
-- Main CRE Properties Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS cre_properties (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notion_id TEXT UNIQUE, -- For sync tracking with Notion
    
    -- Address and location fields
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL CHECK (length(state) = 2), -- 2-letter state code
    zip_code VARCHAR(10), -- handles both 5 and 9 digit zip codes
    
    -- Building characteristics  
    building_types TEXT[] NOT NULL, -- Array to handle multi-select values like ["Office", "Industrial"]
    tenancy TEXT CHECK (tenancy IN ('Single', 'Multiple')), -- 'Single' or 'Multiple'
    
    -- Square footage fields (supports ranges and exact values)
    square_footage TEXT, -- Original text like "1,000 - 45,000" or "5,000"
    square_footage_min INTEGER, -- Parsed minimum value
    square_footage_max INTEGER, -- Parsed maximum value
    number_of_suites INTEGER DEFAULT 0,
    
    -- Rate and pricing information
    rate_text TEXT NOT NULL, -- Original rate string like "$15.00 - $25.00 / Sq Ft / YR"
    rate_per_sqft DECIMAL(10, 2), -- Parsed numeric rate when possible
    
    -- Geographic coordinates
    longitude DECIMAL(11, 8), -- Supports precision to ~1cm
    latitude DECIMAL(10, 8),
    
    -- Audit and sync fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Additional CRE fields for enhanced functionality
    property_status property_status DEFAULT 'available',
    listing_date DATE,
    
    -- Property details
    description TEXT,
    year_built INTEGER,
    parking_spaces INTEGER,
    
    -- Contact information
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    
    -- Market information
    county TEXT,
    msa TEXT, -- Metropolitan Statistical Area
    
    -- Zoning and compliance
    zoning TEXT,
    opportunity_zone BOOLEAN DEFAULT FALSE,
    
    -- Source tracking
    source TEXT DEFAULT 'Import',
    source_listing_id TEXT,
    
    -- Computed fields for search and deduplication
    address_key TEXT GENERATED ALWAYS AS (
        LOWER(TRIM(address)) || '|' || 
        LOWER(TRIM(city)) || '|' || 
        UPPER(TRIM(state)) || '|' || 
        TRIM(COALESCE(zip_code, ''))
    ) STORED,
    
    -- Full-text search vector
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', 
            COALESCE(address, '') || ' ' ||
            COALESCE(city, '') || ' ' ||
            COALESCE(state, '') || ' ' ||
            COALESCE(array_to_string(building_types, ' '), '') || ' ' ||
            COALESCE(description, '')
        )
    ) STORED
);

-- =====================================================================
-- Indexes for Performance
-- =====================================================================

-- Address and location indexes
CREATE INDEX IF NOT EXISTS idx_cre_properties_address_key ON cre_properties (address_key);
CREATE INDEX IF NOT EXISTS idx_cre_properties_city_state ON cre_properties (city, state);
CREATE INDEX IF NOT EXISTS idx_cre_properties_location ON cre_properties (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_cre_properties_zip ON cre_properties (zip_code);

-- Building characteristics
CREATE INDEX IF NOT EXISTS idx_cre_properties_building_types ON cre_properties USING GIN (building_types);
CREATE INDEX IF NOT EXISTS idx_cre_properties_tenancy ON cre_properties (tenancy);

-- Size and financial
CREATE INDEX IF NOT EXISTS idx_cre_properties_sq_ft ON cre_properties (square_footage_min, square_footage_max);
CREATE INDEX IF NOT EXISTS idx_cre_properties_rate ON cre_properties (rate_per_sqft);

-- Status and dates
CREATE INDEX IF NOT EXISTS idx_cre_properties_status ON cre_properties (property_status);
CREATE INDEX IF NOT EXISTS idx_cre_properties_listing_date ON cre_properties (listing_date);
CREATE INDEX IF NOT EXISTS idx_cre_properties_created_at ON cre_properties (created_at DESC);

-- Sync tracking
CREATE INDEX IF NOT EXISTS idx_cre_properties_notion_id ON cre_properties (notion_id);
CREATE INDEX IF NOT EXISTS idx_cre_properties_source ON cre_properties (source);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_cre_properties_search ON cre_properties USING GIN (search_vector);

-- =====================================================================
-- Triggers for Automated Processing
-- =====================================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_cre_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_cre_properties_updated_at ON cre_properties;
CREATE TRIGGER trigger_cre_properties_updated_at
    BEFORE UPDATE ON cre_properties
    FOR EACH ROW
    EXECUTE FUNCTION update_cre_properties_updated_at();

-- Function to parse square footage from text
CREATE OR REPLACE FUNCTION parse_square_footage()
RETURNS TRIGGER AS $$
BEGIN
    -- Parse square footage data from text
    IF NEW.square_footage IS NOT NULL AND NEW.square_footage != '' THEN
        -- Handle exact numbers (with commas) like "5,000"
        IF NEW.square_footage ~ '^[0-9,]+$' THEN
            NEW.square_footage_min = REPLACE(NEW.square_footage, ',', '')::INTEGER;
            NEW.square_footage_max = REPLACE(NEW.square_footage, ',', '')::INTEGER;
        -- Handle ranges like "1,000 - 45,000" or "1,000-45,000"
        ELSIF NEW.square_footage ~ '^[0-9,]+\s*-\s*[0-9,]+$' THEN
            NEW.square_footage_min = REPLACE(TRIM(SPLIT_PART(NEW.square_footage, '-', 1)), ',', '')::INTEGER;
            NEW.square_footage_max = REPLACE(TRIM(SPLIT_PART(NEW.square_footage, '-', 2)), ',', '')::INTEGER;
        -- Handle "N/A" or other non-numeric values
        ELSE
            NEW.square_footage_min = NULL;
            NEW.square_footage_max = NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for square footage parsing
DROP TRIGGER IF EXISTS trigger_parse_square_footage ON cre_properties;
CREATE TRIGGER trigger_parse_square_footage
    BEFORE INSERT OR UPDATE ON cre_properties
    FOR EACH ROW
    EXECUTE FUNCTION parse_square_footage();

-- Function to parse rate information
CREATE OR REPLACE FUNCTION parse_rate_data()
RETURNS TRIGGER AS $$
DECLARE
    rate_number TEXT;
    cleaned_rate TEXT;
BEGIN
    -- Parse rate data from text
    IF NEW.rate_text IS NOT NULL AND NEW.rate_text != 'N/A' THEN
        -- Extract numeric value (remove $ and commas, keep decimals)
        cleaned_rate = REGEXP_REPLACE(NEW.rate_text, '[\$,]', '', 'g');
        
        -- Extract just the first numeric part for simple rates like "$18.50 / Sq Ft / YR"
        rate_number = (REGEXP_MATCH(cleaned_rate, '([0-9]+\.?[0-9]*)'))[1];
        
        -- Store parsed rate if we found a valid number
        IF rate_number IS NOT NULL AND rate_number ~ '^[0-9]+\.?[0-9]*$' THEN
            NEW.rate_per_sqft = rate_number::DECIMAL(10,2);
        ELSE
            NEW.rate_per_sqft = NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for rate parsing
DROP TRIGGER IF EXISTS trigger_parse_rate ON cre_properties;
CREATE TRIGGER trigger_parse_rate
    BEFORE INSERT OR UPDATE ON cre_properties
    FOR EACH ROW
    EXECUTE FUNCTION parse_rate_data();

-- =====================================================================
-- Row Level Security (RLS)
-- =====================================================================

-- Enable RLS
ALTER TABLE cre_properties ENABLE ROW LEVEL SECURITY;

-- Policies for reading properties (all authenticated users can read)
DROP POLICY IF EXISTS "cre_properties_select_authenticated" ON cre_properties;
CREATE POLICY "cre_properties_select_authenticated" ON cre_properties
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policies for inserting/updating properties (admin only or via API)
DROP POLICY IF EXISTS "cre_properties_admin_all" ON cre_properties;
CREATE POLICY "cre_properties_admin_all" ON cre_properties
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Policy for API inserts/updates (allow service role)
DROP POLICY IF EXISTS "cre_properties_service_role" ON cre_properties;
CREATE POLICY "cre_properties_service_role" ON cre_properties
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================================
-- Helper Functions for Data Import
-- =====================================================================

-- Function to import property from CSV/API data
CREATE OR REPLACE FUNCTION import_cre_property(
    p_address TEXT,
    p_building_types TEXT,
    p_city TEXT,
    p_state TEXT,
    p_zip TEXT,
    p_tenancy TEXT,
    p_sq_ft TEXT,
    p_suites INTEGER,
    p_rate TEXT,
    p_longitude DECIMAL DEFAULT NULL,
    p_latitude DECIMAL DEFAULT NULL,
    p_notion_id TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'Import'
)
RETURNS UUID AS $$
DECLARE
    new_property_id UUID;
    building_types_array TEXT[];
BEGIN
    -- Parse building types from comma-separated string
    building_types_array = ARRAY(
        SELECT TRIM(unnest(string_to_array(p_building_types, ',')))
    );
    
    -- Insert or update the property
    INSERT INTO cre_properties (
        notion_id,
        address,
        city,
        state,
        zip_code,
        building_types,
        tenancy,
        square_footage,
        number_of_suites,
        rate_text,
        longitude,
        latitude,
        source
    ) VALUES (
        p_notion_id,
        p_address,
        p_city,
        UPPER(p_state),
        p_zip,
        building_types_array,
        p_tenancy,
        p_sq_ft,
        COALESCE(p_suites, 0),
        p_rate,
        p_longitude,
        p_latitude,
        p_source
    )
    ON CONFLICT (notion_id) DO UPDATE SET
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        zip_code = EXCLUDED.zip_code,
        building_types = EXCLUDED.building_types,
        tenancy = EXCLUDED.tenancy,
        square_footage = EXCLUDED.square_footage,
        number_of_suites = EXCLUDED.number_of_suites,
        rate_text = EXCLUDED.rate_text,
        longitude = EXCLUDED.longitude,
        latitude = EXCLUDED.latitude,
        updated_at = NOW()
    RETURNING id INTO new_property_id;
    
    RETURN new_property_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- Views for Common Queries
-- =====================================================================

-- View for available properties with parsed data
CREATE OR REPLACE VIEW available_cre_properties AS
SELECT 
    id,
    notion_id,
    address,
    city,
    state,
    zip_code,
    building_types,
    tenancy,
    square_footage,
    COALESCE(square_footage_min, square_footage_max) as sq_ft_from,
    COALESCE(square_footage_max, square_footage_min) as sq_ft_to,
    number_of_suites,
    rate_text,
    rate_per_sqft,
    latitude,
    longitude,
    property_status,
    listing_date,
    description,
    contact_name,
    contact_email,
    contact_phone,
    source,
    created_at,
    updated_at
FROM cre_properties
WHERE property_status = 'available';

-- View for property search with full-text capabilities
CREATE OR REPLACE VIEW cre_properties_search AS
SELECT 
    p.*,
    ts_rank(search_vector, plainto_tsquery('english', '')) as search_rank
FROM cre_properties p;

-- =====================================================================
-- Data Quality Functions
-- =====================================================================

-- Function to find potential duplicate properties
CREATE OR REPLACE FUNCTION find_duplicate_properties()
RETURNS TABLE(
    id1 UUID,
    id2 UUID,
    address1 TEXT,
    address2 TEXT,
    similarity_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p1.id as id1,
        p2.id as id2,
        p1.address as address1,
        p2.address as address2,
        similarity(p1.address_key, p2.address_key) as similarity_score
    FROM cre_properties p1
    CROSS JOIN cre_properties p2
    WHERE p1.id < p2.id
    AND similarity(p1.address_key, p2.address_key) > 0.8
    ORDER BY similarity_score DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- Comments and Documentation
-- =====================================================================

COMMENT ON TABLE cre_properties IS 'Enhanced CRE properties table optimized for commercial real estate data with Notion sync capabilities';
COMMENT ON COLUMN cre_properties.notion_id IS 'Unique identifier from Notion for sync tracking';
COMMENT ON COLUMN cre_properties.building_types IS 'Array of building types to handle multi-select values';
COMMENT ON COLUMN cre_properties.square_footage IS 'Original square footage text with ranges and formatting';
COMMENT ON COLUMN cre_properties.rate_text IS 'Original rate text with various formats and units';
COMMENT ON COLUMN cre_properties.address_key IS 'Generated key for deduplication based on address components';
COMMENT ON COLUMN cre_properties.search_vector IS 'Full-text search vector for property search';

-- Grant necessary permissions
GRANT SELECT ON cre_properties TO authenticated;
GRANT SELECT ON available_cre_properties TO authenticated;
GRANT SELECT ON cre_properties_search TO authenticated;