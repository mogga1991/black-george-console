import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mcpConfig, validateConfig } from './config';

export class CloudflareMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  async initialize(): Promise<void> {
    if (!validateConfig(mcpConfig)) {
      throw new Error('Invalid Cloudflare MCP configuration. Please check your API token and account ID.');
    }

    try {
      // Initialize MCP client with Cloudflare server
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: ['@cloudflare/mcp-server'],
        env: {
          CLOUDFLARE_API_TOKEN: mcpConfig.apiToken,
          CLOUDFLARE_ACCOUNT_ID: mcpConfig.accountId,
          CLOUDFLARE_ZONE_ID: mcpConfig.zoneId || '',
        },
      });

      this.client = new Client(
        {
          name: 'cloudflare-mcp-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            resources: {},
            tools: {},
          },
        }
      );

      await this.client.connect(this.transport);
    } catch (error) {
      console.error('Failed to initialize Cloudflare MCP client:', error);
      throw error;
    }
  }

  async listWorkers(): Promise<any[]> {
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    try {
      const result = await this.client.request({
        method: 'tools/call',
        params: {
          name: 'list_workers',
          arguments: {},
        },
      });

      return result.content || [];
    } catch (error) {
      console.error('Failed to list workers:', error);
      throw error;
    }
  }

  async getWorkerDetails(workerName: string): Promise<any> {
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    try {
      const result = await this.client.request({
        method: 'tools/call',
        params: {
          name: 'get_worker',
          arguments: {
            scriptName: workerName,
          },
        },
      });

      return result.content;
    } catch (error) {
      console.error('Failed to get worker details:', error);
      throw error;
    }
  }

  async listKVNamespaces(): Promise<any[]> {
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    try {
      const result = await this.client.request({
        method: 'tools/call',
        params: {
          name: 'list_kv_namespaces',
          arguments: {},
        },
      });

      return result.content || [];
    } catch (error) {
      console.error('Failed to list KV namespaces:', error);
      throw error;
    }
  }

  async listR2Buckets(): Promise<any[]> {
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    try {
      const result = await this.client.request({
        method: 'tools/call',
        params: {
          name: 'list_r2_buckets',
          arguments: {},
        },
      });

      return result.content || [];
    } catch (error) {
      console.error('Failed to list R2 buckets:', error);
      throw error;
    }
  }

  async listD1Databases(): Promise<any[]> {
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    try {
      const result = await this.client.request({
        method: 'tools/call',
        params: {
          name: 'list_d1_databases',
          arguments: {},
        },
      });

      return result.content || [];
    } catch (error) {
      console.error('Failed to list D1 databases:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
    if (this.transport) {
      await this.transport.close();
    }
  }
}

// Singleton instance
let mcpClient: CloudflareMCPClient | null = null;

export const getMCPClient = (): CloudflareMCPClient => {
  if (!mcpClient) {
    mcpClient = new CloudflareMCPClient();
  }
  return mcpClient;
};

