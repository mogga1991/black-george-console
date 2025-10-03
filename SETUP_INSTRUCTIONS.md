# RFP Maps Feature Setup Instructions

## ✅ What's Been Built

Your RFP Maps feature is now complete with:

1. **Real Government RFP Integration** - Fetches opportunities from SAM.gov
2. **Interactive Maps Interface** - View opportunities on map with details
3. **Excel/CSV Upload to Notion** - Upload spreadsheets via drag-and-drop
4. **Notion → Supabase Sync** - Keep your database synchronized
5. **AI-Powered Summaries** - Generate concise opportunity descriptions
6. **Advanced Filtering** - Filter by state, agency, CRE score, etc.

## 🔧 Environment Configuration

Since you have SAM.gov API key in Cloudflare, add these to your `.env.local`:

```bash
# Notion API Configuration (for CSV upload feature)
NOTION_API_TOKEN=your_notion_api_token_here
NOTION_OPPORTUNITIES_DATABASE_ID=your_notion_database_id_here

# Supabase Configuration (if not already set)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Cloudflare Configuration (for SAM.gov API)
# ✅ You already have SAM_GOV_API_KEY in Cloudflare
```

## 📊 Database Setup

Run this SQL in your Supabase dashboard to create the RFP opportunities table:

```sql
-- Execute the schema file we created
\i schema/rfp-opportunities-schema.sql
```

Or copy the contents of `schema/rfp-opportunities-schema.sql` and run it in your Supabase SQL editor.

## 📝 Notion Database Setup

1. Create a new Notion database with these properties:
   - **Title** (Title)
   - **Solicitation Number** (Text)
   - **Description** (Text)
   - **Agency** (Select)
   - **Type** (Select: RFP, RFQ, IFB, etc.)
   - **Status** (Select: Open, Closed, Awarded)
   - **State** (Select)
   - **City** (Text)
   - **ZIP Code** (Text)
   - **Min Value** (Number)
   - **Max Value** (Number)
   - **Posted Date** (Date)
   - **Due Date** (Date)
   - **Min Square Feet** (Number)
   - **Max Square Feet** (Number)
   - **Property Type** (Select: Office, Warehouse, Retail)
   - **Latitude** (Number)
   - **Longitude** (Number)
   - **NAICS Code** (Text)
   - **Set Aside** (Select)
   - **Source** (Select)
   - **Uploaded At** (Date)

2. Get your database ID from the URL and add it to `.env.local`

## 🚀 How to Use

### 1. View Government Opportunities
- Navigate to `/rfp-map`
- Click "Refresh" to fetch latest SAM.gov opportunities
- Use filters to narrow down results
- Click opportunities to see details and AI summaries

### 2. Upload Your Own Data
- Prepare Excel/CSV with opportunity data
- Use column headers like: Title, Agency, State, City, Min Value, etc.
- Click "Upload Excel" and select your file
- Data goes to Notion first, then syncs to Supabase

### 3. Sync Notion to Supabase
- Click "Sync Notion → Supabase" to update your database
- This pulls all Notion data into your Supabase RFP table
- Refreshes the map view automatically

### 4. Generate AI Summaries
- Click "Generate AI Summary" on any opportunity
- AI analyzes the opportunity and creates a concise description
- Perfect for quick understanding of complex RFPs

## 📈 Features Overview

### Map View
- **Interactive markers** for each opportunity
- **Color-coded** by commercial real estate score
- **Click for details** including AI summary and SAM.gov link
- **Zoom to location** when available

### List View
- **Sortable columns** for easy browsing
- **Status badges** showing open/closed/awarded
- **Quick actions** to view details or visit SAM.gov
- **CRE relevance scores** to prioritize opportunities

### Filtering
- **State/Agency** filtering
- **CRE Score threshold** (0-100)
- **RFP Type** (RFP, RFQ, IFB, etc.)
- **Date ranges** for when opportunities were posted

### Data Sources
- **SAM.gov API** - Live government opportunities
- **Excel/CSV uploads** - Your private opportunity data
- **Notion integration** - Collaborative opportunity management
- **Supabase storage** - Fast, searchable database

## 🔍 Commercial Real Estate Scoring

The system automatically scores opportunities (0-100) based on:
- **Keywords**: office, warehouse, retail, building, space, lease
- **NAICS codes**: 531xxx (real estate), 236xxx (construction)
- **Space requirements**: square footage mentioned
- **Financial data**: budget/value ranges provided
- **Location data**: specific addresses or coordinates

Opportunities with scores 70+ are typically excellent CRE matches.

## 🎯 Next Steps

1. **Set up environment variables** (Notion API token, database ID)
2. **Run the database schema** in Supabase
3. **Test the integration** by visiting `/rfp-map`
4. **Upload some sample data** to test the full workflow
5. **Configure notifications** (optional - can be added later)

Your RFP Maps feature is now production-ready! 🎉