#!/usr/bin/env python3
"""
CRE Properties Data Sync Pipeline: Notion ↔ Supabase
====================================================

This script provides comprehensive data synchronization between Notion databases
and Supabase for commercial real estate properties.

Features:
- Bi-directional sync between Notion and Supabase
- Data transformation and parsing (square footage, rates, etc.)
- Error handling and validation
- Detailed logging and progress tracking
- Deduplication based on address matching

Usage:
    python notion_supabase_sync.py --action sync_to_supabase
    python notion_supabase_sync.py --action sync_to_notion  
    python notion_supabase_sync.py --action full_sync
"""

import os
import sys
import json
import logging
import argparse
import traceback
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
import re

# Third-party imports
try:
    import requests
    from supabase import create_client, Client
    import pandas as pd
except ImportError as e:
    print(f"Required package not installed: {e}")
    print("Run: pip install requests supabase pandas python-dotenv")
    sys.exit(1)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cre_sync.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class NotionClient:
    """Client for interacting with Notion API"""
    
    def __init__(self, api_token: str, database_id: str):
        self.api_token = api_token
        self.database_id = database_id
        self.base_url = "https://api.notion.com/v1"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }
    
    def query_database(self, start_cursor: Optional[str] = None) -> Dict:
        """Query all pages from the Notion database"""
        url = f"{self.base_url}/databases/{self.database_id}/query"
        
        payload = {
            "page_size": 100,
            "sorts": [{
                "property": "Last Updated",
                "direction": "descending"
            }]
        }
        
        if start_cursor:
            payload["start_cursor"] = start_cursor
        
        response = requests.post(url, headers=self.headers, json=payload)
        
        if response.status_code != 200:
            raise Exception(f"Notion API error: {response.status_code} - {response.text}")
        
        return response.json()
    
    def get_all_properties(self) -> List[Dict]:
        """Retrieve all properties from Notion database"""
        properties = []
        has_more = True
        start_cursor = None
        
        while has_more:
            response = self.query_database(start_cursor)
            properties.extend(response.get("results", []))
            has_more = response.get("has_more", False)
            start_cursor = response.get("next_cursor")
            
            logger.info(f"Retrieved {len(properties)} properties so far...")
        
        logger.info(f"Total properties retrieved from Notion: {len(properties)}")
        return properties
    
    def create_property(self, property_data: Dict) -> Dict:
        """Create a new property in Notion"""
        url = f"{self.base_url}/pages"
        
        payload = {
            "parent": {"database_id": self.database_id},
            "properties": property_data
        }
        
        response = requests.post(url, headers=self.headers, json=payload)
        
        if response.status_code != 200:
            raise Exception(f"Failed to create property: {response.status_code} - {response.text}")
        
        return response.json()
    
    def update_property(self, page_id: str, property_data: Dict) -> Dict:
        """Update an existing property in Notion"""
        url = f"{self.base_url}/pages/{page_id}"
        
        payload = {"properties": property_data}
        
        response = requests.patch(url, headers=self.headers, json=payload)
        
        if response.status_code != 200:
            raise Exception(f"Failed to update property: {response.status_code} - {response.text}")
        
        return response.json()

