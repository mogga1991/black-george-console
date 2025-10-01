export interface CloudflareMCPConfig {
  apiToken: string;
  accountId: string;
  zoneId?: string;
}

export const mcpConfig: CloudflareMCPConfig = {
  apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
};

export const validateConfig = (config: CloudflareMCPConfig): boolean => {
  return !!(config.apiToken && config.accountId);
};

