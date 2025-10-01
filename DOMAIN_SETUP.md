# Domain Setup Guide for ब्लैक जॉर्ज (george-console)

## Overview
This guide will help you connect your domain `georgemogga.com` to your Cloudflare Pages project "george-console".

## Prerequisites
- Cloudflare account with API access
- Access to your domain registrar (where you bought georgemogga.com)
- The application is built and ready for deployment

## Step 1: Get Your Cloudflare Credentials

1. **Get your API Token:**
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token" 
   - Use "Edit Cloudflare Workers" template or "Custom token"
   - Grant permissions: Zone:Zone:Read, Zone:DNS:Edit, Account:Cloudflare Pages:Edit
   - Copy the generated token

2. **Get your Account ID:**
   - Go to https://dash.cloudflare.com/
   - Select any domain or go to the right sidebar
   - Copy the "Account ID" from the right sidebar

3. **Get your Zone ID (if domain is already in Cloudflare):**
   - Go to your domain overview in Cloudflare dashboard
   - Copy the "Zone ID" from the right sidebar

## Step 2: Update Environment Variables

Update the `.env.local` file with your real Cloudflare credentials:

```bash
# Cloudflare Configuration - UPDATE WITH YOUR REAL VALUES
CLOUDFLARE_API_TOKEN=your_actual_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_actual_account_id_here
CLOUDFLARE_ZONE_ID=your_actual_zone_id_here
```

## Step 3: Add Domain to Cloudflare (if not already added)

If georgemogga.com is not yet in your Cloudflare account:

```bash
# Add the domain to Cloudflare
curl -X POST "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "georgemogga.com",
    "account": {
      "id": "YOUR_ACCOUNT_ID"
    }
  }'
```

**Note the Zone ID from the response and update your .env.local file.**

## Step 4: Update Domain Nameservers

Update your domain registrar settings to use Cloudflare nameservers:
- `ava.ns.cloudflare.com`
- `brad.ns.cloudflare.com`

(These will be provided when you add the domain to Cloudflare)

## Step 5: Deploy to Cloudflare Pages

```bash
# Build and deploy
npm run cf:build
npm run cf:deploy
```

## Step 6: Add Custom Domain to Pages Project

```bash
# Add the custom domain
npx wrangler pages domain add georgemogga.com --project-name george-console

# Add www subdomain
npx wrangler pages domain add www.georgemogga.com --project-name george-console
```

## Step 7: Configure DNS Records

Set up CNAME records pointing to your Pages deployment:

```bash
# Add CNAME for root domain
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/dns_records" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "georgemogga.com",
    "content": "george-console.pages.dev",
    "ttl": 1
  }'

# Add CNAME for www subdomain  
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/dns_records" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME", 
    "name": "www",
    "content": "george-console.pages.dev",
    "ttl": 1
  }'
```

## Step 8: Verify Setup

```bash
# Check domain status
npx wrangler pages domain list --project-name george-console

# Check DNS propagation
dig georgemogga.com
dig www.georgemogga.com
```

## Step 9: Enable HTTPS (Automatic)

Cloudflare will automatically provision SSL certificates for your domain. This may take 15-30 minutes.

## Troubleshooting

### Common Issues:

1. **Authentication Error**: Verify your API token has the correct permissions
2. **Domain Not Found**: Ensure the domain is added to your Cloudflare account
3. **DNS Not Propagating**: Wait 24-48 hours for full DNS propagation
4. **SSL Issues**: SSL certificates can take up to 30 minutes to provision

### Verification Commands:

```bash
# Check if domain is in Cloudflare
curl -X GET "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Check Pages project status
npx wrangler pages project list

# Check domain association
npx wrangler pages domain list --project-name george-console
```

## Current Application Features

✅ **Authentication**: Real Supabase authentication (fallback to localStorage)
✅ **UI**: Clean login page matching your design requirements  
✅ **Branding**: "ब्लैक जॉर्ज" branding throughout
✅ **Protection**: Route protection with redirects to login
✅ **Navigation**: Header with user info and sign-out

## Next Steps After Domain Setup

1. Test the live site at https://georgemogga.com
2. Set up production environment variables
3. Configure any additional Cloudflare security settings
4. Set up monitoring and analytics

## Support

If you encounter issues:
1. Check the Cloudflare dashboard for any errors
2. Verify DNS settings are correct
3. Ensure API tokens have sufficient permissions
4. Contact Cloudflare support if needed

---

**Project Status**: Ready for domain connection and deployment
**Deployment URL**: https://george-console.pages.dev (after first deployment)
**Target Domain**: https://georgemogga.com