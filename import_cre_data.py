#!/usr/bin/env python3
"""
Complete CRE Data Import Script
Imports property data from CSV to Supabase (and optionally Notion)
"""

import os
import sys
import csv
import re
import json
import pandas as pd
from typing import Dict, List, Optional, Tuple
from supabase import create_client, Client

def get_supabase_client() -> Client:
    """Get Supabase client from environment variables"""
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
    service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    anon_key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    # Use service key for imports (has full access)
    key_to_use = service_key if service_key else anon_key
    
    if not url or not key_to_use:
        raise Exception("Missing Supabase credentials! Check .env.local file")
    
    return create_client(url, key_to_use)

def parse_square_footage(sq_ft_text: str) -> Tuple[Optional[int], Optional[int]]:
    """Parse square footage text into min/max values"""
    if not sq_ft_text or sq_ft_text.upper() == 'N/A' or sq_ft_text.strip() == '':
        return None, None
    
    # Remove commas and extra spaces
    cleaned = re.sub(r'[,\s]', '', sq_ft_text)
    
    # Handle ranges like "1000-45000"
    if '-' in cleaned:
        parts = cleaned.split('-')
        try:
            min_val = int(parts[0]) if parts[0] else None
            max_val = int(parts[1]) if parts[1] else None
            return min_val, max_val
        except ValueError:
            return None, None
    
    # Handle single values
    try:
        val = int(cleaned)
        return val, val
    except ValueError:
        return None, None

def parse_rate(rate_text: str) -> Optional[float]:
    """Extract numeric rate from rate text"""
    if not rate_text or rate_text.upper() == 'N/A' or rate_text.strip() == '':
        return None
    
    # Extract first number (including decimals)
    match = re.search(r'[\$]?([0-9]+\.?[0-9]*)', rate_text.replace(',', ''))
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None

def parse_building_types(building_type_text: str) -> List[str]:
    """Parse building types from text into array"""
    if not building_type_text or building_type_text.strip() == '':
        return ['Unknown']
    
    # Split by comma and clean
    types = [t.strip() for t in building_type_text.split(',')]
    return [t for t in types if t]

def validate_coordinates(lat: float, lng: float) -> bool:
    """Validate latitude and longitude values"""
    if lat is None or lng is None:
        return False
    return -90 <= lat <= 90 and -180 <= lng <= 180

def test_supabase_connection(supabase: Client) -> bool:
    """Test if we can connect to Supabase and access the table"""
    try:
        # Try to query the table
        result = supabase.table('cre_properties').select('count').limit(1).execute()
        print("✅ Successfully connected to Supabase and cre_properties table")
        return True
    except Exception as e:
        print(f"❌ Cannot access cre_properties table: {e}")
        print("\n💡 Make sure you've created the table first:")
        print("1. Go to https://supabase.com/dashboard")
        print("2. Run the SQL from the setup instructions")
        return False

