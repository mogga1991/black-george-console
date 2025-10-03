-- RFP Opportunities table for Supabase
-- This table stores opportunities from both government sources and Excel uploads

CREATE TABLE IF NOT EXISTS rfp_opportunities (
  id TEXT PRIMARY KEY,
  solicitation_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  synopsis TEXT,
  
  -- Agency Information
  issuing_agency TEXT NOT NULL,
  agency_code TEXT,
  sub_agency TEXT,
  office_address TEXT,
  
  -- Opportunity Details
  rfp_type TEXT NOT NULL DEFAULT 'rfp' CHECK (rfp_type IN ('rfp', 'rfq', 'ifb', 'sources_sought', 'presolicitation')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'awarded', 'cancelled', 'draft')),
  procurement_method TEXT CHECK (procurement_method IN ('sealed_bidding', 'competitive_proposal', 'simplified_acquisition', 'sole_source')),
  set_aside_type TEXT NOT NULL DEFAULT 'none' CHECK (set_aside_type IN ('none', 'small_business', '8a', 'hubzone', 'wosb', 'vosb', 'sdvosb')),
  
  -- Commercial Real Estate Specific
  naics_codes TEXT[] DEFAULT ARRAY['531120'],
  property_type TEXT,
  space_requirements JSONB,
  location_requirements JSONB,
  
  -- Financial Information
  estimated_value_min NUMERIC,
  estimated_value_max NUMERIC,
  budget_range JSONB,
  
  -- Timeline
  posted_date TIMESTAMPTZ,
  response_due_date TIMESTAMPTZ,
  questions_due_date TIMESTAMPTZ,
  proposal_due_date TIMESTAMPTZ,
  estimated_award_date TIMESTAMPTZ,
  performance_start_date TIMESTAMPTZ,
  performance_end_date TIMESTAMPTZ,
  
  -- Location Data
  place_of_performance_state TEXT,
  place_of_performance_city TEXT,
  place_of_performance_zip TEXT,
  place_of_performance_country TEXT DEFAULT 'USA',
  coordinates JSONB, -- {lat: number, lng: number}
  
  -- Contact Information
  contact_info JSONB,
  
  -- Documents and Links
  sam_gov_url TEXT,
  documents JSONB DEFAULT '[]',
  
  -- Compliance and Requirements
  compliance_requirements JSONB,
  special_requirements TEXT[] DEFAULT '{}',
  
  -- AI Analysis Fields
  ai_summary TEXT,
  commercial_real_estate_score INTEGER DEFAULT 0 CHECK (commercial_real_estate_score >= 0 AND commercial_real_estate_score <= 100),
  key_highlights TEXT[] DEFAULT '{}',
  risk_factors TEXT[] DEFAULT '{}',
  
  -- Data Source and Processing
  source TEXT NOT NULL DEFAULT 'unknown',
  source_id TEXT,
  last_updated_at_source TIMESTAMPTZ,
  extraction_confidence DECIMAL(3,2) DEFAULT 0.8,
  
  -- System Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  tags TEXT[] DEFAULT '{}'
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rfp_opportunities_status ON rfp_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_rfp_opportunities_state ON rfp_opportunities(place_of_performance_state);
CREATE INDEX IF NOT EXISTS idx_rfp_opportunities_score ON rfp_opportunities(commercial_real_estate_score);
CREATE INDEX IF NOT EXISTS idx_rfp_opportunities_source ON rfp_opportunities(source);
CREATE INDEX IF NOT EXISTS idx_rfp_opportunities_created_at ON rfp_opportunities(created_at);
CREATE INDEX IF NOT EXISTS idx_rfp_opportunities_due_date ON rfp_opportunities(response_due_date);
CREATE INDEX IF NOT EXISTS idx_rfp_opportunities_naics ON rfp_opportunities USING GIN(naics_codes);
CREATE INDEX IF NOT EXISTS idx_rfp_opportunities_tags ON rfp_opportunities USING GIN(tags);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_rfp_opportunities_updated_at ON rfp_opportunities;
CREATE TRIGGER update_rfp_opportunities_updated_at
    BEFORE UPDATE ON rfp_opportunities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security) if needed
-- ALTER TABLE rfp_opportunities ENABLE ROW LEVEL SECURITY;

-- Sample policies (uncomment if using RLS)
-- CREATE POLICY "Enable read access for all users" ON rfp_opportunities FOR SELECT USING (true);
-- CREATE POLICY "Enable insert for authenticated users only" ON rfp_opportunities FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Enable update for authenticated users only" ON rfp_opportunities FOR UPDATE USING (auth.role() = 'authenticated');

-- Create a view for easier querying with computed fields
CREATE OR REPLACE VIEW rfp_opportunities_view AS 
SELECT 
  *,
  CASE 
    WHEN response_due_date IS NOT NULL AND response_due_date > NOW() THEN 
      EXTRACT(days FROM (response_due_date - NOW()))
    ELSE NULL 
  END AS days_until_due,
  CASE 
    WHEN coordinates IS NOT NULL THEN TRUE 
    ELSE FALSE 
  END AS has_coordinates,
  CASE 
    WHEN commercial_real_estate_score >= 80 THEN 'high'
    WHEN commercial_real_estate_score >= 60 THEN 'medium'
    WHEN commercial_real_estate_score >= 40 THEN 'low'
    ELSE 'very_low'
  END AS cre_score_category
FROM rfp_opportunities
WHERE is_active = TRUE;

COMMENT ON TABLE rfp_opportunities IS 'Stores RFP opportunities from various sources including government APIs and Excel uploads';
COMMENT ON COLUMN rfp_opportunities.solicitation_number IS 'Unique identifier for the opportunity, often from the issuing agency';
COMMENT ON COLUMN rfp_opportunities.commercial_real_estate_score IS 'AI-calculated score (0-100) indicating commercial real estate relevance';
COMMENT ON COLUMN rfp_opportunities.source IS 'Data source: government_api, excel_upload, notion_import, etc.';
COMMENT ON COLUMN rfp_opportunities.extraction_confidence IS 'Confidence level (0-1) in the extracted/parsed data quality';