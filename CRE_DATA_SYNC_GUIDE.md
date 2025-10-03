# CRE Properties Data Sync Setup Guide

## 🏢 Overview

This guide sets up a complete data pipeline to sync commercial real estate properties between **Notion** and **Supabase**, starting with your CREXi CSV export data.

## 📁 Files Created

### Setup Scripts
- `setup_database.py` - Generates SQL for Supabase table creation
- `create_notion_db.py` - Sets up Notion database structure
- `quick_setup.py` - Imports CSV data into Supabase
- `create_table.sql` - Ready-to-run SQL for Supabase

### Schema & Pipeline
- `schemas/cre_properties_schema.sql` - Complete Supabase schema with triggers
- `scripts/csv_import.py` - Full-featured CSV import with validation
- `scripts/notion_supabase_sync.py` - Bidirectional sync pipeline

## 🚀 Quick Start (Recommended)

### Step 1: Set Up Supabase Table

1. **Go to your Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/[your-project-id]/sql
   ```

2. **Copy and paste this SQL:**
   ```sql
   -- Create CRE Properties Table
   CREATE TABLE IF NOT EXISTS cre_properties (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       notion_id TEXT UNIQUE,
       address TEXT NOT NULL,
       city TEXT NOT NULL,
       state TEXT NOT NULL,
       zip_code VARCHAR(10),
       building_types TEXT[] NOT NULL,
       tenancy TEXT,
       square_footage TEXT,
       square_footage_min INTEGER,
       square_footage_max INTEGER,
       number_of_suites INTEGER DEFAULT 0,
       rate_text TEXT NOT NULL,
       rate_per_sqft DECIMAL(10, 2),
       longitude DECIMAL(11, 8),
       latitude DECIMAL(10, 8),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   -- Create essential indexes
   CREATE INDEX IF NOT EXISTS idx_cre_properties_city_state ON cre_properties (city, state);
   CREATE INDEX IF NOT EXISTS idx_cre_properties_building_types ON cre_properties USING GIN (building_types);
   CREATE INDEX IF NOT EXISTS idx_cre_properties_location ON cre_properties (latitude, longitude);

   -- Enable Row Level Security
   ALTER TABLE cre_properties ENABLE ROW LEVEL SECURITY;

   -- Allow authenticated users to read
   CREATE POLICY "cre_properties_select" ON cre_properties FOR SELECT USING (auth.role() = 'authenticated');

   -- Allow service role to do everything (for imports)
   CREATE POLICY "cre_properties_service" ON cre_properties FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
   ```

3. **Click "Run" to execute the SQL**

### Step 2: Import Your CSV Data

1. **Install dependencies:**
   ```bash
   pip install supabase pandas python-dotenv
   ```

2. **Run the import:**
   ```bash
   python quick_setup.py
   ```

This will import all 452 properties from your CREXi export into Supabase.

## 🔧 Full Setup (Optional)

### Notion Integration

1. **Get Notion API Key:**
   - Go to https://developers.notion.com/
   - Create a new integration
   - Copy the API key

2. **Add to your `.env.local`:**
   ```env
   NOTION_API_KEY=your_notion_api_key_here
   ```

3. **Create Notion Database:**
   ```bash
   python create_notion_db.py
   ```

### Advanced Sync Pipeline

For ongoing sync between Notion and Supabase:

```bash
# Full bidirectional sync
python scripts/notion_supabase_sync.py --action full_sync

# Sync from Notion to Supabase only
python scripts/notion_supabase_sync.py --action sync_to_supabase

# Import CSV to both platforms
python scripts/csv_import.py --file properties.csv --target both
```

## 📊 Data Structure

### CSV Fields → Database Fields
- **Address** → `address` (text)
- **Building Type** → `building_types` (text array)
- **City, State, Zip** → `city`, `state`, `zip_code` (text)
- **Tenancy** → `tenancy` (Single/Multiple)
- **Sq Ft** → `square_footage` (text), `square_footage_min/max` (parsed integers)
- **Suites** → `number_of_suites` (integer)
- **Rate** → `rate_text` (text), `rate_per_sqft` (parsed decimal)
- **Longitude, Latitude** → `longitude`, `latitude` (decimal)

### Smart Data Processing
- **Range Parsing:** "1,000 - 45,000" → min: 1000, max: 45000
- **Rate Extraction:** "$15.50 / Sq Ft / YR" → 15.50
- **Building Types:** "Office, Industrial" → ["Office", "Industrial"]

## 🎯 Use Cases

### 1. One-Time Import (Start Here)
```bash
python quick_setup.py
```
Perfect for initial data load from your CREXi export.

### 2. Periodic CSV Updates
```bash
python scripts/csv_import.py --file new_properties.csv --target supabase
```
When you export new data from CREXi or other sources.

### 3. Notion → Supabase Sync
```bash
python scripts/notion_supabase_sync.py --action sync_to_supabase
```
After manually updating properties in Notion.

### 4. Full Bidirectional Sync
```bash
python scripts/notion_supabase_sync.py --action full_sync
```
Keep both platforms in perfect sync.

## 🔍 Verification

After importing, verify your data:

1. **Check Supabase:**
   - Go to Table Editor
   - Open `cre_properties` table
   - Should see 452+ rows

2. **Test in your CRE Console:**
   - The properties will automatically appear in your app
   - Use the search and filter features
   - View properties on the map

## 📈 Next Steps

1. **Start with Quick Start** - Get your data imported immediately
2. **Set up Notion integration** - If you want to manage properties in Notion
3. **Automate periodic sync** - Set up scheduled jobs for data updates
4. **Enhance with additional fields** - Add custom properties as needed

## 🛠️ Troubleshooting

### Common Issues

**"Table doesn't exist"**
- Make sure you ran the SQL in Supabase dashboard first

**"Import errors"**
- Check that your CSV file path is correct
- Verify Supabase credentials in `.env.local`

**"Notion connection failed"**
- Add `NOTION_API_KEY` to `.env.local`
- Make sure the integration has database access

### Support

All scripts include detailed error logging. Check the log files:
- `csv_import.log` - Import operation logs
- `sync.log` - Sync operation logs

## 🎉 Success!

Once set up, you'll have:
- ✅ 452 CRE properties in Supabase
- ✅ Searchable, filterable data
- ✅ Map integration with coordinates  
- ✅ Flexible sync pipeline for future updates
- ✅ Integration with your existing CRE Console

Your CRE Console application will now have real property data to work with!