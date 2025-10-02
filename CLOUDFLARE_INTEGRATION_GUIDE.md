# Cloudflare Integration Guide for CRE Console

This guide provides comprehensive instructions for setting up Cloudflare services integration with your CRE Console project.

## Overview

The CRE Console integrates with the following Cloudflare services:

- **R2 Storage**: For storing RFP documents and property files
- **D1 Database**: For caching and metadata storage
- **Workers AI**: For document analysis and intelligent processing
- **Workers**: For background processing tasks
- **KV Storage**: For session management and caching

## Prerequisites

1. Cloudflare account with API access
2. Wrangler CLI installed (`npm install -g wrangler`)
3. Node.js 18+ and npm/yarn
4. Cloudflare API Token with appropriate permissions

### Required API Token Permissions

Create a custom API token with these permissions:
- **Account** - `Cloudflare Workers:Edit`
- **Account** - `Account Settings:Read`
- **Zone** - `Zone:Read` (if using custom domains)
- **Account** - `D1:Edit`
- **Account** - `R2:Edit`

## Quick Setup

### 1. Automated Setup (Recommended)

Run the automated deployment script:

```bash
# Make the script executable
chmod +x scripts/deploy-cloudflare.sh

# Run the deployment
./scripts/deploy-cloudflare.sh
```

This script will:
- Create all necessary R2 buckets
- Set up D1 databases with schema
- Create KV namespaces
- Deploy background workers
- Update configuration files
- Deploy the main application

### 2. Manual Setup

If you prefer manual setup, follow these steps:

#### Step 1: Create R2 Buckets

```bash
# RFP document uploads
wrangler r2 bucket create cre-console-rfp-uploads
wrangler r2 bucket create cre-console-rfp-uploads-preview

# Property documents
wrangler r2 bucket create cre-console-documents
wrangler r2 bucket create cre-console-documents-preview
```

#### Step 2: Create D1 Databases

```bash
# Main database
wrangler d1 create cre-console-main

# Cache database
wrangler d1 create cre-console-cache

# Apply schema to main database
wrangler d1 execute cre-console-main --file=./schema/d1-schema.sql --remote

# Apply cache schema
wrangler d1 execute cre-console-cache --command="
CREATE TABLE IF NOT EXISTS cache_entries (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);" --remote
```

#### Step 3: Create KV Namespaces

```bash
# Sessions
wrangler kv namespace create "SESSIONS"
wrangler kv namespace create "SESSIONS" --preview

# Cache
wrangler kv namespace create "CACHE"
wrangler kv namespace create "CACHE" --preview
```

#### Step 4: Update wrangler.toml

Update the `wrangler.toml` file with the actual database and namespace IDs:

```bash
# Get database IDs
wrangler d1 list

# Get KV namespace IDs
wrangler kv namespace list

# Update wrangler.toml with these IDs
```

#### Step 5: Deploy Background Worker

```bash
# Deploy the background processing worker
cd workers
wrangler deploy background-processor.ts
```

#### Step 6: Build and Deploy Application

```bash
# Install dependencies
npm install

# Build for Cloudflare Pages
npm run cf:build

# Deploy to Cloudflare Pages
npm run cf:deploy
```

## Configuration

### Environment Variables

Set these environment variables in your Cloudflare Pages settings:

```bash
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_ZONE_ID=your_zone_id_here  # Optional
```

### CORS Configuration

Configure CORS for your R2 buckets to allow access from your Next.js application:

1. Go to R2 Object Storage in your Cloudflare dashboard
2. Select each bucket (`cre-console-rfp-uploads`, `cre-console-documents`)
3. Navigate to Settings > CORS policy
4. Add this configuration:

```json
[
  {
    "AllowedOrigins": [
      "https://your-domain.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "Content-Type",
      "Authorization"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

## Usage

### File Uploads

#### RFP Document Upload

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('title', 'RFP Title');
formData.append('description', 'Description');
formData.append('userId', 'user123');
formData.append('tags', JSON.stringify(['tag1', 'tag2']));

const response = await fetch('/api/upload/rfp', {
  method: 'POST',
  body: formData
});

const result = await response.json();
```

#### Property Document Upload

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('propertyId', 'prop123');
formData.append('title', 'Document Title');
formData.append('documentType', 'lease');
formData.append('tags', JSON.stringify(['tag1', 'tag2']));

const response = await fetch('/api/upload/property', {
  method: 'POST',
  body: formData
});
```

### AI Document Analysis

```typescript
const response = await fetch('/api/ai/analyze-document', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    documentId: 'doc123',
    analysisType: 'summary' // or 'key_requirements', 'property_criteria'
  })
});

