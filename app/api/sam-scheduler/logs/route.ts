import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Get scheduler worker URL
    const schedulerUrl = process.env.SAM_SCHEDULER_URL;
    if (!schedulerUrl) {
      return NextResponse.json(
        { error: 'Scheduler worker URL not configured' },
        { status: 500 }
      );
    }

    // Fetch logs from scheduler worker
    const workerResponse = await fetch(`${schedulerUrl}?action=logs`);
    
    if (!workerResponse.ok) {
      return NextResponse.json([]);
    }

    const logs = await workerResponse.json();
    
    return NextResponse.json(logs);

  } catch (error) {
    console.error('Error getting scheduler logs:', error);
    return NextResponse.json([]);
  }
}