# CRE Properties Data Pipeline Setup Guide

This guide provides comprehensive instructions for setting up and using the commercial real estate properties data pipeline with Notion and Supabase integration.

## Overview

The CRE data pipeline provides:
- **Supabase Database**: Scalable PostgreSQL database with optimized schema for CRE properties
- **Notion Integration**: Bi-directional sync with Notion databases
- **CSV Import**: Bulk import from various CSV formats with data validation
- **Data Transformation**: Automatic parsing of square footage, rates, and other CRE-specific fields
- **Deduplication**: Address-based duplicate detection and handling

## Prerequisites

- **Node.js** 18+ (for the Next.js application)
- **Python** 3.8+ (for data pipeline scripts)
- **Supabase Account** with a project set up
- **Notion Account** with API access (optional)
- **Google Maps API Key** (optional, for geocoding)

## Quick Start

### 1. Database Setup

First, create the CRE properties table in your Supabase database:

```sql
-- Run this in your Supabase SQL Editor
-- File: schemas/cre_properties_schema.sql
```

Copy and execute the entire content of `/schemas/cre_properties_schema.sql` in your Supabase SQL editor.

### 2. Environment Configuration

```bash
# Copy the environment template
cp .env.template .env

# Edit .env with your actual values
# Required:
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Optional (for Notion integration):
NOTION_API_TOKEN=secret_your_notion_token
NOTION_PROPERTIES_DATABASE_ID=your_database_id
```

### 3. Python Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt
```

### 4. Usage Examples

#### Import CSV Data

```bash
# Import to both Supabase and Notion
python scripts/csv_import.py --file properties.csv --target both

# Import only to Supabase with custom batch size
python scripts/csv_import.py --file properties.csv --target supabase --batch-size 50

# Dry run to validate data without importing
python scripts/csv_import.py --file properties.csv --dry-run
```

#### Sync Notion and Supabase

```bash
# Sync from Notion to Supabase
python scripts/notion_supabase_sync.py --action sync_to_supabase

# Sync from Supabase to Notion (new properties)
python scripts/notion_supabase_sync.py --action sync_to_notion

# Full bidirectional sync
python scripts/notion_supabase_sync.py --action full_sync

# Check sync status
python scripts/notion_supabase_sync.py --action status
```

## Detailed Configuration

### Supabase Setup

1. **Create Project**: Sign up at [supabase.com](https://supabase.com) and create a new project
2. **Get Credentials**: 
   - Go to Project Settings > API
   - Copy your project URL and API keys
3. **Run Schema**: Execute the SQL schema in the Supabase SQL editor
4. **Configure RLS**: The schema includes Row Level Security policies

### Notion Setup (Optional)

1. **Create Integration**:
   - Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
   - Create a new integration
   - Copy the API token

2. **Create Database**:
   - Create a new Notion database with these properties:
     - Address (Text)
     - City (Select)
     - State (Select)
     - Zip Code (Text)
     - Building Types (Multi-select)
     - Tenancy (Select: Single, Multiple)
     - Square Footage (Text)
     - Number of Suites (Number)
     - Rate (Text)
     - Longitude (Number)
     - Latitude (Number)
     - Contact Name (Text)
     - Contact Email (Email)
     - Contact Phone (Phone)
     - Description (Text)

3. **Share Database**: Share your database with your integration

4. **Get Database ID**: Copy the database ID from the URL

## CSV Import Format

The CSV importer supports flexible column mapping. Supported column names include:

### Required Fields
- **Address**: `address`, `street_address`, `property_address`
- **City**: `city`, `municipality`, `town`
- **State**: `state`, `province`, `st`
- **Rate**: `rate`, `rent`, `rate_per_sf`, `asking_rate`

### Optional Fields
- **Zip Code**: `zip`, `zipcode`, `zip_code`, `postal_code`
- **Building Types**: `building_type`, `building_types`, `type`, `property_type`
- **Square Footage**: `square_footage`, `sq_ft`, `sqft`, `size`
- **Tenancy**: `tenancy`, `tenant_type`, `occupancy_type`
- **Suites**: `suites`, `number_of_suites`, `units`
- **Coordinates**: `latitude`/`longitude`, `lat`/`lng`
- **Contact**: `contact_name`, `contact_email`, `contact_phone`

### Sample CSV Format

```csv
Address,City,State,Zip Code,Building Types,Square Footage,Rate,Tenancy,Number of Suites,Longitude,Latitude
"123 Main St","Austin","TX","78701","Office,Industrial","5,000 - 25,000","$18.50 / Sq Ft / YR","Multiple",12,-97.7431,30.2672
"456 Business Pkwy","Dallas","TX","75201","Retail","2,500","$22.00 / Sq Ft / YR","Single",1,-96.7970,32.7767
```

## Data Processing Features

### Square Footage Parsing
- **Exact values**: "5,000" → min: 5000, max: 5000
- **Ranges**: "1,000 - 45,000" → min: 1000, max: 45000
- **Handles commas and spaces**

### Rate Parsing
- **Simple rates**: "$18.50 / Sq Ft / YR" → 18.50
- **Removes currency symbols and formatting**
- **Stores original text for reference**

### Building Types
- **Multi-select support**: "Office, Industrial" → ["Office", "Industrial"]
- **Handles various separators**: commas, semicolons, pipes

### Address Deduplication
- **Generated address keys** for duplicate detection
- **Similarity matching** for fuzzy duplicates
- **Conflict resolution** during imports

## Monitoring and Logging

### Log Files
- **csv_import.log**: CSV import operations
- **cre_sync.log**: Notion-Supabase sync operations

### Error Handling
- **Validation errors**: Detailed field-level validation
- **Import errors**: Individual record error tracking
- **Network errors**: Automatic retry with exponential backoff

### Progress Tracking
- **Batch processing**: Large datasets processed in chunks
- **Real-time updates**: Progress logging during operations
- **Statistics**: Detailed import/sync statistics

## API Integration

### Supabase API Usage

```javascript
import { supabase } from './lib/supabase/client'

