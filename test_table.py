#!/usr/bin/env python3
"""
Test if Supabase table was created correctly
"""

import os
from supabase import create_client

def test_table():
    """Test the cre_properties table"""
    
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
    key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    if not url or not key:
        print("❌ Missing Supabase credentials")
        return False
    
    try:
        # Create client
        supabase = create_client(url, key)
        print("✅ Supabase client created")
        
        # Test table access
        result = supabase.table('cre_properties').select('count').execute()
        print("✅ Table 'cre_properties' exists and is accessible!")
        
        # Try inserting test data
        test_data = {
            'address': 'TEST ADDRESS',
            'city': 'TEST CITY',
            'state': 'TX',
            'building_types': ['Office'],
            'rate_text': 'TEST RATE'
        }
        
        insert_result = supabase.table('cre_properties').insert(test_data).execute()
        
        if insert_result.data:
            test_id = insert_result.data[0]['id']
            print("✅ Successfully inserted test record")
            
            # Clean up test data
            supabase.table('cre_properties').delete().eq('id', test_id).execute()
            print("✅ Cleaned up test record")
            
            print("\n🎉 TABLE IS READY FOR DATA IMPORT!")
            return True
        else:
            print("❌ Could not insert test record")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Supabase Table Setup")
    print("=" * 40)
    success = test_table()
    
    if success:
        print("\n🚀 Ready to run: python simple_csv_import.py")
    else:
        print("\n⚠️  Please check the table creation in Supabase dashboard")