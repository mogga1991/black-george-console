#!/usr/bin/env python3
"""
CRE Properties CSV Import Script
===============================

This script imports commercial real estate properties from CSV files into both
Notion and Supabase databases, with comprehensive data validation and transformation.

Features:
- CSV file parsing and validation
- Data transformation and cleaning
- Duplicate detection and handling
- Batch processing for large datasets
- Progress tracking and error logging
- Support for multiple CSV formats

Usage:
    python csv_import.py --file properties.csv --target both
    python csv_import.py --file properties.csv --target supabase --batch-size 50
    python csv_import.py --file properties.csv --target notion --dry-run
"""

import os
import sys
import csv
import json
import logging
import argparse
import traceback
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
import re

# Third-party imports
try:
    import pandas as pd
    import requests
    from supabase import create_client, Client
except ImportError as e:
    print(f"Required package not installed: {e}")
    print("Run: pip install pandas requests supabase python-dotenv")
    sys.exit(1)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('csv_import.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class CSVFieldMapper:
    """Maps various CSV field formats to standardized property fields"""
    
    # Standard field mapping - maps common CSV headers to our schema
    FIELD_MAPPINGS = {
        # Address fields
        'address': ['address', 'street_address', 'street', 'property_address', 'addr'],
        'city': ['city', 'municipality', 'town'],
        'state': ['state', 'province', 'st'],
        'zip_code': ['zip', 'zipcode', 'zip_code', 'postal_code', 'postal'],
        'county': ['county', 'parish'],
        
        # Building characteristics
        'building_types': ['building_type', 'building_types', 'type', 'property_type', 'asset_type'],
        'tenancy': ['tenancy', 'tenant_type', 'occupancy_type'],
        
        # Size and space
        'square_footage': ['square_footage', 'sq_ft', 'sqft', 'size', 'total_sq_ft', 'rentable_sf'],
        'number_of_suites': ['suites', 'number_of_suites', 'units', 'num_suites'],
        
        # Financial
        'rate_text': ['rate', 'rent', 'rate_per_sf', 'price_per_sf', 'asking_rate'],
        
        # Location
        'latitude': ['latitude', 'lat', 'y_coord'],
        'longitude': ['longitude', 'lng', 'lon', 'x_coord'],
        
        # Contact
        'contact_name': ['contact_name', 'contact', 'agent_name', 'broker_name'],
        'contact_email': ['contact_email', 'email', 'agent_email', 'broker_email'],
        'contact_phone': ['contact_phone', 'phone', 'agent_phone', 'broker_phone'],
        
        # Additional
        'description': ['description', 'notes', 'comments', 'details'],
        'year_built': ['year_built', 'built_year', 'construction_year'],
        'parking_spaces': ['parking', 'parking_spaces', 'parking_spots']
    }
    
    @classmethod
    def map_csv_headers(cls, csv_headers: List[str]) -> Dict[str, str]:
        """Map CSV headers to standard field names"""
        mapping = {}
        csv_headers_lower = [h.lower().strip() for h in csv_headers]
        
        for standard_field, possible_names in cls.FIELD_MAPPINGS.items():
            for possible_name in possible_names:
                if possible_name.lower() in csv_headers_lower:
                    original_header = csv_headers[csv_headers_lower.index(possible_name.lower())]
                    mapping[standard_field] = original_header
                    break
        
        return mapping

class DataValidator:
    """Validates and cleans property data"""
    
    @staticmethod
    def validate_address(address: str) -> bool:
        """Validate address format"""
        if not address or len(address.strip()) < 5:
            return False
        return True
    
    @staticmethod
    def validate_coordinates(lat: Optional[float], lng: Optional[float]) -> bool:
        """Validate latitude and longitude"""
        if lat is None or lng is None:
            return True  # Coordinates are optional
        
        return (-90 <= lat <= 90) and (-180 <= lng <= 180)
    
    @staticmethod
    def clean_building_types(building_types: str) -> List[str]:
        """Clean and parse building types"""
        if not building_types:
            return []
        
        # Split by common separators and clean
        types = re.split(r'[,;/|]', building_types)
        cleaned_types = []
        
        for bt in types:
            bt = bt.strip().title()
            if bt and bt not in cleaned_types:
                cleaned_types.append(bt)
        
        return cleaned_types
    
    @staticmethod
    def clean_phone_number(phone: str) -> str:
        """Clean and format phone number"""
        if not phone:
            return ""
        
        # Remove all non-digit characters
        digits = re.sub(r'\D', '', phone)
        
        # Format US phone numbers
        if len(digits) == 10:
            return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        elif len(digits) == 11 and digits[0] == '1':
            return f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
        
        return phone  # Return original if can't format

class NotionImporter:
    """Handles importing data to Notion"""
    
    def __init__(self, api_token: str, database_id: str):
        self.api_token = api_token
        self.database_id = database_id
        self.base_url = "https://api.notion.com/v1"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }
    
    def property_to_notion_format(self, property_data: Dict) -> Dict:
        """Convert property data to Notion properties format"""
        notion_props = {}
        
        # Required fields
        if property_data.get('address'):
            notion_props['Address'] = {
                "rich_text": [{"text": {"content": property_data['address']}}]
            }
        
        if property_data.get('city'):
            notion_props['City'] = {"select": {"name": property_data['city']}}
        
        if property_data.get('state'):
            notion_props['State'] = {"select": {"name": property_data['state']}}
        
        if property_data.get('zip_code'):
            notion_props['Zip Code'] = {
                "rich_text": [{"text": {"content": str(property_data['zip_code'])}}]
            }
        
        # Building types (multi-select)
        building_types = property_data.get('building_types', [])
        if building_types:
            notion_props['Building Types'] = {
                "multi_select": [{"name": bt} for bt in building_types]
            }
        
        # Tenancy
        if property_data.get('tenancy'):
            notion_props['Tenancy'] = {"select": {"name": property_data['tenancy']}}
        
        # Square footage
        if property_data.get('square_footage'):
            notion_props['Square Footage'] = {
                "rich_text": [{"text": {"content": str(property_data['square_footage'])}}]
            }
        
        # Number of suites
        if property_data.get('number_of_suites'):
            notion_props['Number of Suites'] = {"number": int(property_data['number_of_suites'])}
        
        # Rate
        if property_data.get('rate_text'):
            notion_props['Rate'] = {
                "rich_text": [{"text": {"content": property_data['rate_text']}}]
            }
        
        # Coordinates
        if property_data.get('longitude'):
            notion_props['Longitude'] = {"number": float(property_data['longitude'])}
        if property_data.get('latitude'):
            notion_props['Latitude'] = {"number": float(property_data['latitude'])}
        
        # Optional fields
        if property_data.get('contact_name'):
            notion_props['Contact Name'] = {
                "rich_text": [{"text": {"content": property_data['contact_name']}}]
            }
        
        if property_data.get('contact_email'):
            notion_props['Contact Email'] = {"email": property_data['contact_email']}
        
        if property_data.get('contact_phone'):
            notion_props['Contact Phone'] = {"phone_number": property_data['contact_phone']}
        
        if property_data.get('description'):
            notion_props['Description'] = {
                "rich_text": [{"text": {"content": property_data['description']}}]
            }
        
        return notion_props
    
    def create_property(self, property_data: Dict) -> Dict:
        """Create property in Notion"""
        notion_props = self.property_to_notion_format(property_data)
        
        payload = {
            "parent": {"database_id": self.database_id},
            "properties": notion_props
        }
        
        response = requests.post(
            f"{self.base_url}/pages",
            headers=self.headers,
            json=payload
        )
        
        if response.status_code != 200:
            raise Exception(f"Failed to create Notion page: {response.status_code} - {response.text}")
        
        return response.json()

