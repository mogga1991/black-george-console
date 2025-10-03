import { NextRequest, NextResponse } from "next/server";
import { getMCPClient } from "@/lib/mcp/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const client = getMCPClient();
    await client.initialize();

    switch (action) {
      case "workers": {
        const data = await client.listWorkers();
        return NextResponse.json({ success: true, data });
      }
      case "worker-details": {
        const workerName = searchParams.get("workerName") || "";
        if (!workerName) {
          return NextResponse.json(
            { success: false, error: "Missing workerName" },
            { status: 400 }
          );
        }
        const data = await client.getWorkerDetails(workerName);
        return NextResponse.json({ success: true, data });
      }
      case "kv": {
        const data = await client.listKVNamespaces();
        return NextResponse.json({ success: true, data });
      }
      case "r2": {
        const data = await client.listR2Buckets();
        return NextResponse.json({ success: true, data });
      }
      case "d1": {
        const data = await client.listD1Databases();
        return NextResponse.json({ success: true, data });
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


