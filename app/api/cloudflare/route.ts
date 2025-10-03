import { NextRequest, NextResponse } from "next/server";

export const runtime = 'edge';

// Direct Cloudflare API calls without MCP client
async function callCloudflareAPI(endpoint: string, method: string = 'GET') {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    throw new Error('Cloudflare credentials not configured');
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Cloudflare API error: ${response.status}`);
  }

  return response.json();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "workers": {
        const data = await callCloudflareAPI(`/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers`);
        return NextResponse.json({ success: true, data: data.result || [] });
      }
      case "worker-details": {
        const workerName = searchParams.get("workerName") || "";
        if (!workerName) {
          return NextResponse.json(
            { success: false, error: "Missing workerName" },
            { status: 400 }
          );
        }
        const data = await callCloudflareAPI(`/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers/${workerName}`);
        return NextResponse.json({ success: true, data: data.result });
      }
      case "kv": {
        const data = await callCloudflareAPI(`/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`);
        return NextResponse.json({ success: true, data: data.result || [] });
      }
      case "r2": {
        const data = await callCloudflareAPI(`/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets`);
        return NextResponse.json({ success: true, data: data.result || [] });
      }
      case "d1": {
        const data = await callCloudflareAPI(`/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database`);
        return NextResponse.json({ success: true, data: data.result || [] });
      }
      default: {
        return NextResponse.json(
          { success: false, error: "Invalid or missing action" },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}


