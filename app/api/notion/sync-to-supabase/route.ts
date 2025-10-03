import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface NotionRFPData {
  id: string;
  title: string;
  solicitationNumber: string;
  issuingAgency: string;
  status: string;
  rfpType: string;
  naicsCodes: string[];
  placeOfPerformanceState?: string;
  placeOfPerformanceCity?: string;
  responseDueDate?: string;
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  samGovUrl?: string;
  description?: string;
  commercialRealEstateScore?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notionData, syncType = 'incremental' } = body;

    console.log('Starting Notion to Supabase sync...', {
      recordCount: notionData?.length || 0,
      syncType
    });

    if (!notionData || !Array.isArray(notionData)) {
      return NextResponse.json(
        { error: 'Invalid notion data provided' },
        { status: 400 }
      );
    }

    // Transform Notion data to Supabase schema
    const supabaseRecords = notionData.map((record: NotionRFPData) => ({
      // Use Notion ID as our ID, or generate new UUID if not provided
      id: record.id || crypto.randomUUID(),
      solicitation_number: record.solicitationNumber,
      title: record.title,
      description: record.description || null,
      
      // Agency Information
      issuing_agency: record.issuingAgency,
      
      // Opportunity Details
      rfp_type: mapRFPType(record.rfpType),
      status: mapRFPStatus(record.status),
      set_aside_type: 'none', // Default value
      
      // Commercial Real Estate Specific
      naics_codes: record.naicsCodes,
      commercial_real_estate_score: record.commercialRealEstateScore || 50,
      
      // Financial Information
      estimated_value_min: record.estimatedValueMin,
      estimated_value_max: record.estimatedValueMax,
      
      // Timeline
      response_due_date: record.responseDueDate ? new Date(record.responseDueDate).toISOString() : null,
      
      // Location Data
      place_of_performance_state: record.placeOfPerformanceState,
      place_of_performance_city: record.placeOfPerformanceCity,
      place_of_performance_country: 'USA',
      
      // Documents and Links
      sam_gov_url: record.samGovUrl,
      
      // Data Source and Processing
      source: 'notion',
      source_id: record.id,
      extraction_confidence: 0.9, // High confidence for manually entered data
      
      // System Fields
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    }));

    let result;
    
    if (syncType === 'full') {
      // Full sync: Replace all Notion-sourced records
      console.log('Performing full sync...');
      
      // First, delete existing Notion records
      const { error: deleteError } = await supabase
        .from('rfp_opportunities')
        .delete()
        .eq('source', 'notion');
      
      if (deleteError) {
        throw new Error(`Failed to delete existing records: ${deleteError.message}`);
      }
      
      // Then insert new records
      const { data, error: insertError } = await supabase
        .from('rfp_opportunities')
        .insert(supabaseRecords)
        .select();
      
      if (insertError) {
        throw new Error(`Failed to insert records: ${insertError.message}`);
      }
      
      result = { inserted: data?.length || 0, updated: 0, deleted: supabaseRecords.length };
      
    } else {
      // Incremental sync: Upsert records
      console.log('Performing incremental sync...');
      
      const { data, error } = await supabase
        .from('rfp_opportunities')
        .upsert(supabaseRecords, {
          onConflict: 'solicitation_number',
          ignoreDuplicates: false
        })
        .select();
      
      if (error) {
        throw new Error(`Failed to upsert records: ${error.message}`);
      }
      
      result = { upserted: data?.length || 0 };
    }

    // Update sync metadata
    await recordSyncMetadata({
      source: 'notion',
      syncType,
      recordCount: supabaseRecords.length,
      result,
    });

    console.log('Sync completed successfully:', result);

    return NextResponse.json({
      success: true,
      message: 'Notion data synced to Supabase successfully',
      recordsProcessed: supabaseRecords.length,
      result,
      syncType,
    });

  } catch (error) {
    console.error('Notion to Supabase sync error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync Notion data to Supabase',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'notion';
    
    // Get sync status and recent records
    const { data: recentRecords, error: recordsError } = await supabase
      .from('rfp_opportunities')
      .select('id, title, issuing_agency, status, created_at, updated_at')
      .eq('source', source)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recordsError) {
      throw new Error(`Failed to fetch records: ${recordsError.message}`);
    }
    
    // Get total count
    const { count, error: countError } = await supabase
      .from('rfp_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('source', source);
    
    if (countError) {
      throw new Error(`Failed to count records: ${countError.message}`);
    }
    
    return NextResponse.json({
      source,
      totalRecords: count || 0,
      recentRecords: recentRecords || [],
      lastSync: recentRecords?.[0]?.updated_at || null,
    });
    
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch sync status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper functions
function mapRFPType(notionType: string): string {
  const type = (notionType || '').toLowerCase();
  if (type.includes('rfq') || type.includes('quote')) return 'rfq';
  if (type.includes('ifb') || type.includes('invitation')) return 'ifb';
  if (type.includes('sources') || type.includes('sought')) return 'sources_sought';
  if (type.includes('pre')) return 'presolicitation';
  return 'rfp'; // default
}

function mapRFPStatus(notionStatus: string): string {
  const status = (notionStatus || '').toLowerCase();
  if (status.includes('closed') || status.includes('ended')) return 'closed';
  if (status.includes('award')) return 'awarded';
  if (status.includes('cancel')) return 'cancelled';
  if (status.includes('draft')) return 'draft';
  return 'open'; // default
}

async function recordSyncMetadata(metadata: {
  source: string;
  syncType: string;
  recordCount: number;
  result: any;
}) {
  // This could be stored in a separate sync_logs table
  // For now, we'll just log it
  console.log('Sync metadata:', {
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}