class CSVImporter:
    """Main CSV import orchestrator"""
    
    def __init__(self, supabase_url: str, supabase_key: str, notion_token: str = None, notion_db_id: str = None):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
        self.notion_importer = None
        if notion_token and notion_db_id:
            self.notion_importer = NotionImporter(notion_token, notion_db_id)
        
        self.validator = DataValidator()
        
    def read_csv_file(self, file_path: str) -> Tuple[List[Dict], Dict[str, str]]:
        """Read and parse CSV file"""
        logger.info(f"Reading CSV file: {file_path}")
        
        try:
            # Read CSV with pandas for better handling
            df = pd.read_csv(file_path)
            
            # Get field mapping
            headers = df.columns.tolist()
            field_mapping = CSVFieldMapper.map_csv_headers(headers)
            
            logger.info(f"Detected {len(df)} rows and {len(headers)} columns")
            logger.info(f"Field mapping: {field_mapping}")
            
            # Convert to list of dictionaries
            records = df.to_dict('records')
            
            return records, field_mapping
            
        except Exception as e:
            logger.error(f"Error reading CSV file: {e}")
            raise
    
    def transform_csv_record(self, record: Dict, field_mapping: Dict[str, str]) -> Dict:
        """Transform CSV record to standard format"""
        transformed = {}
        
        # Map fields using the field mapping
        for standard_field, csv_field in field_mapping.items():
            value = record.get(csv_field)
            
            if pd.isna(value) or value == '':
                continue
            
            # Apply field-specific transformations
            if standard_field == 'building_types':
                transformed[standard_field] = self.validator.clean_building_types(str(value))
            elif standard_field == 'contact_phone':
                transformed[standard_field] = self.validator.clean_phone_number(str(value))
            elif standard_field in ['latitude', 'longitude']:
                try:
                    transformed[standard_field] = float(value)
                except (ValueError, TypeError):
                    continue
            elif standard_field in ['number_of_suites', 'year_built', 'parking_spaces']:
                try:
                    transformed[standard_field] = int(float(value))
                except (ValueError, TypeError):
                    continue
            else:
                transformed[standard_field] = str(value).strip()
        
        # Ensure required fields have defaults
        if 'building_types' not in transformed:
            transformed['building_types'] = ['Unknown']
        
        # Set source
        transformed['source'] = 'CSV Import'
        
        return transformed
    
    def validate_record(self, record: Dict) -> Tuple[bool, List[str]]:
        """Validate a single record"""
        errors = []
        
        # Required fields validation
        required_fields = ['address', 'city', 'state', 'rate_text']
        for field in required_fields:
            if not record.get(field):
                errors.append(f"Missing required field: {field}")
        
        # Address validation
        if record.get('address') and not self.validator.validate_address(record['address']):
            errors.append("Invalid address format")
        
        # Coordinates validation
        lat = record.get('latitude')
        lng = record.get('longitude')
        if not self.validator.validate_coordinates(lat, lng):
            errors.append("Invalid coordinates")
        
        return len(errors) == 0, errors
    
    def import_to_supabase(self, records: List[Dict], batch_size: int = 100) -> Dict[str, int]:
        """Import records to Supabase"""
        logger.info(f"Importing {len(records)} records to Supabase...")
        
        stats = {"created": 0, "updated": 0, "errors": 0, "skipped": 0}
        
        # Process in batches
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            
            try:
                # Insert batch
                result = self.supabase.table("cre_properties").insert(batch).execute()
                stats["created"] += len(batch)
                logger.info(f"✅ Inserted batch {i//batch_size + 1}: {len(batch)} records")
                
            except Exception as e:
                # Handle conflicts by trying individual inserts
                logger.warning(f"Batch insert failed, trying individual inserts: {e}")
                
                for record in batch:
                    try:
                        # Try to find existing record by address
                        existing = self.supabase.table("cre_properties").select("id").eq("address", record["address"]).eq("city", record["city"]).execute()
                        
                        if existing.data:
                            # Update existing
                            self.supabase.table("cre_properties").update(record).eq("id", existing.data[0]["id"]).execute()
                            stats["updated"] += 1
                        else:
                            # Insert new
                            self.supabase.table("cre_properties").insert(record).execute()
                            stats["created"] += 1
                            
                    except Exception as individual_error:
                        stats["errors"] += 1
                        logger.error(f"❌ Error with individual record: {individual_error}")
        
        return stats
    
    def import_to_notion(self, records: List[Dict]) -> Dict[str, int]:
        """Import records to Notion"""
        if not self.notion_importer:
            raise Exception("Notion importer not configured")
        
        logger.info(f"Importing {len(records)} records to Notion...")
        
        stats = {"created": 0, "errors": 0}
        
        for i, record in enumerate(records, 1):
            try:
                self.notion_importer.create_property(record)
                stats["created"] += 1
                logger.info(f"✅ Created Notion page {i}/{len(records)}: {record.get('address', 'Unknown')}")
                
            except Exception as e:
                stats["errors"] += 1
                logger.error(f"❌ Error creating Notion page {i}: {e}")
                continue
        
        return stats
    
    def process_csv_file(self, file_path: str, target: str = "both", batch_size: int = 100, dry_run: bool = False) -> Dict[str, Any]:
        """Process entire CSV file"""
        logger.info(f"Processing CSV file: {file_path}")
        logger.info(f"Target: {target}, Batch size: {batch_size}, Dry run: {dry_run}")
        
        results = {
            "total_records": 0,
            "valid_records": 0,
            "invalid_records": 0,
            "supabase_stats": None,
            "notion_stats": None,
            "errors": []
        }
        
        try:
            # Read CSV file
            raw_records, field_mapping = self.read_csv_file(file_path)
            results["total_records"] = len(raw_records)
            
            # Transform and validate records
            valid_records = []
            
            for i, raw_record in enumerate(raw_records, 1):
                try:
                    # Transform record
                    transformed_record = self.transform_csv_record(raw_record, field_mapping)
                    
                    # Validate record
                    is_valid, validation_errors = self.validate_record(transformed_record)
                    
                    if is_valid:
                        valid_records.append(transformed_record)
                        results["valid_records"] += 1
                    else:
                        results["invalid_records"] += 1
                        results["errors"].append(f"Row {i}: {', '.join(validation_errors)}")
                        
                except Exception as e:
                    results["invalid_records"] += 1
                    results["errors"].append(f"Row {i}: Error processing record - {e}")
            
            logger.info(f"Validation completed: {results['valid_records']} valid, {results['invalid_records']} invalid")
            
            if dry_run:
                logger.info("🔍 Dry run completed - no data was imported")
                return results
            
            # Import to targets
            if target in ["supabase", "both"] and valid_records:
                results["supabase_stats"] = self.import_to_supabase(valid_records, batch_size)
            
            if target in ["notion", "both"] and valid_records:
                if self.notion_importer:
                    results["notion_stats"] = self.import_to_notion(valid_records)
                else:
                    logger.warning("Notion importer not configured, skipping Notion import")
            
            return results
            
        except Exception as e:
            logger.error(f"Fatal error processing CSV: {e}")
            logger.error(traceback.format_exc())
            results["errors"].append(f"Fatal error: {e}")
            return results