// Query properties
const { data, error } = await supabase
  .from('cre_properties')
  .select('*')
  .eq('city', 'Austin')
  .gte('square_footage_min', 5000)

// Insert property
const { data, error } = await supabase
  .from('cre_properties')
  .insert({
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    building_types: ['Office'],
    rate_text: '$20.00 / Sq Ft / YR'
  })
```

### Notion API Usage

```javascript
import { getNotionClient } from './lib/notion/client'

const notion = getNotionClient()

// Query properties
const properties = await notion.queryProperties({
  buildingTypes: ['Office'],
  minSquareFootage: 5000,
  cities: ['Austin']
})

// Search properties
const results = await notion.searchProperties('downtown office')
```

## Performance Optimization

### Database Indexes
The schema includes optimized indexes for:
- **Address searches**: Full-text search with tsvector
- **Location queries**: Latitude/longitude indexes
- **Building type filters**: GIN indexes for arrays
- **Date ranges**: Listing date and created_at indexes

### Batch Processing
- **Configurable batch sizes** for large imports
- **Memory management** for processing large CSV files
- **Progress checkpointing** for resumable operations

### Caching
- **Query result caching** with configurable TTL
- **Geocoding cache** to avoid API rate limits
- **Connection pooling** for database operations

## Troubleshooting

### Common Issues

1. **Connection Errors**
   ```bash
   # Test Supabase connection
   python -c "from supabase import create_client; print('OK')"
   
   # Test Notion connection  
   python -c "import requests; print('OK')"
   ```

2. **Permission Errors**
   - Ensure Supabase RLS policies are configured
   - Verify Notion integration has database access
   - Check service role key permissions

3. **Data Validation Errors**
   - Review CSV format requirements
   - Check for required fields
   - Validate coordinate ranges

4. **Import Failures**
   - Check log files for detailed errors
   - Verify environment variables
   - Test with smaller datasets first

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug
export DEBUG=true

# Run with verbose output
python scripts/csv_import.py --file data.csv --dry-run
```

## Security Considerations

### Environment Variables
- **Never commit .env files**
- **Use service role keys** for server-side operations
- **Rotate API keys** regularly

### Database Security
- **Row Level Security** enabled by default
- **Admin-only write access** for imports
- **Authenticated read access** for queries

### Data Privacy
- **No sensitive data** in logs
- **Encrypted connections** to all services
- **Data validation** before processing

## Support and Maintenance

### Regular Tasks
- **Monitor log files** for errors
- **Update dependencies** monthly
- **Backup database** regularly
- **Test sync operations** weekly

### Scaling Considerations
- **Increase batch sizes** for larger datasets
- **Add connection pooling** for high concurrency
- **Monitor API rate limits** for Notion
- **Consider data archiving** for old properties

---

For additional support or feature requests, please refer to the project documentation or create an issue in the repository.