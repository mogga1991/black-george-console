#!/usr/bin/env python3
"""
Simple CRE CSV Import (no pandas dependency)
"""

import os
import sys
import csv
import re
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
        raise Exception("Missing Supabase credentials!")
    
    return create_client(url, key_to_use)

def test_connection(supabase: Client) -> bool:
    """Test Supabase connection"""
    try:
        result = supabase.table('cre_properties').select('count').limit(1).execute()
        print("✅ Connected to Supabase and cre_properties table")
        return True
    except Exception as e:
        print(f"❌ Cannot access cre_properties table: {e}")
        print("\n💡 Create the table first:")
        print("1. Go to https://supabase.com/dashboard")
        print("2. Go to SQL Editor")  
        print("3. Run the SQL from create_table.sql")
        return False

def parse_square_footage(sq_ft_text: str) -> Tuple[Optional[int], Optional[int]]:
    """Parse square footage text"""
    if not sq_ft_text or sq_ft_text.upper() == 'N/A' or sq_ft_text.strip() == '':
        return None, None
    
    # Remove commas and spaces
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
    """Extract numeric rate"""
    if not rate_text or rate_text.upper() == 'N/A':
        return None
    
    match = re.search(r'[\$]?([0-9]+\.?[0-9]*)', rate_text.replace(',', ''))
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None

def parse_building_types(building_type_text: str) -> List[str]:
    """Parse building types"""
    if not building_type_text or building_type_text.strip() == '':
        return ['Unknown']
    
    types = [t.strip() for t in building_type_text.split(',')]
    return [t for t in types if t]

def import_csv(supabase: Client, csv_file: str) -> bool:
    """Import CSV using standard library only"""
    
    print(f"📖 Reading: {csv_file}")
    
    if not os.path.exists(csv_file):
        print(f"❌ File not found: {csv_file}")
        return False
    
    imported = 0
    errors = 0
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            # Read all lines first to find header
            lines = f.readlines()
            
            # Find header row with "Address"
            header_line = None
            for i, line in enumerate(lines):
                if 'Address' in line and 'Building Type' in line:
                    header_line = i
                    break
            
            if header_line is None:
                print("❌ Cannot find header row")
                return False
            
            print(f"📊 Found header at line {header_line}")
            
            # Parse CSV from header line onwards
            csv_data = ''.join(lines[header_line:])
            reader = csv.DictReader(csv_data.split('\n'))
            
            for row_num, row in enumerate(reader):
                try:
                    # Skip empty rows
                    if not row.get('Address', '').strip():
                        continue
                    
                    # Parse data
                    sq_ft_min, sq_ft_max = parse_square_footage(row.get('Sq Ft', ''))
                    rate_numeric = parse_rate(row.get('Rate', ''))
                    building_types = parse_building_types(row.get('Building Type', ''))
                    
                    # Parse coordinates
                    longitude = None
                    latitude = None
                    try:
                        if row.get('Longitude', '').strip():
                            longitude = float(row['Longitude'])
                        if row.get('Latitude', '').strip():
                            latitude = float(row['Latitude'])
                    except (ValueError, TypeError):
                        pass
                    
                    # Parse suites
                    suites = 0
                    try:
                        if row.get('Suites', '').strip():
                            suites = int(row['Suites'])
                    except (ValueError, TypeError):
                        pass
                    
                    # Prepare data
                    property_data = {
                        'address': row.get('Address', '').strip(),
                        'city': row.get('City', '').strip(), 
                        'state': row.get('State', '').strip().upper()[:2],
                        'zip_code': row.get('Zip', '').strip(),
                        'building_types': building_types,
                        'tenancy': row.get('Tenancy', '').strip(),
                        'square_footage': row.get('Sq Ft', '').strip(),
                        'square_footage_min': sq_ft_min,
                        'square_footage_max': sq_ft_max,
                        'number_of_suites': suites,
                        'rate_text': row.get('Rate', '').strip(),
                        'rate_per_sqft': rate_numeric,
                        'longitude': longitude,
                        'latitude': latitude
                    }
                    
                    # Skip if missing required fields
                    if not property_data['address'] or not property_data['city']:
                        errors += 1
                        continue
                    
                    # Insert to Supabase
                    result = supabase.table('cre_properties').insert(property_data).execute()
                    
                    if result.data:
                        imported += 1
                        if imported % 25 == 0:
                            print(f"✅ Imported {imported} properties...")
                    else:
                        errors += 1
                        print(f"❌ Error at row {row_num}")
                        
                except Exception as e:
                    errors += 1
                    print(f"❌ Error processing row {row_num}: {e}")
                    continue
        
        print(f"\n🎉 Import Complete!")
        print(f"   ✅ Imported: {imported}")
        print(f"   ❌ Errors: {errors}")
        
        return imported > 0
        
    except Exception as e:
        print(f"❌ Error reading CSV: {e}")
        return False

def verify_data(supabase: Client):
    """Verify imported data"""
    try:
        # Get total count
        result = supabase.table('cre_properties').select('*').execute()
        total = len(result.data) if result.data else 0
        
        # Get sample
        sample = supabase.table('cre_properties').select('*').limit(3).execute()
        
        print(f"\n📊 Database Status:")
        print(f"   Total properties: {total}")
        
        if sample.data:
            print(f"   Sample properties:")
            for prop in sample.data:
                print(f"   - {prop['address']}, {prop['city']}, {prop['state']}")
                print(f"     Types: {prop['building_types']}")
        
        # Count with coordinates
        with_coords = [p for p in result.data if p.get('latitude') and p.get('longitude')]
        print(f"   With coordinates: {len(with_coords)}")
        
    except Exception as e:
        print(f"❌ Error verifying: {e}")

def main():
    """Main function"""
    print("🏢 Simple CRE Data Import")
    print("=" * 40)
    
    # Connect to Supabase
    try:
        supabase = get_supabase_client()
        print("✅ Supabase client created")
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        return False
    
    # Test connection
    if not test_connection(supabase):
        return False
    
    # Import data
    csv_file = "/Users/georgemogga/Downloads/properties.xlsm - CREXi Inventory Export.csv"
    
    if not os.path.exists(csv_file):
        print(f"❌ CSV file not found: {csv_file}")
        return False
    
    success = import_csv(supabase, csv_file)
    
    if success:
        verify_data(supabase)
        print(f"\n🎉 SUCCESS! Your properties are now in Supabase!")
        print(f"Check your CRE Console app to see them.")
    
    return success

if __name__ == "__main__":
    main()