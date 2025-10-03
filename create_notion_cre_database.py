#!/usr/bin/env python3
"""
Script to create a Notion database for Commercial Real Estate Properties
Requires: pip install notion-client
Usage: Set NOTION_TOKEN environment variable and run this script
"""

import os
import json
from notion_client import Client

def create_cre_database():
    # Initialize Notion client
    notion_token = os.getenv('NOTION_TOKEN')
    if not notion_token:
        print("Error: NOTION_TOKEN environment variable not set")
        print("Get your token from: https://www.notion.so/my-integrations")
        return None
    
    notion = Client(auth=notion_token)
    
    # Get parent page ID (you'll need to set this)
    parent_page_id = os.getenv('NOTION_PARENT_PAGE_ID')
    if not parent_page_id:
        print("Error: NOTION_PARENT_PAGE_ID environment variable not set")
        print("This should be the ID of the page where you want to create the database")
        return None
    
    # Database properties definition
    properties = {
        "Address": {
            "rich_text": {}
        },
        "Building Type": {
            "multi_select": {
                "options": [
                    {"name": "Office", "color": "blue"},
                    {"name": "Retail", "color": "green"},
                    {"name": "Industrial", "color": "gray"},
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
                    {"name": "Single", "color": "green"},
                    {"name": "Multiple", "color": "orange"}
                ]
            }
        },
        "Square Footage": {
            "rich_text": {}
        },
        "Number of Suites": {
            "number": {}
        },
        "Rate": {
            "rich_text": {}
        },
        "Longitude": {
            "number": {}
        },
        "Latitude": {
            "number": {}
        }
    }
    
    try:
        # Create the database
        response = notion.databases.create(
            parent={
                "type": "page_id",
                "page_id": parent_page_id
            },
            title=[
                {
                    "type": "text",
                    "text": {
                        "content": "CRE Properties"
                    }
                }
            ],
            properties=properties
        )
        
        database_id = response["id"]
        print(f"✅ Successfully created CRE Properties database!")
        print(f"Database ID: {database_id}")
        print(f"Database URL: https://notion.so/{database_id.replace('-', '')}")
        
        # Save database info to file
        with open('cre_database_info.json', 'w') as f:
            json.dump({
                "database_id": database_id,
                "database_url": f"https://notion.so/{database_id.replace('-', '')}",
                "properties": list(properties.keys())
            }, f, indent=2)
        
        return database_id
        
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return None

def add_sample_property(database_id, notion):
    """Add a sample property to test the database structure"""
    try:
        response = notion.pages.create(
            parent={"database_id": database_id},
            properties={
                "Address": {
                    "rich_text": [{"text": {"content": "123 Main Street"}}]
                },
                "Building Type": {
                    "multi_select": [{"name": "Office"}]
                },
                "City": {
                    "rich_text": [{"text": {"content": "San Francisco"}}]
                },
                "State": {
                    "rich_text": [{"text": {"content": "CA"}}]
                },
                "Zip": {
                    "rich_text": [{"text": {"content": "94105"}}]
                },
                "Tenancy": {
                    "select": {"name": "Multiple"}
                },
                "Square Footage": {
                    "rich_text": [{"text": {"content": "10,000 sq ft"}}]
                },
                "Number of Suites": {
                    "number": 5
                },
                "Rate": {
                    "rich_text": [{"text": {"content": "$45/sq ft/year"}}]
                },
                "Longitude": {
                    "number": -122.4194
                },
                "Latitude": {
                    "number": 37.7749
                }
            }
        )
        print("✅ Sample property added successfully!")
        return response["id"]
    except Exception as e:
        print(f"❌ Error adding sample property: {e}")
        return None

if __name__ == "__main__":
    print("Creating Notion CRE Properties Database...")
    database_id = create_cre_database()
    
    if database_id:
        print("\n" + "="*50)
        print("DATABASE CREATED SUCCESSFULLY!")
        print("="*50)
        print(f"Database ID: {database_id}")
        print(f"Database URL: https://notion.so/{database_id.replace('-', '')}")
        
        # Optionally add a sample property
        add_sample = input("\nWould you like to add a sample property? (y/n): ")
        if add_sample.lower() == 'y':
            notion = Client(auth=os.getenv('NOTION_TOKEN'))
            add_sample_property(database_id, notion)
    else:
        print("\n❌ Failed to create database. Please check your credentials and try again.")