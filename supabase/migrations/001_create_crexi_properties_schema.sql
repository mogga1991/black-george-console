-- =====================================================================
-- CREXi Properties Table Schema for Supabase
-- =====================================================================
-- This schema creates a comprehensive properties table based on CREXi data structure
-- Run this in your Supabase SQL editor

-- =====================================================================
-- Additional Enums for Properties
-- =====================================================================

-- Property status enum
CREATE TYPE property_status AS ENUM (
    'available', 
    'under_contract', 
    'leased', 
    'sold', 
    'off_market', 
    'pending',
    'withdrawn'
);

-- Tenancy type enum
CREATE TYPE tenancy_type AS ENUM (
    'single', 
    'multiple'
);

-- Building type enum (though we'll also store as text array for flexibility)
CREATE TYPE building_type AS ENUM (
    'office',
    'industrial', 
    'retail',
    'warehouse',
    'flex',
    'medical',
    'restaurant',
    'land',
    'multifamily',
    'hotel',
    'mixed_use',
    'other'
);

-- =====================================================================
-- Drop existing properties table if needed (CAREFUL - this removes data!)
-- =====================================================================
-- Uncomment the next line if you want to completely replace the existing table
-- DROP TABLE IF EXISTS properties CASCADE;

-- =====================================================================
-- New CREXi Properties Table
-- =====================================================================
CREATE TABLE crexi_properties (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id TEXT UNIQUE NOT NULL, -- CREXi or internal unique identifier
    
    -- Address and location fields
    address TEXT NOT NULL,
    address_line_2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL CHECK (length(state) = 2), -- 2-letter state code
    zip_code VARCHAR(10), -- handles both 5 and 9 digit zip codes
    county TEXT,
    latitude DECIMAL(10, 8), -- Supports precision to ~1cm
    longitude DECIMAL(11, 8),
    
    -- Building characteristics
    building_types TEXT[] NOT NULL, -- Array to handle comma-separated values like "Office, Industrial"
    primary_building_type building_type, -- Normalized primary type
    tenancy tenancy_type, -- Single or Multiple
    
    -- Size and space information
    total_sq_ft_min INTEGER, -- For ranges like "1,000 - 45,000"
    total_sq_ft_max INTEGER,
    total_sq_ft_exact INTEGER, -- For exact values
    total_sq_ft_raw TEXT, -- Store original text for complex formats
    
    suites INTEGER DEFAULT 0,
    
    -- Rate and pricing information
    rate_min DECIMAL(10, 2), -- For rate ranges
    rate_max DECIMAL(10, 2),
    rate_exact DECIMAL(10, 2), -- For exact rates
    rate_unit TEXT, -- "Sq Ft / YR", "Sq Ft / MO", etc.
    rate_raw TEXT NOT NULL, -- Store original rate text for complex formats
    
    -- Additional CRE management fields
    status property_status DEFAULT 'available',
    listing_date DATE,
    created_date DATE DEFAULT CURRENT_DATE,
    last_updated DATE DEFAULT CURRENT_DATE,
    
    -- Property details
    description TEXT,
    year_built INTEGER,
    parking_spaces INTEGER,
    parking_ratio DECIMAL(4, 2), -- spaces per 1000 sq ft
    
    -- Financial information
    asking_price DECIMAL(15, 2),
    price_per_sq_ft DECIMAL(10, 2),
    noi DECIMAL(15, 2), -- Net Operating Income
    cap_rate DECIMAL(5, 3), -- Cap rate as percentage (e.g., 6.500 for 6.5%)
    
    -- Market information
    msa TEXT, -- Metropolitan Statistical Area
    submarket TEXT,
    market_class TEXT, -- Class A, B, C
    
    -- Listing and source information
    source TEXT DEFAULT 'CREXi',
    source_listing_id TEXT,
    listing_agent_name TEXT,
    listing_agent_email TEXT,
    listing_agent_phone TEXT,
    listing_company TEXT,
    
    -- Contact information
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    
    -- Property features (stored as JSON for flexibility)
    amenities JSONB,
    building_features JSONB,
    
    -- Zoning and legal
    zoning TEXT,
    opportunity_zone BOOLEAN DEFAULT FALSE,
    
    -- Images and documents
    image_urls TEXT[],
    document_urls TEXT[],
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Computed fields for search and deduplication (populated by triggers)
    address_key TEXT,
    search_vector tsvector
);

-- =====================================================================
-- Indexes for Performance
-- =====================================================================

-- Address and location indexes
CREATE INDEX idx_crexi_properties_address_key ON crexi_properties (address_key);
CREATE INDEX idx_crexi_properties_city_state ON crexi_properties (city, state);
CREATE INDEX idx_crexi_properties_state ON crexi_properties (state);
CREATE INDEX idx_crexi_properties_zip ON crexi_properties (zip_code);
CREATE INDEX idx_crexi_properties_location ON crexi_properties (latitude, longitude);

-- Building type and characteristics
CREATE INDEX idx_crexi_properties_building_types ON crexi_properties USING GIN (building_types);
CREATE INDEX idx_crexi_properties_primary_type ON crexi_properties (primary_building_type);
CREATE INDEX idx_crexi_properties_tenancy ON crexi_properties (tenancy);

-- Size and financial
CREATE INDEX idx_crexi_properties_sq_ft ON crexi_properties (total_sq_ft_exact, total_sq_ft_min, total_sq_ft_max);
CREATE INDEX idx_crexi_properties_rate ON crexi_properties (rate_exact, rate_min, rate_max);
CREATE INDEX idx_crexi_properties_price ON crexi_properties (asking_price);

-- Status and dates
CREATE INDEX idx_crexi_properties_status ON crexi_properties (status);
CREATE INDEX idx_crexi_properties_listing_date ON crexi_properties (listing_date);
CREATE INDEX idx_crexi_properties_created_at ON crexi_properties (created_at);

-- Source and listing
CREATE INDEX idx_crexi_properties_source ON crexi_properties (source);
CREATE INDEX idx_crexi_properties_property_id ON crexi_properties (property_id);

-- Full-text search
CREATE INDEX idx_crexi_properties_search ON crexi_properties USING GIN (search_vector);

-- =====================================================================
-- Triggers for Automated Updates
-- =====================================================================

-- Function to update computed fields (address_key and search_vector)
CREATE OR REPLACE FUNCTION update_computed_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Update address_key
    NEW.address_key = LOWER(TRIM(NEW.address)) || '|' || 
                      LOWER(TRIM(NEW.city)) || '|' || 
                      UPPER(TRIM(NEW.state)) || '|' || 
                      TRIM(COALESCE(NEW.zip_code, ''));
    
    -- Update search_vector
    NEW.search_vector = to_tsvector('english', 
        COALESCE(NEW.address, '') || ' ' ||
        COALESCE(NEW.city, '') || ' ' ||
        COALESCE(NEW.state, '') || ' ' ||
        COALESCE(array_to_string(NEW.building_types, ' '), '') || ' ' ||
        COALESCE(NEW.description, '')
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_crexi_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_updated = CURRENT_DATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_crexi_properties_updated_at ON crexi_properties;
CREATE TRIGGER trigger_crexi_properties_updated_at
    BEFORE UPDATE ON crexi_properties
    FOR EACH ROW
    EXECUTE FUNCTION update_crexi_properties_updated_at();

-- Function to parse and set sq_ft fields from raw data
CREATE OR REPLACE FUNCTION parse_sq_ft_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Parse square footage data from raw text
    IF NEW.total_sq_ft_raw IS NOT NULL THEN
        -- Handle exact numbers (with commas)
        IF NEW.total_sq_ft_raw ~ '^[0-9,]+$' THEN
            NEW.total_sq_ft_exact = REPLACE(NEW.total_sq_ft_raw, ',', '')::INTEGER;
        -- Handle ranges like "1,000 - 45,000"
        ELSIF NEW.total_sq_ft_raw ~ '^[0-9,]+\s*-\s*[0-9,]+$' THEN
            NEW.total_sq_ft_min = REPLACE(SPLIT_PART(NEW.total_sq_ft_raw, '-', 1), ',', '')::INTEGER;
            NEW.total_sq_ft_max = REPLACE(SPLIT_PART(NEW.total_sq_ft_raw, '-', 2), ',', '')::INTEGER;
        -- Handle "N/A" or other non-numeric values
        ELSE
            NEW.total_sq_ft_exact = NULL;
            NEW.total_sq_ft_min = NULL;
            NEW.total_sq_ft_max = NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for sq_ft parsing
DROP TRIGGER IF EXISTS trigger_parse_sq_ft ON crexi_properties;
CREATE TRIGGER trigger_parse_sq_ft
    BEFORE INSERT OR UPDATE ON crexi_properties
    FOR EACH ROW
    EXECUTE FUNCTION parse_sq_ft_data();

-- Function to parse rate data
CREATE OR REPLACE FUNCTION parse_rate_data()
RETURNS TRIGGER AS $$
DECLARE
    rate_number TEXT;
    rate_parts TEXT[];
BEGIN
    -- Parse rate data from raw text
    IF NEW.rate_raw IS NOT NULL AND NEW.rate_raw != 'N/A' THEN
        -- Extract just the numeric part and unit
        rate_parts = REGEXP_SPLIT_TO_ARRAY(NEW.rate_raw, '\s*/\s*');
        
        -- Extract numeric value (remove $ and commas)
        rate_number = REGEXP_REPLACE(rate_parts[1], '[\$,]', '', 'g');
        
        -- Handle ranges like "$15.00 - $25.00 / Sq Ft / YR"
        IF rate_number ~ '^[0-9.]+\s*-\s*[0-9.]+' THEN
            NEW.rate_min = SPLIT_PART(rate_number, '-', 1)::DECIMAL(10,2);
            NEW.rate_max = SPLIT_PART(rate_number, '-', 2)::DECIMAL(10,2);
        -- Handle exact rates
        ELSIF rate_number ~ '^[0-9.]+$' THEN
            NEW.rate_exact = rate_number::DECIMAL(10,2);
        END IF;
        
        -- Extract unit (everything after the first slash)
        IF array_length(rate_parts, 1) > 1 THEN
            NEW.rate_unit = array_to_string(rate_parts[2:], ' / ');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for rate parsing
DROP TRIGGER IF EXISTS trigger_parse_rate ON crexi_properties;
CREATE TRIGGER trigger_parse_rate
    BEFORE INSERT OR UPDATE ON crexi_properties
    FOR EACH ROW
    EXECUTE FUNCTION parse_rate_data();

-- Function to set primary building type from building_types array
CREATE OR REPLACE FUNCTION set_primary_building_type()
RETURNS TRIGGER AS $$
BEGIN
    -- Set primary building type from the first item in building_types array
    IF NEW.building_types IS NOT NULL AND array_length(NEW.building_types, 1) > 0 THEN
        -- Try to match the first building type to our enum
        CASE LOWER(TRIM(NEW.building_types[1]))
            WHEN 'office' THEN NEW.primary_building_type = 'office';
            WHEN 'industrial' THEN NEW.primary_building_type = 'industrial';
            WHEN 'retail' THEN NEW.primary_building_type = 'retail';
            WHEN 'warehouse' THEN NEW.primary_building_type = 'warehouse';
            WHEN 'flex' THEN NEW.primary_building_type = 'flex';
            WHEN 'medical' THEN NEW.primary_building_type = 'medical';
            WHEN 'restaurant' THEN NEW.primary_building_type = 'restaurant';
            WHEN 'land' THEN NEW.primary_building_type = 'land';
            WHEN 'multifamily' THEN NEW.primary_building_type = 'multifamily';
            WHEN 'hotel' THEN NEW.primary_building_type = 'hotel';
            WHEN 'mixed use', 'mixed_use' THEN NEW.primary_building_type = 'mixed_use';
            ELSE NEW.primary_building_type = 'other';
        END CASE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for primary building type
DROP TRIGGER IF EXISTS trigger_set_primary_building_type ON crexi_properties;
CREATE TRIGGER trigger_set_primary_building_type
    BEFORE INSERT OR UPDATE ON crexi_properties
    FOR EACH ROW
    EXECUTE FUNCTION set_primary_building_type();

-- Trigger for computed fields
DROP TRIGGER IF EXISTS trigger_update_computed_fields ON crexi_properties;
CREATE TRIGGER trigger_update_computed_fields
    BEFORE INSERT OR UPDATE ON crexi_properties
    FOR EACH ROW
    EXECUTE FUNCTION update_computed_fields();

-- =====================================================================
-- Create profiles table for RLS
-- =====================================================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profile policies
CREATE POLICY "users_can_view_own_profile" ON profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "users_can_update_own_profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- =====================================================================
-- Row Level Security (RLS) for Properties
-- =====================================================================

-- Enable RLS
ALTER TABLE crexi_properties ENABLE ROW LEVEL SECURITY;

-- Policies for reading properties (authenticated users can read all)
DROP POLICY IF EXISTS "properties_select_authenticated" ON crexi_properties;
CREATE POLICY "properties_select_authenticated" ON crexi_properties
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policies for inserting/updating properties (any authenticated user for now)
DROP POLICY IF EXISTS "properties_modify_authenticated" ON crexi_properties;
CREATE POLICY "properties_modify_authenticated" ON crexi_properties
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- =====================================================================
-- Helper Functions for CREXi Data Import
-- =====================================================================

-- Function to convert CREXi CSV row to property record
CREATE OR REPLACE FUNCTION import_crexi_property(
    p_address TEXT,
    p_building_type TEXT,
    p_city TEXT,
    p_state TEXT,
    p_zip TEXT,
    p_tenancy TEXT,
    p_sq_ft TEXT,
    p_suites INTEGER,
    p_rate TEXT,
    p_longitude DECIMAL,
    p_latitude DECIMAL,
    p_property_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_property_id UUID;
    building_types_array TEXT[];
    clean_tenancy tenancy_type;
BEGIN
    -- Parse building types from comma-separated string
    building_types_array = ARRAY(
        SELECT TRIM(unnest(string_to_array(p_building_type, ',')))
    );
    
    -- Clean and convert tenancy
    clean_tenancy = CASE LOWER(TRIM(p_tenancy))
        WHEN 'single' THEN 'single'::tenancy_type
        WHEN 'multiple' THEN 'multiple'::tenancy_type
        ELSE 'single'::tenancy_type
    END;
    
    -- Insert the property
    INSERT INTO crexi_properties (
        property_id,
        address,
        city,
        state,
        zip_code,
        building_types,
        tenancy,
        total_sq_ft_raw,
        suites,
        rate_raw,
        longitude,
        latitude,
        source,
        created_by
    ) VALUES (
        COALESCE(p_property_id, gen_random_uuid()::TEXT),
        p_address,
        p_city,
        UPPER(p_state),
        p_zip,
        building_types_array,
        clean_tenancy,
        p_sq_ft,
        COALESCE(p_suites, 0),
        p_rate,
        p_longitude,
        p_latitude,
        'CREXi',
        auth.uid()
    )
    ON CONFLICT (property_id) DO UPDATE SET
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        zip_code = EXCLUDED.zip_code,
        building_types = EXCLUDED.building_types,
        tenancy = EXCLUDED.tenancy,
        total_sq_ft_raw = EXCLUDED.total_sq_ft_raw,
        suites = EXCLUDED.suites,
        rate_raw = EXCLUDED.rate_raw,
        longitude = EXCLUDED.longitude,
        latitude = EXCLUDED.latitude,
        updated_by = auth.uid()
    RETURNING id INTO new_property_id;
    
    RETURN new_property_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- Views for Common Queries
-- =====================================================================

-- View for available properties with parsed data
CREATE OR REPLACE VIEW available_properties AS
SELECT 
    id,
    property_id,
    address,
    city,
    state,
    zip_code,
    building_types,
    primary_building_type,
    tenancy,
    COALESCE(total_sq_ft_exact, total_sq_ft_min) as sq_ft_from,
    COALESCE(total_sq_ft_exact, total_sq_ft_max) as sq_ft_to,
    COALESCE(rate_exact, rate_min) as rate_from,
    COALESCE(rate_exact, rate_max) as rate_to,
    rate_unit,
    suites,
    latitude,
    longitude,
    status,
    listing_date,
    description,
    source,
    contact_name,
    contact_email,
    contact_phone,
    created_at,
    updated_at
FROM crexi_properties
WHERE status = 'available';

-- View for property search with full-text capabilities
CREATE OR REPLACE VIEW properties_search AS
SELECT 
    p.*,
    ts_rank(search_vector, plainto_tsquery('english', '')) as search_rank
FROM crexi_properties p;

-- =====================================================================
-- Comments and Documentation
-- =====================================================================

COMMENT ON TABLE crexi_properties IS 'Comprehensive properties table for CREXi and other CRE data sources';
COMMENT ON COLUMN crexi_properties.property_id IS 'Unique identifier for the property (from CREXi or internal)';
COMMENT ON COLUMN crexi_properties.building_types IS 'Array of building types to handle comma-separated values';
COMMENT ON COLUMN crexi_properties.total_sq_ft_raw IS 'Original square footage text with ranges and formatting';
COMMENT ON COLUMN crexi_properties.rate_raw IS 'Original rate text with various formats and units';
COMMENT ON COLUMN crexi_properties.address_key IS 'Generated key for deduplication based on address components';
COMMENT ON COLUMN crexi_properties.search_vector IS 'Full-text search vector for property search';