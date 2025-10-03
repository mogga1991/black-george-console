#!/usr/bin/env python3
"""
Database setup script for CRE Properties
Creates the table structure in Supabase
"""

import os
import sys

def get_supabase_credentials():
    """Get Supabase credentials from environment"""
    # Try to load from .env.local file
    env_file = ".env.local"
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if key in ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']:
                        os.environ[key] = value
    
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    return supabase_url, supabase_key

def main():
    """Main setup function"""
    print("🏢 CRE Properties Database Setup")
    print("=" * 40)
    
    # Get credentials
    url, key = get_supabase_credentials()
    
    if not url or not key:
        print("❌ Supabase credentials not found!")
        print("\nPlease ensure your .env.local file contains:")
        print("NEXT_PUBLIC_SUPABASE_URL=your_url")
        print("NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key")
        return
    
    print("✅ Found Supabase credentials")
    print(f"URL: {url[:30]}...")
    
    # Read SQL schema
    schema_file = "schemas/cre_properties_schema.sql"
    if not os.path.exists(schema_file):
        print(f"❌ Schema file not found: {schema_file}")
        return
    
    with open(schema_file, 'r') as f:
        sql_content = f.read()
    
    print(f"✅ Read SQL schema ({len(sql_content)} characters)")
    
    # Since we can't execute DDL directly via the Python client,
    # we'll output instructions and provide the SQL
    print("\n" + "=" * 60)
    print("🚀 NEXT STEPS - Execute SQL in Supabase Dashboard")
    print("=" * 60)
    print("\n1. Go to your Supabase dashboard:")
    print(f"   https://supabase.com/dashboard/project/[your-project-id]/sql")
    print("\n2. Copy and paste the following SQL:")
    print("\n" + "-" * 40)
    
    # Output simplified SQL for direct execution
    simplified_sql = """
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
"""
    
    print(simplified_sql)
    print("-" * 40)
    print("\n3. After executing the SQL, run:")
    print("   python quick_setup.py")
    print("\n4. This will import your CSV data into the new table")
    
    # Also save this to a file for easy copy-paste
    with open('create_table.sql', 'w') as f:
        f.write(simplified_sql)
    
    print(f"\n✅ SQL also saved to: create_table.sql")

if __name__ == "__main__":
    main()