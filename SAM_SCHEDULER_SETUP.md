# SAM.gov Automated Scheduler Setup

## 🎯 Overview

This system automatically:
- **Fetches new opportunities** from SAM.gov every morning (6 AM EST)
- **Updates opportunity status** every afternoon (2 PM EST) 
- **Cleans up expired opportunities** every night (11 PM EST)
- **Manages API rate limits** to stay within quota
- **Provides admin dashboard** for monitoring and manual control

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cloudflare    │    │    Supabase      │    │   Admin Web     │
│   Cron Worker   │───▶│    Database      │◀───│   Dashboard     │
│                 │    │                  │    │                 │
│ • Daily Fetch   │    │ • Opportunities  │    │ • Monitor       │
│ • Status Update │    │ • Sync Logs      │    │ • Manual Trigger│
│ • Cleanup       │    │ • Quota Tracking │    │ • View Stats    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                                               
         ▼                                               
┌─────────────────┐                                      
│    SAM.gov      │                                      
│    API          │                                      
│ • 1000 req/day  │                                      
│ • CRE filtered  │                                      
└─────────────────┘                                      
```

## 🚀 Deployment Steps

### 1. Create Cloudflare KV Namespace

```bash
# Create KV namespace for quota tracking
npx wrangler kv:namespace create "SAM_QUOTA_KV"
npx wrangler kv:namespace create "SAM_QUOTA_KV" --preview
```

Copy the KV namespace IDs to `wrangler-scheduler.toml`.

### 2. Deploy the Scheduler Worker

```bash
# Navigate to your project
cd /Users/georgemogga/Desktop/黑男孩应用/cre-console

# Deploy the scheduler worker
npx wrangler deploy --config wrangler-scheduler.toml

# Set up secrets
npx wrangler secret put SAM_GOV_API_KEY --config wrangler-scheduler.toml
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL --config wrangler-scheduler.toml
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler-scheduler.toml
```

### 3. Configure Environment Variables

Add to your main app's environment (Cloudflare Pages):

```bash
# Scheduler worker URL (get from Cloudflare dashboard)
SAM_SCHEDULER_URL=https://sam-gov-scheduler.your-subdomain.workers.dev
```

### 4. Set Up Database Schema

Run this SQL in your Supabase dashboard to add scheduler tracking:

```sql
-- Add scheduler tracking columns if not exists
ALTER TABLE rfp_opportunities 
ADD COLUMN IF NOT EXISTS last_status_check timestamptz,
ADD COLUMN IF NOT EXISTS award_date timestamptz;

-- Create index for status checking
CREATE INDEX IF NOT EXISTS idx_rfp_last_status_check 
ON rfp_opportunities (last_status_check, status);
```

### 5. Deploy Updated Main App

```bash
# Build and deploy with scheduler integration
npm run cf:build
npm run cf:deploy
```

## 📊 Admin Dashboard

Access the scheduler admin dashboard at:
`https://your-domain.pages.dev/admin/sam-scheduler`

### Features:
- **Real-time status** monitoring
- **API quota** usage tracking  
- **Sync statistics** and breakdowns
- **Manual triggers** for testing
- **Error logs** and debugging
- **Schedule overview** with next run times

## ⚙️ Configuration Options

### Rate Limiting
- **Free tier**: 1,000 requests/day
- **Registered users**: 10,000 requests/day
- **Smart batching**: Fetches high-priority NAICS codes first
- **Quota protection**: Stops at 80% usage

### NAICS Code Priority
The scheduler fetches in this order:
1. `236220` - Commercial Building Construction
2. `531120` - Nonresidential Building Lessors  
3. `531210` - Real Estate Agents/Brokers
4. `531311` - Residential Property Managers
5. `531312` - Nonresidential Property Managers
6. `238210` - Electrical Contractors
7. `238220` - HVAC Contractors

### Commercial Real Estate Scoring
Automatic scoring (0-100) based on:
- **NAICS codes** (40-50 points)
- **Keywords** in title/description (25 points)
- **Set-aside status** (10 points)
- **Government contracting** indicators (15 points)

## 🔧 Scheduled Jobs

### Daily Fetch (6 AM EST)
```javascript
// Fetches opportunities posted in last 24 hours
// Filters by commercial real estate NAICS codes
// Calculates CRE relevance score
// Stores in Supabase with deduplication
```

### Status Updates (2 PM EST)  
```javascript
// Checks opportunities not updated in 24+ hours
// Updates status: open → closed/awarded
// Records award dates when available
// Limits to 50 opportunities per run
```

### Cleanup (11 PM EST)
```javascript
// Removes awarded opportunities older than 30 days
// Removes closed opportunities older than 7 days  
// Removes overdue opportunities (30+ days past deadline)
// Cleans up old sync logs (30+ days)
```

## 📈 Monitoring & Alerts

### Health Checks
- **API quota usage** monitoring
- **Sync failure** detection
- **Database connection** health
- **Worker performance** metrics

### Error Handling
- **Automatic retries** with exponential backoff
- **Quota exceeded** protection
- **Network failure** resilience
- **Detailed error logging**

### Performance Metrics
- **Sync duration** tracking
- **Records processed** counts
- **API calls used** monitoring
- **Success/failure** rates

## 🎛️ Manual Operations

### Trigger Manual Sync
```bash
# Via admin dashboard or direct API
curl -X POST "https://your-domain.pages.dev/api/sam-scheduler/trigger" \
  -H "Content-Type: application/json" \
  -d '{"action": "fetch"}'
```

### Check Scheduler Status
```bash
curl "https://your-domain.pages.dev/api/sam-scheduler/status"
```

### View Sync Logs
```bash
curl "https://your-domain.pages.dev/api/sam-scheduler/logs"
```

## 🔒 Security Considerations

- **API keys** stored as Cloudflare secrets
- **Rate limiting** to prevent abuse
- **Error masking** in logs to protect sensitive data
- **Admin dashboard** protected by authentication
- **Worker isolation** with Cloudflare security

## 📝 Maintenance

### Daily Tasks
- Monitor quota usage via dashboard
- Check sync success rates
- Review error logs for issues

### Weekly Tasks  
- Analyze opportunity trends
- Adjust NAICS code priorities
- Review cleanup effectiveness

### Monthly Tasks
- Optimize CRE scoring algorithm
- Update keyword lists
- Review and adjust rate limits

## 🎯 Expected Results

With this automated system:
- **500-1000 new opportunities** per day (filtered for CRE relevance)
- **95%+ automation** of opportunity management
- **Real-time status updates** on government contracting
- **Zero manual intervention** required for daily operations
- **Comprehensive monitoring** and alerting

Your RFP database will automatically stay fresh and relevant! 🎉