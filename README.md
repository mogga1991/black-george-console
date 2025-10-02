# CRE Leasing Lead & Opportunity Console

An internal web application to ingest CREXI and leasing spreadsheets, normalize & dedupe leads/opportunities, manage pipeline states, and surface dashboards—running on Cloudflare (edge) with Supabase (auth + Postgres + storage).

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (Edge Runtime)  
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Cloudflare Pages
- **File Processing**: xlsx for CSV/XLSX parsing
- **Authentication**: Supabase Auth with Row Level Security

## Features

- ✅ Upload and parse CSV/XLSX files from CREXI and leasing offices
- ✅ Normalize and deduplicate leads and opportunities
- ✅ Dashboard with KPIs and metrics
- ✅ Leads management with filtering and search
- ✅ Opportunities pipeline board
- ✅ Properties listing and management  
- ✅ Role-based access control (Admin/Agent/Viewer)
- ✅ Import system with dry-run preview
- ✅ Activity logging and audit trail

## Setup Instructions

### 1. Prerequisites

- Node.js 18+
- Supabase account and project
- Cloudflare account (for deployment)

### 2. Database Setup

Create a new Supabase project and run the SQL schema provided in the project documentation to set up tables, enums, and RLS policies.

### 3. Environment Variables

Copy `.env.local` and set your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### 5. MCP Servers (Cloudflare + Supabase)

- Cloudflare MCP: see `CLOUDFLARE_MCP_SETUP.md`
- Supabase MCP: see `SUPABASE_MCP_SETUP.md` and `.mcp.json.example`

This project does not require Vercel. You can run locally and use MCP clients directly.

### 6. Cloudflare Pages Deployment

```bash
# Build for Cloudflare Pages
npm run cf:build

# Preview locally
npm run cf:preview

# Deploy to Cloudflare Pages
npm run cf:deploy
```

Or connect your GitHub repository to Cloudflare Pages with these settings:
- Build command: `npx @cloudflare/next-on-pages`
- Build output directory: `.vercel/output/static`
- Environment variables: Add your Supabase URLs

## Usage

1. **Import Data**: Upload CREXI exports or leasing CSV files via the Imports page
2. **Review Leads**: View and manage leads in the Leads section
3. **Track Opportunities**: Use the pipeline board to track deal progress
4. **Monitor Properties**: Browse property inventory in the Properties section
5. **View Analytics**: Check dashboard for KPIs and performance metrics

## File Format Support

- **CREXI Leads Export**: CSV/XLSX with lead information and inquiries
- **CREXI Inventory Export**: CSV/XLSX with property listings and details  
- **Leasing Office CSV**: Custom CSV formats from internal leasing systems

The import system automatically detects file types and maps columns to the canonical data model.

## Architecture

- **Edge Runtime**: All API routes run on Cloudflare's edge for global performance
- **Row Level Security**: Supabase RLS ensures users only see authorized data
- **Normalized Schema**: Consistent data model across all import sources
- **Audit Trail**: Complete activity logging for compliance and debugging
