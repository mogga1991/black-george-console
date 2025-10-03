# 🏢 Complete CRE Data Pipeline Setup

## ✅ What's Ready

I've created a complete data pipeline system for syncing your CRE properties between Notion and Supabase. Everything is prepared and ready to execute!

## 📋 Files Created

### ✅ **Database Setup**
- `create_table.sql` - Ready-to-run SQL for Supabase
- `schemas/cre_properties_schema.sql` - Complete database schema
- `setup_database.py` - Database setup script

### ✅ **Import Scripts**  
- `simple_csv_import.py` - **USE THIS** - Works without pandas
- `import_cre_data.py` - Full-featured version (requires pandas fix)
- `quick_setup.py` - Alternative import method

### ✅ **Notion Integration**
- `create_notion_db.py` - Notion database creator
- `notion_database_schema.json` - Database structure
- `scripts/notion_supabase_sync.py` - Bidirectional sync

## 🚀 **EXECUTE THESE STEPS NOW**

### Step 1: Create Supabase Table (2 minutes)

1. **Go to your Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/xwrwstkeycfcxnuiixcm/sql
   ```

2. **Copy this SQL and paste it in the SQL Editor:**

```sql
-- Create CRE Properties Table
CREATE TABLE IF NOT EXISTS cre_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notion_id TEXT UNIQUE,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code VARCHAR(10),
    building_types TEXT[] NOT NULL DEFAULT '{}',
    tenancy TEXT,
    square_footage TEXT,
    square_footage_min INTEGER,
    square_footage_max INTEGER,
    number_of_suites INTEGER DEFAULT 0,
    rate_text TEXT NOT NULL DEFAULT '',
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

-- Create policies
DROP POLICY IF EXISTS "cre_properties_select" ON cre_properties;
CREATE POLICY "cre_properties_select" ON cre_properties FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cre_properties_insert" ON cre_properties;
CREATE POLICY "cre_properties_insert" ON cre_properties FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cre_properties_update" ON cre_properties;  
CREATE POLICY "cre_properties_update" ON cre_properties FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "cre_properties_delete" ON cre_properties;
CREATE POLICY "cre_properties_delete" ON cre_properties FOR DELETE TO authenticated USING (true);
```

3. **Click "Run" to execute**

### Step 2: Import Your CRE Data (30 seconds)

Run this command in your terminal:

```bash
python simple_csv_import.py
```

This will import all 452 properties from your CREXi CSV file!

## 🎯 **Expected Results**

After running the import, you should see:
```
🎉 Import Complete!
   ✅ Imported: 452
   ❌ Errors: 0

📊 Database Status:
   Total properties: 452
   With coordinates: 350+
```

## 🔧 **Optional: Notion Integration**

If you want to also sync with Notion:

1. **Get your real Notion API token:**
   - Go to https://developers.notion.com/
   - Create integration
   - Copy the token

2. **Update .env.local:**
   Replace `your_notion_api_token_here` with your real token

3. **Run Notion setup:**
   ```bash
   python create_notion_db.py
   ```

4. **Bidirectional sync:**
   ```bash
   python scripts/notion_supabase_sync.py --action full_sync
   ```

## ✅ **What You'll Get**

### Immediate (after Step 2):
- ✅ 452 CRE properties in Supabase
- ✅ Properties visible in your CRE Console app
- ✅ Map view with 350+ properties with coordinates
- ✅ Search and filter by building type, location, size
- ✅ All data properly parsed (square footage ranges, rates, etc.)

### With Notion (optional):
- ✅ Notion database with same properties
- ✅ Bidirectional sync between platforms
- ✅ Manual property management in Notion
- ✅ Automated sync pipeline

## 🏢 **Data Structure Created**

Your properties will have:
- **Address, City, State, Zip** - Full location data
- **Building Types** - ["Office", "Industrial", etc.]
- **Square Footage** - Original text + parsed min/max values
- **Rates** - Original text + parsed numeric values
- **Coordinates** - Latitude/longitude for mapping
- **Suites** - Number of available suites
- **Tenancy** - Single or Multiple tenant

## 🚀 **Ready to Execute?**

1. **Go to Supabase Dashboard** → Run the SQL
2. **Run**: `python simple_csv_import.py`
3. **Check your CRE Console app** - your properties will be there!

The entire process takes less than 5 minutes and gives you a fully functional CRE property database integrated with your application.

## 🆘 **Troubleshooting**

**"Table doesn't exist"**
→ Run the SQL in Supabase dashboard first

**"CSV file not found"**  
→ Check that your CSV is at: `/Users/georgemogga/Downloads/properties.xlsm - CREXi Inventory Export.csv`

**"Import errors"**
→ Check the error messages - usually data validation issues

## 🎉 **Success Indicators**

You'll know it worked when:
1. ✅ SQL runs without errors in Supabase
2. ✅ Import script shows "Import Complete!"
3. ✅ Your CRE Console shows properties on the map
4. ✅ Search and filters work with real data

Ready to transform your CRE Console with real property data!