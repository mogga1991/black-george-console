import os
import csv
import re
import requests
import json

def load_credentials():
    """Load Supabase credentials from .env.local"""
    url = None
    key = None
    
    env_file = ".env.local"
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                if 'NEXT_PUBLIC_SUPABASE_URL=' in line:
                    url = line.split('=')[1].strip()
                elif 'SUPABASE_SERVICE_ROLE_KEY=' in line:
                    key = line.split('=')[1].strip()
                elif 'NEXT_PUBLIC_SUPABASE_ANON_KEY=' in line and not key:
                    key = line.split('=')[1].strip()
    
    return url, key

def parse_square_footage(sq_ft_text):
    """Parse square footage text into min/max values"""
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

def parse_rate(rate_text):
    """Extract numeric rate from rate text"""
    if not rate_text or rate_text.upper() == 'N/A':
        return None
    
    match = re.search(r'[\$]?([0-9]+\.?[0-9]*)', rate_text.replace(',', ''))
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None

def parse_building_types(building_type_text):
    """Parse building types from text into array"""
    if not building_type_text or building_type_text.strip() == '':
        return ['Unknown']
    
    types = [t.strip() for t in building_type_text.split(',')]
    return [t for t in types if t]

def insert_property(url, key, property_data):
    """Insert a property via HTTP API"""
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }
    
    try:
        response = requests.post(f"{url}/rest/v1/cre_properties", 
                               json=property_data, 
                               headers=headers)
        return response.status_code in [200, 201]
    except Exception as e:
        print(f"Insert error: {e}")
        return False

def main():
    """Main import function"""
    print("🏢 Direct HTTP CRE Data Import")
    print("=" * 40)
    
    # Load credentials
    url, key = load_credentials()
    if not url or not key:
        print("❌ Missing Supabase credentials in .env.local")
        return
    
    print(f"✅ Connecting to: {url}")
    
    # CSV file path
    csv_file = "/Users/georgemogga/Downloads/properties.xlsm - CREXi Inventory Export.csv"
    
    if not os.path.exists(csv_file):
        print(f"❌ CSV file not found: {csv_file}")
        return
    
    print(f"📖 Reading: {csv_file}")
    
    imported = 0
    errors = 0
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            # Read all lines to find header
            lines = f.readlines()
            
            # Find header row with "Address"
            header_line = None
            for i, line in enumerate(lines):
                if 'Address' in line and 'Building Type' in line:
                    header_line = i
                    break
            
            if header_line is None:
                print("❌ Cannot find header row")
                return
            
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
                    
                    # Insert property
                    success = insert_property(url, key, property_data)
                    
                    if success:
                        imported += 1
                        if imported % 25 == 0:
                            print(f"✅ Imported {imported} properties...")
                    else:
                        errors += 1
                        
                except Exception as e:
                    errors += 1
                    print(f"❌ Error processing row {row_num}: {e}")
                    continue
        
        print(f"\n🎉 Import Complete!")
        print(f"   ✅ Imported: {imported}")
        print(f"   ❌ Errors: {errors}")
        
        if imported > 0:
            print(f"\n🚀 SUCCESS! Check your CRE Console app - your properties are now available!")
            
            # Verify by checking count
            headers = {
                'apikey': key,
                'Authorization': f'Bearer {key}',
                'Content-Type': 'application/json'
            }
            
            try:
                response = requests.get(f"{url}/rest/v1/cre_properties?select=count", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    total = len(data)
                    print(f"📊 Total properties in database: {total}")
            except:
                pass
        
    except Exception as e:
        print(f"❌ Error reading CSV: {e}")

if __name__ == "__main__":
    main()