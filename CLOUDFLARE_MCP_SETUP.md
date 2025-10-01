# Cloudflare MCP Setup Guide

This guide will help you set up Cloudflare MCP (Model Context Protocol) integration in your CRE Console application.

## Prerequisites

1. Cloudflare account with API access
2. Cloudflare API Token with appropriate permissions
3. Your Cloudflare Account ID

## Getting Your Cloudflare Credentials

### 1. Get Your Account ID
1. Log in to your Cloudflare dashboard
2. Select any domain from your overview page
3. In the right sidebar, you'll find your Account ID

### 2. Create an API Token
1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use "Custom token" template
4. Set the following permissions:
   - **Account** - `Cloudflare Workers:Edit`
   - **Account** - `Account Settings:Read`
   - **Zone** - `Zone:Read` (if you need zone-specific data)
5. Set Account Resources to "Include - All accounts" or your specific account
6. Set Zone Resources to "Include - All zones" (if using zone permissions)
7. Click "Continue to summary" and then "Create Token"
8. Copy the token (you won't be able to see it again)

### 3. Get Zone ID (Optional)
If you need zone-specific data:
1. Go to your domain's overview page
2. In the right sidebar, you'll find your Zone ID

## Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_ZONE_ID=your_zone_id_here  # Optional
```

## Features

The MCP integration provides:

### 1. Workers Management
- List all Cloudflare Workers
- Get detailed information about specific workers
- View worker configurations and metadata

### 2. KV Namespaces
- List all KV namespaces
- View namespace details and configurations

### 3. R2 Buckets
- List all R2 storage buckets
- View bucket configurations

### 4. D1 Databases
- List all D1 databases
- View database configurations

## Usage

### API Endpoints

- `GET /api/cloudflare?action=workers` - List all workers
- `GET /api/cloudflare?action=worker-details&workerName=NAME` - Get worker details
- `GET /api/cloudflare?action=kv` - List KV namespaces
- `GET /api/cloudflare?action=r2` - List R2 buckets
- `GET /api/cloudflare?action=d1` - List D1 databases

### React Hook

```typescript
import { useCloudflareMCP } from '@/lib/hooks/useCloudflareMCP';

function MyComponent() {
  const { workers, kvNamespaces, r2Buckets, d1Databases, loading, error, refresh } = useCloudflareMCP();
  
  // Use the data...
}
```

### Dashboard Component

```typescript
import { CloudflareDashboard } from '@/components/cloudflare-dashboard';

function CloudflarePage() {
  return <CloudflareDashboard />;
}
```

## Deployment

### Local Development
1. Set up your environment variables in `.env.local`
2. Run `npm run dev`
3. Visit `/cloudflare` to see the dashboard

### Cloudflare Pages Deployment
1. Set environment variables in your Cloudflare Pages dashboard:
   - Go to your Pages project
   - Navigate to Settings > Environment variables
   - Add the required variables for production/preview environments

2. Deploy using:
   ```bash
   npm run cf:build
   npm run cf:deploy
   ```

## Troubleshooting

### Common Issues

1. **"Invalid Cloudflare MCP configuration"**
   - Check that your API token and account ID are correctly set
   - Verify the API token has the required permissions

2. **"Failed to fetch Cloudflare data"**
   - Check your internet connection
   - Verify your API token is still valid
   - Check Cloudflare's status page for any service issues

3. **Empty results**
   - Verify you have resources in your Cloudflare account
   - Check that your API token has access to the resources you're trying to list

### Debug Mode

To enable debug logging, set `NODE_ENV=development` in your environment variables.

## Security Notes

- Never commit your API tokens to version control
- Use environment variables for all sensitive data
- Regularly rotate your API tokens
- Use the principle of least privilege when creating API tokens

## Next Steps

- Add more MCP tools for creating and managing resources
- Implement real-time updates using WebSockets
- Add resource-specific actions (deploy workers, manage KV data, etc.)
- Integrate with your existing CRE workflows

