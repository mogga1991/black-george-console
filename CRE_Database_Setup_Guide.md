# Commercial Real Estate Properties - Notion Database Setup Guide

## Overview
This guide will help you create a Notion database for tracking commercial real estate properties with all the specified fields and proper data types.

## Database Structure

### Database Name: "CRE Properties"

### Properties Configuration

#### 1. Address
- **Type:** Text
- **Description:** Full street address of the property
- **Example:** "123 Main Street, Suite 100"

#### 2. Building Type
- **Type:** Multi-select
- **Options:**
  - Office (Blue)
  - Retail (Green)
  - Industrial (Gray)
  - Land (Brown)
  - Restaurant (Red)
  - Special Purpose (Purple)

#### 3. City
- **Type:** Text
- **Description:** City where the property is located
- **Example:** "San Francisco"

#### 4. State
- **Type:** Text
- **Description:** State abbreviation
- **Example:** "CA"

#### 5. Zip
- **Type:** Text
- **Description:** ZIP code
- **Example:** "94105"

#### 6. Tenancy
- **Type:** Select (single choice)
- **Options:**
  - Single (Green)
  - Multiple (Orange)

#### 7. Square Footage
- **Type:** Text
- **Description:** Can include ranges and units
- **Examples:** "10,000 sq ft", "5,000-7,500 sq ft"

#### 8. Number of Suites
- **Type:** Number
- **Description:** Total number of suites/units
- **Example:** 5

#### 9. Rate
- **Type:** Text
- **Description:** Rental rate in various formats
- **Examples:** "$45/sq ft/year", "$2,500/month", "NNN $25/sq ft"

#### 10. Longitude
- **Type:** Number
- **Description:** GPS longitude coordinate
- **Example:** -122.4194

#### 11. Latitude
- **Type:** Number
- **Description:** GPS latitude coordinate
- **Example:** 37.7749

## Manual Setup Instructions

### Step 1: Create New Database
1. Open Notion and navigate to your workspace
2. Click "+" to create a new page
3. Select "Database" → "Table"
4. Name it "CRE Properties"

### Step 2: Configure Properties
For each property listed above:
1. Click the "+" next to existing columns
2. Enter the property name
3. Select the appropriate type from the dropdown
4. For Select/Multi-select fields, add the options as specified

### Step 3: Set Up Views (Optional but Recommended)
1. **All Properties** (Default table view)
2. **By Building Type** (Group by Building Type)
3. **By City** (Group by City)
4. **Map View** (if you want to visualize locations using Longitude/Latitude)

## API Setup Instructions

### Prerequisites
- Notion account with API access
- Python 3.7+ installed
- `notion-client` package: `pip install notion-client`

### Environment Variables
Set these environment variables:
```bash
export NOTION_TOKEN="your_notion_integration_token"
export NOTION_PARENT_PAGE_ID="page_id_where_database_will_be_created"
```

### Getting Your Notion Token
1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Give it a name (e.g., "CRE Database Creator")
4. Select your workspace
5. Copy the "Internal Integration Token"

### Getting Parent Page ID
1. Open the Notion page where you want the database
2. Copy the page URL
3. The page ID is the long string after the last "/" and before any "?"
4. Example: `https://notion.so/workspace/My-Page-123abc456def789` → page ID is `123abc456def789`

### Running the Script
```bash
python3 create_notion_cre_database.py
```

## Sample Data Entry
Here's an example of how a complete property entry would look:

| Field | Value |
|-------|-------|
| Address | 123 Main Street, Suite 100 |
| Building Type | Office, Retail |
| City | San Francisco |
| State | CA |
| Zip | 94105 |
| Tenancy | Multiple |
| Square Footage | 10,000 sq ft |
| Number of Suites | 5 |
| Rate | $45/sq ft/year NNN |
| Longitude | -122.4194 |
| Latitude | 37.7749 |

## Database ID Information
Once created, your database will have:
- A unique Database ID (for API access)
- A shareable URL in format: `https://notion.so/[database_id]`

Save this information for future API integrations or bulk data imports.

## Next Steps
After setting up the database, you can:
1. Import existing property data
2. Set up automated data entry workflows
3. Create filtered views for different property types
4. Share with team members with appropriate permissions
5. Export data for analysis or reporting