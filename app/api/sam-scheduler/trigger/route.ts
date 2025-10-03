import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (!['fetch', 'update', 'cleanup'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be fetch, update, or cleanup' },
        { status: 400 }
      );
    }

    // Get scheduler worker URL
    const schedulerUrl = process.env.SAM_SCHEDULER_URL || 'https://sam-gov-scheduler.rlpfedlease.workers.dev';

    // Trigger the scheduler worker
    const workerResponse = await fetch(`${schedulerUrl}?action=${action}`);

    if (!workerResponse.ok) {
      const error = await workerResponse.text();
      throw new Error(`Scheduler worker error: ${error}`);
    }

    const result = await workerResponse.json();
    
    return NextResponse.json({
      success: true,
      action,
      result,
      triggeredAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error triggering scheduler:', error);
    return NextResponse.json(
      { 
        error: 'Failed to trigger scheduler',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}