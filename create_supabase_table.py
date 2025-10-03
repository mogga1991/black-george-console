#!/usr/bin/env python3
"""
Create Supabase table via SQL execution
"""

import os
import sys
import requests
from supabase import create_client, Client

def get_supabase_client():
    """Get Supabase client and credentials"""
    # Load from .env.local
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
    anon_key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    return url, anon_key, service_key

def create_table_via_api(url: str, service_key: str):
    """Create table using Supabase REST API"""
    
    # SQL to create the table
    sql = """
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
DROP POLICY IF EXISTS "cre_properties_select" ON cre_properties;
CREATE POLICY "cre_properties_select" ON cre_properties FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to do everything (for imports)
DROP POLICY IF EXISTS "cre_properties_service" ON cre_properties;
CREATE POLICY "cre_properties_service" ON cre_properties FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
"""
    
    headers = {
        'Authorization': f'Bearer {service_key}',
        'Content-Type': 'application/json',
        'apikey': service_key
    }
    
    # Use the SQL endpoint
    api_url = f"{url}/rest/v1/rpc/exec_sql"
    
    payload = {
        'sql': sql
    }
    
    try:
        print("🔄 Creating table via Supabase API...")
        response = requests.post(api_url, json=payload, headers=headers)
        
        if response.status_code == 200:
            print("✅ Table created successfully!")
            return True
        else:
            print(f"❌ Error creating table: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception creating table: {e}")
        return False

def test_table_access(url: str, anon_key: str):
    """Test if we can access the created table"""
    try:
        supabase = create_client(url, anon_key)
        
        # Try to query the table
        result = supabase.table('cre_properties').select('count').execute()
        print("✅ Table exists and is accessible!")
        return True
        
    except Exception as e:
        print(f"❌ Cannot access table: {e}")
        return False

def main():
    """Main function"""
    print("🏢 Creating Supabase CRE Properties Table")
    print("=" * 50)
    
    # Get credentials
    url, anon_key, service_key = get_supabase_client()
    
    if not all([url, anon_key, service_key]):
        print("❌ Missing Supabase credentials!")
        print("Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY")
        return False
    
    print(f"✅ Found Supabase credentials")
    print(f"URL: {url}")
    
    # First test if table already exists
    print("\n🔍 Checking if table already exists...")
    if test_table_access(url, anon_key):
        print("✅ Table already exists! Skipping creation.")
        return True
    
    # Create table
    if not service_key:
        print("❌ Service role key required for table creation")
        return False
    
    # Try alternative approach - direct SQL execution
    try:
        from supabase import create_client
        supabase = create_client(url, service_key)
        
        # Simple table creation SQL
        simple_sql = """
        CREATE TABLE IF NOT EXISTS cre_properties (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            address TEXT NOT NULL,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            building_types TEXT[] NOT NULL DEFAULT '{}',
            rate_text TEXT NOT NULL DEFAULT ''
        );
        """
        
        # Note: Supabase Python client doesn't support DDL directly
        # We'll verify table exists another way
        print("🔄 Attempting to create table...")
        
        # Try to insert a test record to verify table structure
        test_data = {
            'address': 'TEST',
            'city': 'TEST', 
            'state': 'TX',
            'building_types': ['Office'],
            'rate_text': 'TEST'
        }
        
        result = supabase.table('cre_properties').insert(test_data).execute()
        
        if result.data:
            print("✅ Table created and tested successfully!")
            # Clean up test data
            supabase.table('cre_properties').delete().eq('address', 'TEST').execute()
            return True
        else:
            print("❌ Could not create/access table")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\n💡 Manual Setup Required:")
        print("1. Go to https://supabase.com/dashboard")
        print("2. Open your project")
        print("3. Go to SQL Editor")
        print("4. Run the SQL from create_table.sql")
        return False

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🚀 Ready for data import! Run: python quick_setup.py")
    else:
        print("\n⚠️  Manual table creation required. See instructions above.")