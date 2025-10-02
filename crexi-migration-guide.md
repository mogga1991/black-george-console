# CREXi Properties Schema Migration Guide

## Overview

This guide provides instructions for implementing the new `crexi_properties` table schema that properly handles the CREXi data structure with all the complex fields like ranges in square footage and rates.

## Files Created

1. **`crexi-properties-schema.sql`** - Complete SQL schema for the new properties table
2. **`crexi-migration-guide.md`** - This guide with migration instructions

## Schema Features

### Key Improvements Over Original Properties Table

1. **Proper CREXi Data Handling**:
   - Handles comma-separated building types like "Office, Industrial"
   - Parses square footage ranges like "1,000 - 45,000"
   - Processes complex rate formats like "$19.50 / Sq Ft / YR"
   - Stores original raw data for auditing

2. **Enhanced Data Types**:
   - Enums for property status, tenancy type, and building types
   - Decimal fields with appropriate precision for financial data
   - Text arrays for multiple building types
   - JSONB for flexible amenity storage

3. **Automated Data Processing**:
   - Triggers to parse square footage ranges into min/max fields
   - Rate parsing to extract numeric values and units
   - Automatic primary building type assignment
   - Address key generation for deduplication

4. **Performance Optimizations**:
   - Comprehensive indexing strategy
   - Full-text search capabilities
   - GIN indexes for array and JSONB fields
   - Spatial indexes for location queries

5. **CRE-Specific Fields**:
   - Property status tracking
   - Listing agent information
   - Financial metrics (NOI, cap rate, price per sq ft)
   - Market classification
   - Zoning and opportunity zone flags

## Migration Steps

### Step 1: Backup Current Data (Important!)

```sql
-- Export current properties data
CREATE TABLE properties_backup AS SELECT * FROM properties;
```

### Step 2: Run the Schema

1. Open your Supabase SQL Editor
2. Copy and paste the entire contents of `crexi-properties-schema.sql`
3. Execute the script

### Step 3: Data Migration (if you have existing data)

```sql
-- Migrate existing properties to new table
INSERT INTO crexi_properties (
    address,
    city, 
    state,
    zip_code,
    latitude,
    longitude,
    total_sq_ft_exact,
    asking_price,
    created_at,
    property_id
)
SELECT 
    address1 as address,
    city,
    state,
    postal_code as zip_code,
    lat as latitude,
    lng as longitude,
    sqft as total_sq_ft_exact,
    asking_price,
    created_at,
    id::text as property_id
FROM properties
WHERE address1 IS NOT NULL;
```

### Step 4: Update Application Code

Update your TypeScript types to match the new schema:

```typescript
export interface CREXiProperty {
  id: string;
  property_id: string;
  address: string;
  address_line_2?: string;
  city: string;
  state: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
  building_types: string[];
  primary_building_type?: string;
  tenancy?: 'single' | 'multiple';
  total_sq_ft_min?: number;
  total_sq_ft_max?: number;
  total_sq_ft_exact?: number;
  total_sq_ft_raw: string;
  suites?: number;
  rate_min?: number;
  rate_max?: number;
  rate_exact?: number;
  rate_unit?: string;
  rate_raw: string;
  status?: 'available' | 'under_contract' | 'leased' | 'sold' | 'off_market' | 'pending' | 'withdrawn';
  listing_date?: string;
  description?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  source?: string;
  created_at: string;
  updated_at: string;
}
```

## Usage Examples

### Import CREXi CSV Data

Use the built-in import function:

```sql
-- Import a single property from CREXi CSV
SELECT import_crexi_property(
    '123 Main Street',           -- address
    'Office, Retail',            -- building_type
    'Austin',                    -- city
    'TX',                        -- state
    '78701',                     -- zip
    'Multiple',                  -- tenancy
    '5,000 - 15,000',           -- sq_ft
    8,                          -- suites
    '$22.00 / Sq Ft / YR',      -- rate
    -97.7431,                   -- longitude
    30.2672,                    -- latitude
    'CREXI-12345'               -- property_id (optional)
);
```

### Search Properties

```sql
-- Search by location and building type
SELECT * FROM crexi_properties 
WHERE city = 'Austin' 
AND 'office' = ANY(SELECT LOWER(unnest(building_types)));

-- Search by square footage range
SELECT * FROM crexi_properties 
WHERE (total_sq_ft_exact BETWEEN 1000 AND 5000)
   OR (total_sq_ft_min <= 5000 AND total_sq_ft_max >= 1000);

-- Full-text search
SELECT * FROM crexi_properties 
WHERE search_vector @@ plainto_tsquery('english', 'office downtown');

-- Search available properties view
SELECT * FROM available_properties 
WHERE state = 'TX' 
AND primary_building_type = 'office'
ORDER BY rate_from ASC;
```

### Update Property Status

```sql
-- Mark property as leased
UPDATE crexi_properties 
SET status = 'leased' 
WHERE property_id = 'CREXI-12345';
```

## API Integration

For Next.js API routes, you can create endpoints like:

```typescript
// pages/api/properties/crexi.ts
export default async function handler(req: NextRequest) {
  if (req.method === 'POST') {
    // Import CREXi data
    const { data, error } = await supabase
      .rpc('import_crexi_property', {
        p_address: req.body.address,
        p_building_type: req.body.building_type,
        p_city: req.body.city,
        // ... other parameters
      });
    
    return NextResponse.json({ data, error });
  }
}
```

## Performance Considerations

1. **Indexing**: The schema includes comprehensive indexes for common query patterns
2. **Full-text Search**: Use the search_vector for fast text searches
3. **Array Operations**: Building types are indexed with GIN for fast array searches
4. **Triggers**: Data parsing happens automatically on insert/update

## Security

1. **RLS Enabled**: Row-level security is configured
2. **Admin-only Writes**: Only admin users can insert/update properties
3. **Authenticated Reads**: All authenticated users can read properties

## Troubleshooting

### Common Issues

1. **Rate Parsing Errors**: Check the `rate_raw` field for complex formats
2. **Building Type Mismatches**: Verify building types match the enum values
3. **Duplicate Properties**: Use the `address_key` field for deduplication

### Debugging Queries

```sql
-- Check parsed square footage
SELECT property_id, total_sq_ft_raw, total_sq_ft_min, total_sq_ft_max, total_sq_ft_exact
FROM crexi_properties 
WHERE total_sq_ft_raw IS NOT NULL;

-- Check parsed rates
SELECT property_id, rate_raw, rate_min, rate_max, rate_exact, rate_unit
FROM crexi_properties 
WHERE rate_raw != 'N/A';

-- Check building type parsing
SELECT property_id, building_types, primary_building_type
FROM crexi_properties;
```

## Next Steps

1. **Test the Schema**: Import a small sample of CREXi data
2. **Update Frontend**: Modify your React components to use the new fields
3. **Add Validation**: Implement frontend validation for the new data types
4. **Create Dashboards**: Use the new financial fields for analytics
5. **Set up Monitoring**: Monitor the triggers and parsing functions

## Notes

- The original `properties` table is preserved - you can run both in parallel during migration
- All CREXi-specific parsing is handled by database triggers
- The schema is designed to be extensible for other data sources
- Consider setting up regular data imports from CREXi APIs if available