const analysis = await response.json();
```

### Using Helper Functions

#### D1 Database Operations

```typescript
import { getD1Helper } from '@/lib/cloudflare/d1-helpers';

// In your API route or worker
const d1Helper = getD1Helper(env);

// Create RFP document
await d1Helper.createRFPDocument({
  id: 'doc123',
  title: 'Office Space RFP',
  fileName: 'rfp.pdf',
  fileSize: 1024000,
  fileType: 'application/pdf',
  r2Key: 'rfp/doc123/rfp.pdf',
  userId: 'user123'
});

// Get analysis
const analysis = await d1Helper.getAnalysis('doc123', 'summary');
```

#### R2 Storage Operations

```typescript
import { getR2Helper } from '@/lib/cloudflare/r2-helpers';

// In your API route or worker
const r2Helper = getR2Helper(env);

// Upload file
const key = await r2Helper.uploadRFPDocument(
  'doc123',
  'document.pdf',
  arrayBuffer,
  {
    contentType: 'application/pdf',
    originalName: 'document.pdf',
    uploadedBy: 'user123'
  }
);

// Get file
const object = await r2Helper.getRFPDocument(key);
```

## Background Processing

The background worker automatically processes:

1. **Document Analysis**: Analyzes uploaded RFP documents using Workers AI
2. **Property Matching**: Matches RFPs to suitable properties
3. **Data Synchronization**: Updates caches and external data

### Processing Queue

Tasks are automatically added to the processing queue when:
- Documents are uploaded
- Analysis is requested
- Property matching is triggered

Monitor the queue in your D1 database:

```sql
SELECT * FROM processing_queue WHERE status = 'pending';
```

## Monitoring and Debugging

### D1 Database Queries

```bash
# Check uploaded documents
wrangler d1 execute cre-console-main --command="SELECT * FROM rfp_documents LIMIT 10;" --remote

# Check processing queue
wrangler d1 execute cre-console-main --command="SELECT * FROM processing_queue WHERE status = 'pending';" --remote

# Check AI usage
wrangler d1 execute cre-console-main --command="SELECT model_name, COUNT(*) as usage_count FROM ai_usage GROUP BY model_name;" --remote
```

### Worker Logs

```bash
# View background worker logs
wrangler tail cre-console-processor

# View specific log entries
wrangler tail cre-console-processor --format=pretty
```

### R2 Storage Stats

```bash
# List buckets
wrangler r2 bucket list

# List objects in bucket
wrangler r2 object list cre-console-rfp-uploads --limit=10
```

## Troubleshooting

### Common Issues

1. **"Bindings not available"**
   - Check that your wrangler.toml has correct database/bucket IDs
   - Verify environment variables are set in Cloudflare Pages

2. **"CORS errors in browser"**
   - Configure CORS for your R2 buckets
   - Ensure your domain is in the allowed origins

3. **"Workers AI quota exceeded"**
   - Monitor AI usage in the `ai_usage` table
   - Implement rate limiting in your application

4. **"Background worker not processing"**
   - Check worker logs with `wrangler tail`
   - Verify database bindings are correct
   - Check the processing queue for stuck tasks

### Performance Optimization

1. **Caching Strategy**
   - Use KV for frequently accessed small data
   - Use D1 cache table for larger datasets
   - Implement cache expiration

2. **File Storage**
   - Use appropriate file naming conventions
   - Implement file cleanup for expired documents
   - Monitor storage usage

3. **AI Usage**
   - Batch similar requests
   - Cache analysis results
   - Use appropriate models for different tasks

## Security Considerations

1. **API Tokens**
   - Use minimal required permissions
   - Rotate tokens regularly
   - Never commit tokens to version control

2. **File Uploads**
   - Validate file types and sizes
   - Scan for malicious content
   - Implement user quotas

3. **Data Access**
   - Implement proper authentication
   - Use user-based data isolation
   - Audit access logs

## Cost Management

1. **R2 Storage**
   - Monitor storage usage
   - Implement lifecycle policies
   - Clean up old files

2. **D1 Database**
   - Optimize queries
   - Use appropriate indexes
   - Monitor database size

3. **Workers AI**
   - Track usage per user/operation
   - Implement rate limiting
   - Cache results when possible

## Next Steps

1. Set up monitoring and alerting
2. Implement user authentication and authorization
3. Add file versioning and backup strategies
4. Scale workers based on demand
5. Optimize AI model usage
6. Add real-time notifications

## Support

For issues with this integration:

1. Check the Cloudflare dashboard for service status
2. Review worker logs and D1 query results
3. Verify configuration and environment variables
4. Test individual components in isolation

Your CRE Console is now fully integrated with Cloudflare's powerful edge computing platform! 🚀