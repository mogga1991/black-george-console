#!/bin/bash

# Cloudflare Setup and Deployment Script for CRE Console
# This script sets up all Cloudflare services and deploys the application

set -e

echo "🚀 Starting Cloudflare deployment for CRE Console..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Check if user is logged in to Cloudflare
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "Please log in to Cloudflare:"
    wrangler auth login
fi

# Function to create R2 buckets
create_r2_buckets() {
    echo "📦 Creating R2 buckets..."
    
    # Create RFP uploads bucket
    echo "Creating RFP uploads bucket..."
    wrangler r2 bucket create cre-console-rfp-uploads --local false || echo "Bucket might already exist"
    wrangler r2 bucket create cre-console-rfp-uploads-preview --local false || echo "Preview bucket might already exist"
    
    # Create general documents bucket
    echo "Creating documents bucket..."
    wrangler r2 bucket create cre-console-documents --local false || echo "Bucket might already exist"
    wrangler r2 bucket create cre-console-documents-preview --local false || echo "Preview bucket might already exist"
    
    echo "✅ R2 buckets created/verified"
}

# Function to create D1 databases
create_d1_databases() {
    echo "🗄️ Creating D1 databases..."
    
    # Create main database
    echo "Creating main CRE database..."
    wrangler d1 create cre-console-main || echo "Database might already exist"
    
    # Create cache database
    echo "Creating cache database..."
    wrangler d1 create cre-console-cache || echo "Database might already exist"
    
    # Get database IDs
    echo "Getting database IDs..."
    MAIN_DB_ID=$(wrangler d1 list | grep "cre-console-main" | awk '{print $1}' || echo "")
    CACHE_DB_ID=$(wrangler d1 list | grep "cre-console-cache" | awk '{print $1}' || echo "")
    
    if [ -n "$MAIN_DB_ID" ]; then
        echo "Main DB ID: $MAIN_DB_ID"
        # Execute schema for main database
        echo "Executing schema for main database..."
        wrangler d1 execute cre-console-main --file=./schema/d1-schema.sql --remote
    fi
    
    if [ -n "$CACHE_DB_ID" ]; then
        echo "Cache DB ID: $CACHE_DB_ID"
        # Create cache schema
        wrangler d1 execute cre-console-cache --command="
        CREATE TABLE IF NOT EXISTS cache_entries (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);" --remote
    fi
    
    echo "✅ D1 databases created and schema applied"
}

# Function to create KV namespaces
create_kv_namespaces() {
    echo "🔑 Creating KV namespaces..."
    
    # Create sessions namespace
    echo "Creating sessions KV namespace..."
    wrangler kv namespace create "SESSIONS" || echo "Namespace might already exist"
    wrangler kv namespace create "SESSIONS" --preview || echo "Preview namespace might already exist"
    
    # Create cache namespace
    echo "Creating cache KV namespace..."
    wrangler kv namespace create "CACHE" || echo "Namespace might already exist"
    wrangler kv namespace create "CACHE" --preview || echo "Preview namespace might already exist"
    
    echo "✅ KV namespaces created"
}

# Function to deploy background worker
deploy_background_worker() {
    echo "⚙️ Deploying background processing worker..."
    
    # Create worker subdirectory if it doesn't exist
    mkdir -p workers-dist
    
    # Copy worker file
    cp workers/background-processor.ts workers-dist/
    
    # Create worker wrangler.toml
    cat > workers-dist/wrangler.toml << EOF
name = "cre-console-processor"
main = "background-processor.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

# Schedule to run every minute
[triggers]
crons = ["* * * * *"]

# Bindings (you'll need to update these with actual IDs)
[[r2_buckets]]
binding = "RFP_UPLOADS"
bucket_name = "cre-console-rfp-uploads"

[[r2_buckets]]
binding = "CRE_DOCUMENTS"
bucket_name = "cre-console-documents"

[[d1_databases]]
binding = "CRE_DB"
database_name = "cre-console-main"
database_id = "${MAIN_DB_ID}"

[[d1_databases]]
binding = "CACHE_DB"
database_name = "cre-console-cache"
database_id = "${CACHE_DB_ID}"

[ai]
binding = "AI"
EOF
    
    # Deploy worker
    cd workers-dist
    wrangler deploy
    cd ..
    
    echo "✅ Background worker deployed"
}

