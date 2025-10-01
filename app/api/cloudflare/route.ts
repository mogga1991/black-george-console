import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const workerName = searchParams.get('workerName');

    // For edge runtime, we'll use direct Cloudflare API calls instead of MCP
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!apiToken || !accountId) {
      return NextResponse.json({ error: 'Cloudflare credentials not configured' }, { status: 500 });
    }

    let result;
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;

    switch (action) {
      case 'workers':
        const workersResponse = await fetch(`${baseUrl}/workers/scripts`, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        });
        const workersData = await workersResponse.json();
        result = workersData.result || [];
        break;
      case 'worker-details':
        if (!workerName) {
          return NextResponse.json({ error: 'Worker name is required' }, { status: 400 });
        }
        const workerResponse = await fetch(`${baseUrl}/workers/scripts/${workerName}`, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        });
        const workerData = await workerResponse.json();
        result = workerData.result;
        break;
      case 'kv':
        const kvResponse = await fetch(`${baseUrl}/storage/kv/namespaces`, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        });
        const kvData = await kvResponse.json();
        result = kvData.result || [];
        break;
      case 'r2':
        const r2Response = await fetch(`${baseUrl}/r2/buckets`, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        });
        const r2Data = await r2Response.json();
        result = r2Data.result || [];
        break;
      case 'd1':
        const d1Response = await fetch(`${baseUrl}/d1/database`, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        });
        const d1Data = await d1Response.json();
        result = d1Data.result || [];
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Cloudflare API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Cloudflare data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!apiToken || !accountId) {
      return NextResponse.json({ error: 'Cloudflare credentials not configured' }, { status: 500 });
    }

    let result;
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;

    switch (action) {
      case 'create-kv-namespace':
        const createKvResponse = await fetch(`${baseUrl}/storage/kv/namespaces`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: params.title || 'George KV Namespace',
          }),
        });
        const createKvData = await createKvResponse.json();
        result = createKvData.result;
        break;
      case 'create-r2-bucket':
        const createR2Response = await fetch(`${baseUrl}/r2/buckets`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: params.name || 'george-bucket',
          }),
        });
        const createR2Data = await createR2Response.json();
        result = createR2Data.result;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Cloudflare API error:', error);
    return NextResponse.json(
      { error: 'Failed to perform Cloudflare operation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

