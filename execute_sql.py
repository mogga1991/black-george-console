#!/usr/bin/env python3
"""
Execute SQL directly in Supabase using HTTP API
"""

import os
import requests

def execute_sql_in_supabase():
    """Execute SQL using Supabase's direct SQL endpoint"""
    
    # Load credentials
    env_file = ".env.local"
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if 'SUPABASE' in key:
                        os.environ[key] = value
    
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not service_key:
        print("❌ Missing Supabase credentials")
        return False
    
    # Extract project ID from URL
    project_id = url.split('//')[1].split('.')[0]
    
    # SQL to create table
    sql = """
-- Create CRE Properties Table
CREATE TABLE IF NOT EXISTS cre_properties (
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
CREATE INDEX IF NOT EXISTS idx_cre_properties_city_state ON cre_properties (city, state);
CREATE INDEX IF NOT EXISTS idx_cre_properties_building_types ON cre_properties USING GIN (building_types);
CREATE INDEX IF NOT EXISTS idx_cre_properties_location ON cre_properties (latitude, longitude);

-- Enable Row Level Security
ALTER TABLE cre_properties ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "cre_properties_select" ON cre_properties;
CREATE POLICY "cre_properties_select" ON cre_properties FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cre_properties_insert" ON cre_properties;
CREATE POLICY "cre_properties_insert" ON cre_properties FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cre_properties_update" ON cre_properties;  
CREATE POLICY "cre_properties_update" ON cre_properties FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "cre_properties_delete" ON cre_properties;
CREATE POLICY "cre_properties_delete" ON cre_properties FOR DELETE TO authenticated USING (true);
"""
    
    # Try using the database API endpoint
    headers = {
        'Authorization': f'Bearer {service_key}',
        'Content-Type': 'application/json'
    }
    
    # Method 1: Direct SQL execution via function
    print("🔄 Executing SQL to create CRE properties table...")
    
    try:
        # Use the SQL query endpoint
        sql_url = f"{url}/rest/v1/rpc/exec_sql"
        response = requests.post(
            sql_url,
            json={'query': sql},
            headers=headers
        )
        
        if response.status_code in [200, 201]:
            print("✅ SQL executed successfully!")
            return True
        else:
            print(f"❌ SQL execution failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error executing SQL: {e}")
    
    # If direct execution fails, create a simple function approach
    print("\n🔄 Trying alternative approach...")
    
    # Step by step approach
    simple_commands = [
        "CREATE TABLE IF NOT EXISTS cre_properties (id UUID PRIMARY KEY DEFAULT gen_random_uuid());",
        "ALTER TABLE cre_properties ADD COLUMN IF NOT EXISTS address TEXT;",
        "ALTER TABLE cre_properties ADD COLUMN IF NOT EXISTS city TEXT;",
        "ALTER TABLE cre_properties ADD COLUMN IF NOT EXISTS state TEXT;",
        "ALTER TABLE cre_properties ADD COLUMN IF NOT EXISTS building_types TEXT[] DEFAULT '{}';",
        "ALTER TABLE cre_properties ADD COLUMN IF NOT EXISTS rate_text TEXT DEFAULT '';",
        "ALTER TABLE cre_properties ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);",
        "ALTER TABLE cre_properties ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);",
        "ALTER TABLE cre_properties ENABLE ROW LEVEL SECURITY;",
    ]
    
    print("💡 Since direct SQL execution isn't working, here's what you need to do:")
    print("\n1. Go to your Supabase Dashboard:")
    print(f"   https://supabase.com/dashboard/project/{project_id}/sql")
    print("\n2. Copy and paste this SQL:")
    print("\n" + "="*60)
    print(sql)
    print("="*60)
    print("\n3. Click 'Run' to execute")
    print("\n4. Then run: python quick_setup.py")
    
    return False

if __name__ == "__main__":
    execute_sql_in_supabase()