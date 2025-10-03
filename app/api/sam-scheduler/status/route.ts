import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Get scheduler status from worker
    const schedulerUrl = process.env.SAM_SCHEDULER_URL || 'https://sam-gov-scheduler.rlpfedlease.workers.dev';

    // Fetch status from scheduler worker
    const workerResponse = await fetch(`${schedulerUrl}?action=status`);
    let workerStatus = {};
    
    if (workerResponse.ok) {
      workerStatus = await workerResponse.json();
    }

    // Get database stats from Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        ...workerStatus,
        stats: {
          totalOpportunities: 0,
          recentOpportunities: 0,
          statusBreakdown: {},
          sourceBreakdown: {}
        }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get opportunity statistics
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Total count
    const { count: totalCount } = await supabase
      .from('rfp_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);

    // Recent count
    const { count: recentCount } = await supabase
      .from('rfp_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .gte('created_at', sevenDaysAgo.toISOString());

    // Status breakdown
    const { data: statusData } = await supabase
      .from('rfp_opportunities')
      .select('status')
      .eq('active', true)
      .gte('created_at', sevenDaysAgo.toISOString());

    const statusBreakdown = statusData?.reduce((acc: any, row: any) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Source breakdown
    const { data: sourceData } = await supabase
      .from('rfp_opportunities')
      .select('original_source')
      .eq('active', true)
      .gte('created_at', sevenDaysAgo.toISOString());

    const sourceBreakdown = sourceData?.reduce((acc: any, row: any) => {
      acc[row.original_source] = (acc[row.original_source] || 0) + 1;
      return acc;
    }, {}) || {};

    const stats = {
      totalOpportunities: totalCount || 0,
      recentOpportunities: recentCount || 0,
      statusBreakdown,
      sourceBreakdown
    };

    return NextResponse.json({
      ...workerStatus,
      stats
    });

  } catch (error) {
    console.error('Error getting scheduler status:', error);
    return NextResponse.json(
      { error: 'Failed to get scheduler status' },
      { status: 500 }
    );
  }
}