# Function to setup CORS for R2 buckets
setup_cors() {
    echo "🌐 Setting up CORS for R2 buckets..."
    
    # Note: CORS configuration for R2 is typically done via API or dashboard
    # This is a placeholder for documentation
    echo "Please configure CORS for your R2 buckets in the Cloudflare dashboard:"
    echo "1. Go to R2 Object Storage in your Cloudflare dashboard"
    echo "2. Select each bucket (cre-console-rfp-uploads, cre-console-documents)"
    echo "3. Configure CORS with the following settings:"
    echo "   - Allowed Origins: https://your-domain.com, http://localhost:3000"
    echo "   - Allowed Methods: GET, POST, PUT, DELETE, HEAD"
    echo "   - Allowed Headers: Content-Type, Authorization"
    echo "   - Max Age: 3600"
}

# Function to build and deploy the main application
deploy_application() {
    echo "🏗️ Building and deploying main application..."
    
    # Install dependencies
    echo "Installing dependencies..."
    npm install
    
    # Build the application
    echo "Building Next.js application..."
    npm run build
    
    # Build for Cloudflare Pages
    echo "Building for Cloudflare Pages..."
    npm run cf:build
    
    # Deploy to Cloudflare Pages
    echo "Deploying to Cloudflare Pages..."
    npm run cf:deploy
    
    echo "✅ Application deployed"
}

# Function to update wrangler.toml with actual IDs
update_wrangler_config() {
    echo "📝 Updating wrangler.toml with actual resource IDs..."
    
    # Get KV namespace IDs
    SESSIONS_KV_ID=$(wrangler kv namespace list | grep "SESSIONS" | grep -v "preview" | awk '{print $1}' || echo "")
    SESSIONS_KV_PREVIEW_ID=$(wrangler kv namespace list | grep "SESSIONS" | grep "preview" | awk '{print $1}' || echo "")
    CACHE_KV_ID=$(wrangler kv namespace list | grep "CACHE" | grep -v "preview" | awk '{print $1}' || echo "")
    CACHE_KV_PREVIEW_ID=$(wrangler kv namespace list | grep "CACHE" | grep "preview" | awk '{print $1}' || echo "")
    
    # Update wrangler.toml with actual IDs
    if [ -n "$MAIN_DB_ID" ]; then
        sed -i.bak "s/your-d1-database-id/$MAIN_DB_ID/g" wrangler.toml
    fi
    
    if [ -n "$CACHE_DB_ID" ]; then
        sed -i.bak "s/your-cache-database-id/$CACHE_DB_ID/g" wrangler.toml
    fi
    
    if [ -n "$SESSIONS_KV_ID" ]; then
        sed -i.bak "s/your-kv-namespace-id/$SESSIONS_KV_ID/g" wrangler.toml
    fi
    
    if [ -n "$SESSIONS_KV_PREVIEW_ID" ]; then
        sed -i.bak "s/your-kv-preview-namespace-id/$SESSIONS_KV_PREVIEW_ID/g" wrangler.toml
    fi
    
    if [ -n "$CACHE_KV_ID" ]; then
        sed -i.bak "s/your-cache-kv-namespace-id/$CACHE_KV_ID/g" wrangler.toml
    fi
    
    if [ -n "$CACHE_KV_PREVIEW_ID" ]; then
        sed -i.bak "s/your-cache-kv-preview-namespace-id/$CACHE_KV_PREVIEW_ID/g" wrangler.toml
    fi
    
    # Clean up backup file
    rm -f wrangler.toml.bak
    
    echo "✅ Wrangler configuration updated"
}

# Function to display environment variables needed
display_env_vars() {
    echo "🔧 Environment Variables Needed:"
    echo "Please add these to your Cloudflare Pages environment variables:"
    echo ""
    echo "CLOUDFLARE_API_TOKEN=your_api_token"
    echo "CLOUDFLARE_ACCOUNT_ID=your_account_id"
    echo "CLOUDFLARE_ZONE_ID=your_zone_id (optional)"
    echo ""
    echo "You can set these in:"
    echo "1. Cloudflare Pages dashboard > Settings > Environment variables"
    echo "2. Local .env.local file for development"
}

# Main execution
main() {
    echo "Starting comprehensive Cloudflare setup..."
    
    # Create all resources
    create_r2_buckets
    create_d1_databases
    create_kv_namespaces
    
    # Update configuration with actual IDs
    update_wrangler_config
    
    # Deploy workers
    deploy_background_worker
    
    # Setup CORS
    setup_cors
    
    # Deploy main application
    deploy_application
    
    # Display final information
    display_env_vars
    
    echo ""
    echo "🎉 Cloudflare deployment completed!"
    echo ""
    echo "Next steps:"
    echo "1. Configure environment variables in Cloudflare Pages"
    echo "2. Set up CORS for R2 buckets in the dashboard"
    echo "3. Test the application at your Cloudflare Pages URL"
    echo "4. Monitor the background worker in the Workers dashboard"
    echo ""
    echo "Your CRE Console is now fully integrated with Cloudflare! 🚀"
}

# Run main function
main "$@"