def load_environment():
    """Load environment variables"""
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    
    required_vars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    optional_vars = ["NOTION_API_TOKEN", "NOTION_PROPERTIES_DATABASE_ID"]
    
    env = {}
    missing_required = []
    
    for var in required_vars:
        value = os.getenv(var)
        if not value:
            missing_required.append(var)
        env[var.lower()] = value
    
    if missing_required:
        logger.error(f"Missing required environment variables: {missing_required}")
        sys.exit(1)
    
    for var in optional_vars:
        env[var.lower()] = os.getenv(var)
    
    return env

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="CRE Properties CSV Import Tool")
    parser.add_argument("--file", required=True, help="Path to CSV file")
    parser.add_argument(
        "--target", 
        choices=["supabase", "notion", "both"], 
        default="both",
        help="Import target (default: both)"
    )
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size for Supabase imports")
    parser.add_argument("--dry-run", action="store_true", help="Validate data without importing")
    
    args = parser.parse_args()
    
    try:
        # Validate file exists
        if not os.path.exists(args.file):
            logger.error(f"File not found: {args.file}")
            sys.exit(1)
        
        # Load environment
        env = load_environment()
        
        # Initialize importer
        importer = CSVImporter(
            supabase_url=env["supabase_url"],
            supabase_key=env["supabase_service_role_key"],
            notion_token=env.get("notion_api_token"),
            notion_db_id=env.get("notion_properties_database_id")
        )
        
        # Process CSV file
        results = importer.process_csv_file(
            file_path=args.file,
            target=args.target,
            batch_size=args.batch_size,
            dry_run=args.dry_run
        )
        
        # Display results
        print("\n" + "="*50)
        print("CSV IMPORT RESULTS")
        print("="*50)
        print(f"Total records processed: {results['total_records']}")
        print(f"Valid records: {results['valid_records']}")
        print(f"Invalid records: {results['invalid_records']}")
        
        if results.get('supabase_stats'):
            stats = results['supabase_stats']
            print(f"\nSupabase Import:")
            print(f"  Created: {stats['created']}")
            print(f"  Updated: {stats['updated']}")
            print(f"  Errors: {stats['errors']}")
        
        if results.get('notion_stats'):
            stats = results['notion_stats']
            print(f"\nNotion Import:")
            print(f"  Created: {stats['created']}")
            print(f"  Errors: {stats['errors']}")
        
        if results['errors']:
            print(f"\nErrors ({len(results['errors'])}):")
            for error in results['errors'][:10]:  # Show first 10 errors
                print(f"  {error}")
            if len(results['errors']) > 10:
                print(f"  ... and {len(results['errors']) - 10} more errors")
        
        print("="*50)
        
        # Write detailed results to JSON
        results_file = f"import_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        logger.info(f"Detailed results saved to: {results_file}")
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main()