def import_csv_to_supabase(supabase: Client, csv_file: str) -> bool:
    """Import CSV data to Supabase"""
    
    print(f"📖 Reading CSV file: {csv_file}")
    
    if not os.path.exists(csv_file):
        print(f"❌ CSV file not found: {csv_file}")
        return False
    
    try:
        # Read CSV - the CREXi export has some header rows to skip
        df = pd.read_csv(csv_file)
        
        # Find the actual header row (contains "Address")
        header_row = None
        for i, row in df.iterrows():
            if 'Address' in str(row.iloc[0]):
                header_row = i
                break
        
        if header_row is None:
            print("❌ Could not find header row with 'Address'")
            return False
        
        # Read again with proper header
        df = pd.read_csv(csv_file, skiprows=header_row)
        print(f"📊 Found {len(df)} properties in CSV")
        
        # Clean up column names
        df.columns = df.columns.str.strip()
        
        # Process each property
        imported_count = 0
        error_count = 0
        batch_size = 10  # Process in small batches
        
        for index, row in df.iterrows():
            try:
                # Parse data
                sq_ft_min, sq_ft_max = parse_square_footage(str(row.get('Sq Ft', '')))
                rate_numeric = parse_rate(str(row.get('Rate', '')))
                building_types = parse_building_types(str(row.get('Building Type', '')))
                
                # Get coordinates
                longitude = None
                latitude = None
                if pd.notna(row.get('Longitude')):
                    try:
                        longitude = float(row.get('Longitude'))
                    except:
                        pass
                if pd.notna(row.get('Latitude')):
                    try:
                        latitude = float(row.get('Latitude'))
                    except:
                        pass
                
                # Validate coordinates
                if longitude is not None and latitude is not None:
                    if not validate_coordinates(latitude, longitude):
                        print(f"⚠️  Invalid coordinates for row {index}: lat={latitude}, lng={longitude}")
                        longitude = None
                        latitude = None
                
                # Get number of suites
                suites = 0
                if pd.notna(row.get('Suites')):
                    try:
                        suites = int(row.get('Suites', 0))
                    except:
                        suites = 0
                
                # Prepare property data
                property_data = {
                    'address': str(row.get('Address', '')).strip(),
                    'city': str(row.get('City', '')).strip(),
                    'state': str(row.get('State', '')).strip().upper()[:2],  # Ensure 2-letter state code
                    'zip_code': str(row.get('Zip', '')).strip(),
                    'building_types': building_types,
                    'tenancy': str(row.get('Tenancy', '')).strip(),
                    'square_footage': str(row.get('Sq Ft', '')).strip(),
                    'square_footage_min': sq_ft_min,
                    'square_footage_max': sq_ft_max,
                    'number_of_suites': suites,
                    'rate_text': str(row.get('Rate', '')).strip(),
                    'rate_per_sqft': rate_numeric,
                    'longitude': longitude,
                    'latitude': latitude
                }
                
                # Skip if missing required fields
                if not property_data['address'] or not property_data['city'] or not property_data['state']:
                    print(f"⚠️  Skipping row {index}: missing required fields")
                    error_count += 1
                    continue
                
                # Insert into Supabase
                result = supabase.table('cre_properties').insert(property_data).execute()
                
                if result.data:
                    imported_count += 1
                    if imported_count % 25 == 0:
                        print(f"✅ Imported {imported_count} properties...")
                else:
                    error_count += 1
                    print(f"❌ Error importing property at row {index}: {result}")
                    
            except Exception as e:
                error_count += 1
                print(f"❌ Error processing row {index}: {e}")
                continue
        
        print(f"\n🎉 Import Complete!")
        print(f"   ✅ Successfully imported: {imported_count}")
        print(f"   ❌ Errors: {error_count}")
        print(f"   📊 Total processed: {len(df)}")
        
        return imported_count > 0
        
    except Exception as e:
        print(f"❌ Error reading CSV: {e}")
        return False

def verify_import(supabase: Client):
    """Verify the imported data"""
    try:
        # Get count
        result = supabase.table('cre_properties').select('count').execute()
        count = len(result.data) if result.data else 0
        
        # Get sample records
        sample = supabase.table('cre_properties').select('*').limit(3).execute()
        
        print(f"\n📊 Verification Results:")
        print(f"   Total properties in database: {count}")
        
        if sample.data:
            print(f"   Sample properties:")
            for prop in sample.data:
                print(f"   - {prop['address']}, {prop['city']}, {prop['state']}")
                print(f"     Types: {prop['building_types']}")
                print(f"     Rate: {prop['rate_text']}")
        
        # Check for properties with coordinates
        with_coords = supabase.table('cre_properties').select('count').not_.is_('latitude', 'null').execute()
        coord_count = len(with_coords.data) if with_coords.data else 0
        print(f"   Properties with coordinates: {coord_count}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error verifying import: {e}")
        return False

def main():
    """Main import function"""
    print("🏢 CRE Properties Data Import")
    print("=" * 50)
    
    # Get Supabase client
    try:
        supabase = get_supabase_client()
        print("✅ Connected to Supabase")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        return False
    
    # Test table access
    if not test_supabase_connection(supabase):
        return False
    
    # Import CSV data
    csv_file = "/Users/georgemogga/Downloads/properties.xlsm - CREXi Inventory Export.csv"
    
    if not os.path.exists(csv_file):
        print(f"❌ CSV file not found: {csv_file}")
        print("Please check the file path")
        return False
    
    print(f"📁 Found CSV file: {csv_file}")
    
    # Import data
    success = import_csv_to_supabase(supabase, csv_file)
    
    if success:
        # Verify import
        verify_import(supabase)
        
        print(f"\n🎉 SUCCESS!")
        print(f"Your CRE properties are now available in:")
        print(f"   • Supabase database (cre_properties table)")
        print(f"   • Your CRE Console application")
        print(f"   • Map view with coordinates")
        
        return True
    else:
        print(f"\n❌ Import failed. Check the errors above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)