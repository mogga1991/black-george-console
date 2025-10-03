#!/usr/bin/env python3
"""
Quick setup script to create Supabase table and import CRE properties CSV
"""

import os
import sys
import csv
import re
from typing import Dict, List, Optional

# Check if we can import supabase
try:
    from supabase import create_client, Client
    import pandas as pd
except ImportError:
    print("Installing required packages...")
    os.system("pip install supabase pandas python-dotenv")
    from supabase import create_client, Client
    import pandas as pd

def get_supabase_client() -> Client:
    """Get Supabase client from environment variables"""
    # Try to load from .env.local file
    env_file = ".env.local"
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                if '=' in line:
                    key, value = line.strip().split('=', 1)
                    if key in ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']:
                        os.environ[key] = value
    
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("Error: Supabase credentials not found!")
        print("Please check your .env.local file or set environment variables:")
        print("- NEXT_PUBLIC_SUPABASE_URL")
        print("- NEXT_PUBLIC_SUPABASE_ANON_KEY")
        sys.exit(1)
    
    return create_client(supabase_url, supabase_key)

def test_table_exists(supabase: Client):
    """Test if the CRE properties table exists"""
    try:
        result = supabase.table('cre_properties').select('count').limit(1).execute()
        print("✅ Table 'cre_properties' exists and is accessible!")
        return True
    except Exception as e:
        print(f"❌ Table doesn't exist yet: {e}")
        print("\n💡 Please create the table first:")
        print("1. Go to: https://supabase.com/dashboard > SQL Editor")
        print("2. Run the SQL from create_table.sql")
        print("3. Then run this script again")
        return False

def parse_square_footage(sq_ft_text: str) -> tuple:
    """Parse square footage text into min/max values"""
    if not sq_ft_text or sq_ft_text.upper() == 'N/A':
        return None, None
    
    # Remove commas and extra spaces
    cleaned = re.sub(r'[,\s]', '', sq_ft_text)
    
    # Handle ranges like "1000-45000"
    if '-' in cleaned:
        parts = cleaned.split('-')
        try:
            min_val = int(parts[0])
            max_val = int(parts[1])
            return min_val, max_val
        except:
            return None, None
    
    # Handle single values
    try:
        val = int(cleaned)
        return val, val
    except:
        return None, None

def parse_rate(rate_text: str) -> Optional[float]:
    """Extract numeric rate from rate text"""
    if not rate_text or rate_text.upper() == 'N/A':
        return None
    
    # Extract first number (including decimals)
    match = re.search(r'[\$]?([0-9]+\.?[0-9]*)', rate_text.replace(',', ''))
    if match:
        try:
            return float(match.group(1))
        except:
            return None
    return None

def parse_building_types(building_type_text: str) -> List[str]:
    """Parse building types from text into array"""
    if not building_type_text:
        return ['Unknown']
    
    # Split by comma and clean
    types = [t.strip() for t in building_type_text.split(',')]
    return [t for t in types if t]

def import_csv_to_supabase(supabase: Client, csv_file: str):
    """Import CSV data to Supabase"""
    
    print(f"Reading CSV file: {csv_file}")
    
    try:
        # Read CSV
        df = pd.read_csv(csv_file)
        print(f"Found {len(df)} properties in CSV")
        
        # Skip the first few rows that contain summary info
        # Find the header row (contains "Address")
        header_row = None
        for i, row in df.iterrows():
            if 'Address' in str(row.iloc[0]):
                header_row = i
                break
        
        if header_row is None:
            print("Could not find header row with 'Address'")
            return
        
        # Read again with proper header
        df = pd.read_csv(csv_file, skiprows=header_row)
        print(f"Processing {len(df)} properties...")
        
        # Process each row
        imported_count = 0
        error_count = 0
        
        for index, row in df.iterrows():
            try:
                # Parse square footage
                sq_ft_min, sq_ft_max = parse_square_footage(str(row.get('Sq Ft', '')))
                
                # Parse rate
                rate_numeric = parse_rate(str(row.get('Rate', '')))
                
                # Parse building types
                building_types = parse_building_types(str(row.get('Building Type', '')))
                
                # Prepare data
                property_data = {
                    'address': str(row.get('Address', '')),
                    'city': str(row.get('City', '')),
                    'state': str(row.get('State', '')),
                    'zip_code': str(row.get('Zip', '')),
                    'building_types': building_types,
                    'tenancy': str(row.get('Tenancy', '')),
                    'square_footage': str(row.get('Sq Ft', '')),
                    'square_footage_min': sq_ft_min,
                    'square_footage_max': sq_ft_max,
                    'number_of_suites': int(row.get('Suites', 0)) if pd.notna(row.get('Suites')) else 0,
                    'rate_text': str(row.get('Rate', '')),
                    'rate_per_sqft': rate_numeric,
                    'longitude': float(row.get('Longitude')) if pd.notna(row.get('Longitude')) else None,
                    'latitude': float(row.get('Latitude')) if pd.notna(row.get('Latitude')) else None
                }
                
                # Insert into Supabase
                result = supabase.table('cre_properties').insert(property_data).execute()
                
                if result.data:
                    imported_count += 1
                    if imported_count % 50 == 0:
                        print(f"Imported {imported_count} properties...")
                else:
                    error_count += 1
                    print(f"Error importing property at row {index}")
                    
            except Exception as e:
                error_count += 1
                print(f"Error processing row {index}: {e}")
                continue
        
        print(f"✅ Import complete!")
        print(f"   - Successfully imported: {imported_count}")
        print(f"   - Errors: {error_count}")
        
    except Exception as e:
        print(f"Error reading CSV: {e}")

def main():
    """Main execution function"""
    
    print("🏢 CRE Properties Quick Setup")
    print("=" * 40)
    
    # Get Supabase client
    try:
        supabase = get_supabase_client()
        print("✅ Connected to Supabase")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        return
    
    # Test if table exists
    table_exists = test_table_exists(supabase)
    
    if not table_exists:
        return
    
    # Import CSV
    csv_file = "/Users/georgemogga/Downloads/properties.xlsm - CREXi Inventory Export.csv"
    
    if os.path.exists(csv_file):
        import_csv_to_supabase(supabase, csv_file)
    else:
        print(f"❌ CSV file not found: {csv_file}")
        print("Please check the file path or provide the correct path.")

if __name__ == "__main__":
    main()