class PropertyDataTransformer:
    """Handles data transformation between Notion and Supabase formats"""
    
    @staticmethod
    def parse_square_footage(sq_ft_text: str) -> Tuple[Optional[int], Optional[int]]:
        """Parse square footage text into min/max values"""
        if not sq_ft_text or sq_ft_text.upper() in ['N/A', 'TBD', '']:
            return None, None
        
        # Remove commas and extra spaces
        cleaned = re.sub(r'[,\s]', '', sq_ft_text)
        
        # Handle ranges like "1000-45000"
        if '-' in cleaned:
            parts = cleaned.split('-')
            if len(parts) == 2:
                try:
                    min_val = int(parts[0])
                    max_val = int(parts[1])
                    return min_val, max_val
                except ValueError:
                    return None, None
        
        # Handle single values
        try:
            value = int(cleaned)
            return value, value
        except ValueError:
            return None, None
    
    @staticmethod
    def parse_rate(rate_text: str) -> Optional[float]:
        """Parse rate text to extract numeric value"""
        if not rate_text or rate_text.upper() in ['N/A', 'TBD', '']:
            return None
        
        # Extract first numeric value (remove $, commas)
        cleaned = re.sub(r'[\$,]', '', rate_text)
        match = re.search(r'(\d+\.?\d*)', cleaned)
        
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                return None
        
        return None
    
    @staticmethod
    def extract_notion_property_value(prop_data: Dict, prop_type: str) -> Any:
        """Extract value from Notion property based on type"""
        if not prop_data:
            return None
        
        prop_type = prop_data.get("type", "")
        
        if prop_type == "title":
            items = prop_data.get("title", [])
            return items[0].get("plain_text", "") if items else ""
        
        elif prop_type == "rich_text":
            items = prop_data.get("rich_text", [])
            return items[0].get("plain_text", "") if items else ""
        
        elif prop_type == "number":
            return prop_data.get("number")
        
        elif prop_type == "select":
            select_obj = prop_data.get("select")
            return select_obj.get("name", "") if select_obj else ""
        
        elif prop_type == "multi_select":
            items = prop_data.get("multi_select", [])
            return [item.get("name", "") for item in items]
        
        elif prop_type == "checkbox":
            return prop_data.get("checkbox", False)
        
        elif prop_type == "date":
            date_obj = prop_data.get("date")
            return date_obj.get("start", "") if date_obj else ""
        
        elif prop_type == "email":
            return prop_data.get("email", "")
        
        elif prop_type == "phone_number":
            return prop_data.get("phone_number", "")
        
        return None
    
    @classmethod
    def notion_to_supabase(cls, notion_page: Dict) -> Dict:
        """Transform Notion page data to Supabase format"""
        props = notion_page.get("properties", {})
        
        # Extract basic fields
        address = cls.extract_notion_property_value(props.get("Address"), "rich_text")
        building_types_list = cls.extract_notion_property_value(props.get("Building Types"), "multi_select")
        building_types = building_types_list if building_types_list else []
        city = cls.extract_notion_property_value(props.get("City"), "select")
        state = cls.extract_notion_property_value(props.get("State"), "select")
        zip_code = cls.extract_notion_property_value(props.get("Zip Code"), "rich_text")
        tenancy = cls.extract_notion_property_value(props.get("Tenancy"), "select")
        square_footage_text = cls.extract_notion_property_value(props.get("Square Footage"), "rich_text")
        suites = cls.extract_notion_property_value(props.get("Number of Suites"), "number")
        rate_text = cls.extract_notion_property_value(props.get("Rate"), "rich_text")
        longitude = cls.extract_notion_property_value(props.get("Longitude"), "number")
        latitude = cls.extract_notion_property_value(props.get("Latitude"), "number")
        
        # Parse complex fields
        sq_ft_min, sq_ft_max = cls.parse_square_footage(square_footage_text or "")
        rate_per_sqft = cls.parse_rate(rate_text or "")
        
        # Build Supabase record
        supabase_data = {
            "notion_id": notion_page.get("id"),
            "address": address or "",
            "city": city or "",
            "state": state or "",
            "zip_code": zip_code or "",
            "building_types": building_types,
            "tenancy": tenancy,
            "square_footage": square_footage_text or "",
            "square_footage_min": sq_ft_min,
            "square_footage_max": sq_ft_max,
            "number_of_suites": suites or 0,
            "rate_text": rate_text or "",
            "rate_per_sqft": rate_per_sqft,
            "longitude": longitude,
            "latitude": latitude,
            "source": "Notion",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Add optional fields
        contact_name = cls.extract_notion_property_value(props.get("Contact Name"), "rich_text")
        contact_email = cls.extract_notion_property_value(props.get("Contact Email"), "email")
        contact_phone = cls.extract_notion_property_value(props.get("Contact Phone"), "phone_number")
        description = cls.extract_notion_property_value(props.get("Description"), "rich_text")
        
        if contact_name:
            supabase_data["contact_name"] = contact_name
        if contact_email:
            supabase_data["contact_email"] = contact_email
        if contact_phone:
            supabase_data["contact_phone"] = contact_phone
        if description:
            supabase_data["description"] = description
        
        return supabase_data
    
    @classmethod
    def supabase_to_notion(cls, supabase_record: Dict) -> Dict:
        """Transform Supabase record to Notion properties format"""
        # Format building types for Notion multi-select
        building_types = supabase_record.get("building_types", [])
        notion_building_types = [{"name": bt} for bt in building_types] if building_types else []
        
        # Build Notion properties
        notion_props = {
            "Address": {
                "rich_text": [{"text": {"content": supabase_record.get("address", "")}}]
            },
            "City": {
                "select": {"name": supabase_record.get("city", "")} if supabase_record.get("city") else None
            },
            "State": {
                "select": {"name": supabase_record.get("state", "")} if supabase_record.get("state") else None
            },
            "Zip Code": {
                "rich_text": [{"text": {"content": supabase_record.get("zip_code", "")}}]
            },
            "Building Types": {
                "multi_select": notion_building_types
            },
            "Tenancy": {
                "select": {"name": supabase_record.get("tenancy", "")} if supabase_record.get("tenancy") else None
            },
            "Square Footage": {
                "rich_text": [{"text": {"content": supabase_record.get("square_footage", "")}}]
            },
            "Number of Suites": {
                "number": supabase_record.get("number_of_suites", 0)
            },
            "Rate": {
                "rich_text": [{"text": {"content": supabase_record.get("rate_text", "")}}]
            }
        }
        
        # Add coordinates if available
        if supabase_record.get("longitude") is not None:
            notion_props["Longitude"] = {"number": float(supabase_record["longitude"])}
        if supabase_record.get("latitude") is not None:
            notion_props["Latitude"] = {"number": float(supabase_record["latitude"])}
        
        # Add optional fields
        if supabase_record.get("contact_name"):
            notion_props["Contact Name"] = {
                "rich_text": [{"text": {"content": supabase_record["contact_name"]}}]
            }
        if supabase_record.get("contact_email"):
            notion_props["Contact Email"] = {"email": supabase_record["contact_email"]}
        if supabase_record.get("contact_phone"):
            notion_props["Contact Phone"] = {"phone_number": supabase_record["contact_phone"]}
        if supabase_record.get("description"):
            notion_props["Description"] = {
                "rich_text": [{"text": {"content": supabase_record["description"]}}]
            }
        
        return notion_props

class CREDataSync:
    """Main synchronization orchestrator"""
    
    def __init__(self, supabase_url: str, supabase_key: str, notion_token: str, notion_db_id: str):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.notion = NotionClient(notion_token, notion_db_id)
        self.transformer = PropertyDataTransformer()
        
        # Validate connections
        self._validate_connections()
    
    def _validate_connections(self):
        """Validate connections to both Supabase and Notion"""
        try:
            # Test Supabase connection
            result = self.supabase.table("cre_properties").select("id").limit(1).execute()
            logger.info("✅ Supabase connection validated")
        except Exception as e:
            logger.error(f"❌ Supabase connection failed: {e}")
            raise
        
        try:
            # Test Notion connection
            self.notion.query_database()
            logger.info("✅ Notion connection validated")
        except Exception as e:
            logger.error(f"❌ Notion connection failed: {e}")
            raise
    
    def sync_notion_to_supabase(self) -> Dict[str, int]:
        """Sync all properties from Notion to Supabase"""
        logger.info("🔄 Starting Notion → Supabase sync...")
        
        stats = {"created": 0, "updated": 0, "errors": 0}
        
        try:
            # Get all properties from Notion
            notion_properties = self.notion.get_all_properties()
            
            for i, notion_page in enumerate(notion_properties, 1):
                try:
                    # Transform to Supabase format
                    supabase_data = self.transformer.notion_to_supabase(notion_page)
                    
                    # Check if property exists
                    existing = self.supabase.table("cre_properties").select("id").eq("notion_id", supabase_data["notion_id"]).execute()
                    
                    if existing.data:
                        # Update existing property
                        result = self.supabase.table("cre_properties").update(supabase_data).eq("notion_id", supabase_data["notion_id"]).execute()
                        stats["updated"] += 1
                        logger.info(f"✅ Updated property {i}/{len(notion_properties)}: {supabase_data.get('address', 'Unknown')}")
                    else:
                        # Create new property
                        result = self.supabase.table("cre_properties").insert(supabase_data).execute()
                        stats["created"] += 1
                        logger.info(f"✅ Created property {i}/{len(notion_properties)}: {supabase_data.get('address', 'Unknown')}")
                        
                except Exception as e:
                    stats["errors"] += 1
                    logger.error(f"❌ Error processing property {i}: {e}")
                    continue
        
        except Exception as e:
            logger.error(f"❌ Fatal error in sync process: {e}")
            raise
        
        logger.info(f"🎉 Sync completed: {stats['created']} created, {stats['updated']} updated, {stats['errors']} errors")
        return stats
    
    def sync_supabase_to_notion(self) -> Dict[str, int]:
        """Sync properties from Supabase to Notion (for properties without notion_id)"""
        logger.info("🔄 Starting Supabase → Notion sync...")
        
        stats = {"created": 0, "updated": 0, "errors": 0}
        
        try:
            # Get properties without notion_id
            response = self.supabase.table("cre_properties").select("*").is_("notion_id", "null").execute()
            properties = response.data
            
            logger.info(f"Found {len(properties)} properties to sync to Notion")
            
            for i, prop in enumerate(properties, 1):
                try:
                    # Transform to Notion format
                    notion_data = self.transformer.supabase_to_notion(prop)
                    
                    # Create in Notion
                    new_page = self.notion.create_property(notion_data)
                    
                    # Update Supabase record with notion_id
                    self.supabase.table("cre_properties").update({"notion_id": new_page["id"]}).eq("id", prop["id"]).execute()
                    
                    stats["created"] += 1
                    logger.info(f"✅ Created Notion page {i}/{len(properties)}: {prop.get('address', 'Unknown')}")
                    
                except Exception as e:
                    stats["errors"] += 1
                    logger.error(f"❌ Error creating Notion page {i}: {e}")
                    continue
        
        except Exception as e:
            logger.error(f"❌ Fatal error in reverse sync: {e}")
            raise
        
        logger.info(f"🎉 Reverse sync completed: {stats['created']} created, {stats['updated']} updated, {stats['errors']} errors")
        return stats
    
    def full_sync(self) -> Dict[str, Any]:
        """Perform bidirectional sync"""
        logger.info("🔄 Starting full bidirectional sync...")
        
        results = {}
        
        # Notion → Supabase
        results["notion_to_supabase"] = self.sync_notion_to_supabase()
        
        # Supabase → Notion (for new properties)
        results["supabase_to_notion"] = self.sync_supabase_to_notion()
        
        logger.info("🎉 Full sync completed successfully!")
        return results
    
    def get_sync_status(self) -> Dict[str, Any]:
        """Get current sync status and statistics"""
        try:
            # Count properties in each system
            supabase_count = self.supabase.table("cre_properties").select("id", count="exact").execute()
            supabase_total = supabase_count.count
            
            supabase_with_notion = self.supabase.table("cre_properties").select("id", count="exact").not_.is_("notion_id", "null").execute()
            synced_count = supabase_with_notion.count
            
            notion_properties = self.notion.get_all_properties()
            notion_count = len(notion_properties)
            
            return {
                "supabase_total": supabase_total,
                "notion_total": notion_count,
                "synced_properties": synced_count,
                "unsynced_properties": supabase_total - synced_count,
                "last_check": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting sync status: {e}")
            return {"error": str(e)}

def load_environment():
    """Load environment variables"""
    # Try to load from .env file if available
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    
    required_vars = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY", 
        "NOTION_API_TOKEN",
        "NOTION_PROPERTIES_DATABASE_ID"
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {missing_vars}")
        sys.exit(1)
    
    return {
        "supabase_url": os.getenv("SUPABASE_URL"),
        "supabase_key": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        "notion_token": os.getenv("NOTION_API_TOKEN"),
        "notion_db_id": os.getenv("NOTION_PROPERTIES_DATABASE_ID")
    }

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="CRE Properties Data Sync Pipeline")
    parser.add_argument(
        "--action",
        choices=["sync_to_supabase", "sync_to_notion", "full_sync", "status"],
        default="status",
        help="Sync action to perform"
    )
    
    args = parser.parse_args()
    
    try:
        # Load environment
        env = load_environment()
        
        # Initialize sync client
        sync_client = CREDataSync(
            supabase_url=env["supabase_url"],
            supabase_key=env["supabase_key"],
            notion_token=env["notion_token"],
            notion_db_id=env["notion_db_id"]
        )
        
        # Execute requested action
        if args.action == "sync_to_supabase":
            result = sync_client.sync_notion_to_supabase()
            print(json.dumps(result, indent=2))
        
        elif args.action == "sync_to_notion":
            result = sync_client.sync_supabase_to_notion()
            print(json.dumps(result, indent=2))
        
        elif args.action == "full_sync":
            result = sync_client.full_sync()
            print(json.dumps(result, indent=2))
        
        elif args.action == "status":
            result = sync_client.get_sync_status()
            print(json.dumps(result, indent=2))
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main()