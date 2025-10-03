#!/usr/bin/env python3
"""
Create Notion database for CRE Properties
"""

import os
import sys
import json
import requests

def get_notion_credentials():
    """Get Notion credentials from environment"""
    # Try to load from .env.local file and wrangler.toml
    env_file = ".env.local"
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if 'NOTION' in key:
                        os.environ[key] = value
    
    # Also check wrangler.toml for database ID
    wrangler_file = "wrangler.toml"
    if os.path.exists(wrangler_file):
        with open(wrangler_file, 'r') as f:
            content = f.read()
            # Extract NOTION_DATABASE_ID
            import re
            match = re.search(r'NOTION_DATABASE_ID = "([^"]+)"', content)
            if match:
                os.environ['NOTION_DATABASE_ID'] = match.group(1)
    
    api_key = os.getenv('NOTION_API_KEY') or os.getenv('NOTION_API_TOKEN')
    database_id = os.getenv('NOTION_DATABASE_ID') or os.getenv('NOTION_PROPERTIES_DATABASE_ID')
    
    return api_key, database_id

def create_notion_database(api_key: str, page_id: str = None):
    """Create a new Notion database for CRE properties"""
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
    }
    
    # If no page_id provided, we need to create in a workspace
    # For now, let's list existing databases to see what we have
    
    database_schema = {
        "parent": {
            "type": "page_id",
            "page_id": page_id or "your-page-id-here"  # You'll need to provide this
        },
        "title": [
            {
                "type": "text",
                "text": {
                    "content": "CRE Properties"
                }
            }
        ],
        "properties": {
            "Address": {
                "title": {}
            },
            "Building Type": {
                "multi_select": {
                    "options": [
                        {"name": "Office", "color": "blue"},
                        {"name": "Retail", "color": "green"},
                        {"name": "Industrial", "color": "orange"},
                        {"name": "Land", "color": "brown"},
                        {"name": "Restaurant", "color": "red"},
                        {"name": "Special Purpose", "color": "purple"}
                    ]
                }
            },
            "City": {
                "rich_text": {}
            },
            "State": {
                "rich_text": {}
            },
            "Zip": {
                "rich_text": {}
            },
            "Tenancy": {
                "select": {
                    "options": [
                        {"name": "Single", "color": "blue"},
                        {"name": "Multiple", "color": "green"}
                    ]
                }
            },
            "Square Footage": {
                "rich_text": {}
            },
            "Suites": {
                "number": {"format": "number"}
            },
            "Rate": {
                "rich_text": {}
            },
            "Longitude": {
                "number": {"format": "number"}
            },
            "Latitude": {
                "number": {"format": "number"}
            },
            "Created": {
                "created_time": {}
            },
            "Last Updated": {
                "last_edited_time": {}
            }
        }
    }
    
    return database_schema

def list_existing_databases(api_key: str):
    """List existing Notion databases"""
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
    }
    
    # Search for databases
    search_payload = {
        "filter": {
            "value": "database",
            "property": "object"
        }
    }
    
    try:
        response = requests.post(
            'https://api.notion.com/v1/search',
            headers=headers,
            json=search_payload
        )
        
        if response.status_code == 200:
            data = response.json()
            databases = data.get('results', [])
            
            print(f"Found {len(databases)} databases:")
            for db in databases:
                title = db.get('title', [])
                title_text = title[0]['plain_text'] if title else 'Untitled'
                print(f"  - {title_text} (ID: {db['id']})")
            
            return databases
        else:
            print(f"Error searching databases: {response.status_code}")
            print(response.text)
            return []
            
    except Exception as e:
        print(f"Error: {e}")
        return []

def main():
    """Main function"""
    print("🏢 Notion Database Setup for CRE Properties")
    print("=" * 50)
    
    # Get credentials
    api_key, database_id = get_notion_credentials()
    
    if not api_key:
        print("❌ Notion API key not found!")
        print("\nPlease set NOTION_API_KEY or NOTION_API_TOKEN in your .env.local file")
        print("You can get this from: https://developers.notion.com/")
        return
    
    print(f"✅ Found Notion API key: {api_key[:10]}...")
    
    if database_id:
        print(f"✅ Found existing database ID: {database_id}")
        
        # Test access to existing database
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
        }
        
        try:
            response = requests.get(
                f'https://api.notion.com/v1/databases/{database_id}',
                headers=headers
            )
            
            if response.status_code == 200:
                db_data = response.json()
                title = db_data.get('title', [])
                title_text = title[0]['plain_text'] if title else 'Untitled'
                print(f"✅ Database accessible: {title_text}")
                
                # Show properties
                properties = db_data.get('properties', {})
                print(f"   Properties: {list(properties.keys())}")
                
            else:
                print(f"❌ Cannot access database: {response.status_code}")
                print("Database might not exist or you don't have access")
                
        except Exception as e:
            print(f"❌ Error accessing database: {e}")
    
    else:
        print("📋 No database ID found. Let's see what databases you have access to:")
        databases = list_existing_databases(api_key)
        
        if databases:
            print("\n✅ You can use one of these existing databases,")
            print("   or create a new one manually in Notion and update the NOTION_DATABASE_ID")
        else:
            print("\n💡 Create a new database manually in Notion:")
            print("   1. Go to notion.com")
            print("   2. Create a new page")
            print("   3. Add a database")
            print("   4. Copy the database ID from the URL")
            print("   5. Add NOTION_DATABASE_ID to your .env.local file")
    
    # Generate the database schema for manual creation
    schema = create_notion_database(api_key)
    
    print("\n" + "=" * 50)
    print("🔧 Database Schema (for manual setup)")
    print("=" * 50)
    print("\nIf creating manually, use these properties:")
    
    properties = schema['properties']
    for prop_name, prop_config in properties.items():
        prop_type = list(prop_config.keys())[0]
        print(f"  - {prop_name}: {prop_type}")
        
        if prop_type == 'multi_select':
            options = prop_config[prop_type].get('options', [])
            option_names = [opt['name'] for opt in options]
            print(f"    Options: {', '.join(option_names)}")
        elif prop_type == 'select':
            options = prop_config[prop_type].get('options', [])
            option_names = [opt['name'] for opt in options]
            print(f"    Options: {', '.join(option_names)}")
    
    # Save schema to file
    with open('notion_database_schema.json', 'w') as f:
        json.dump(schema, f, indent=2)
    
    print(f"\n✅ Schema saved to: notion_database_schema.json")

if __name__ == "__main__":
    main()