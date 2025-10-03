import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const state = searchParams.get('state');
    const naicsCode = searchParams.get('naicsCode');
    const daysBack = parseInt(searchParams.get('daysBack') || '30');
    const minCREScore = parseInt(searchParams.get('minCREScore') || '0');
    const source = searchParams.get('source'); // 'government', 'excel_upload', 'all'
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Build query
    let query = supabase
      .from('rfp_opportunities')
      .select('*')
      .eq('is_active', true)
      .gte('commercial_real_estate_score', minCREScore)
      .order('created_at', { ascending: false });
    
    // Apply filters
    if (state) {
      query = query.eq('place_of_performance_state', state);
    }
    
    if (naicsCode) {
      query = query.contains('naics_codes', [naicsCode]);
    }
    
    if (source && source !== 'all') {
      query = query.eq('source', source);
    }
    
    // Date filter - opportunities from the last N days
    if (daysBack > 0) {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - daysBack);
      query = query.gte('created_at', dateThreshold.toISOString());
    }
    
    const { data, error } = await query.limit(100);
    
    if (error) {
      console.error('Supabase query error:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    // Transform to frontend format
    const opportunities = data.map(transformSupabaseToRFPOpportunity);
    
    return NextResponse.json({
      opportunities,
      total: opportunities.length,
      filters: {
        state,
        naicsCode,
        daysBack,
        minCREScore,
        source
      }
    });
    
  } catch (error) {
    console.error('Opportunities API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch opportunities' },
      { status: 500 }
    );
  }
}

function transformSupabaseToRFPOpportunity(record: any) {
  return {
    id: record.id,
    solicitationNumber: record.solicitation_number,
    title: record.title,
    description: record.description,
    synopsis: record.synopsis,
    
    // Agency information
    issuingAgency: record.issuing_agency,
    agencyCode: record.agency_code,
    subAgency: record.sub_agency,
    officeAddress: record.office_address,
    
    // Opportunity details
    rfpType: record.rfp_type,
    status: record.status,
    procurementMethod: record.procurement_method,
    setAsideType: record.set_aside_type,
    
    // CRE specific
    naicsCodes: record.naics_codes || [],
    propertyType: record.property_type,
    spaceRequirements: record.space_requirements,
    locationRequirements: record.location_requirements,
    
    // Financial
    estimatedValueMin: record.estimated_value_min,
    estimatedValueMax: record.estimated_value_max,
    budgetRange: record.budget_range,
    
    // Timeline
    postedDate: record.posted_date ? new Date(record.posted_date) : undefined,
    responseDueDate: record.response_due_date ? new Date(record.response_due_date) : undefined,
    questionsDueDate: record.questions_due_date ? new Date(record.questions_due_date) : undefined,
    proposalDueDate: record.proposal_due_date ? new Date(record.proposal_due_date) : undefined,
    estimatedAwardDate: record.estimated_award_date ? new Date(record.estimated_award_date) : undefined,
    performanceStartDate: record.performance_start_date ? new Date(record.performance_start_date) : undefined,
    performanceEndDate: record.performance_end_date ? new Date(record.performance_end_date) : undefined,
    
    // Location
    placeOfPerformanceState: record.place_of_performance_state,
    placeOfPerformanceCity: record.place_of_performance_city,
    placeOfPerformanceZip: record.place_of_performance_zip,
    placeOfPerformanceCountry: record.place_of_performance_country,
    coordinates: record.coordinates,
    
    // Contact info
    contactInfo: record.contact_info,
    
    // Documents
    samGovUrl: record.sam_gov_url,
    documents: record.documents || [],
    
    // Compliance
    complianceRequirements: record.compliance_requirements,
    specialRequirements: record.special_requirements || [],
    
    // AI analysis
    aiSummary: record.ai_summary,
    commercialRealEstateScore: record.commercial_real_estate_score,
    keyHighlights: record.key_highlights || [],
    riskFactors: record.risk_factors || [],
    
    // Data source
    source: record.source,
    sourceId: record.source_id,
    lastUpdatedAtSource: record.last_updated_at_source ? new Date(record.last_updated_at_source) : undefined,
    extractionConfidence: record.extraction_confidence,
    
    // System fields
    createdAt: new Date(record.created_at),
    updatedAt: new Date(record.updated_at),
    isActive: record.is_active,
    tags: record.tags || []
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, opportunityId } = body;
    
    if (action === 'analyze' && opportunityId) {
      // Generate AI analysis for specific opportunity
      return await generateAIAnalysis(opportunityId);
    }
    
    if (action === 'sync') {
      // Trigger sync from Notion to Supabase
      const syncResponse = await fetch(`${request.nextUrl.origin}/api/supabase/sync-opportunities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' })
      });
      
      if (!syncResponse.ok) {
        throw new Error('Failed to sync opportunities');
      }
      
      return NextResponse.json(await syncResponse.json());
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('Opportunities POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Operation failed' },
      { status: 500 }
    );
  }
}

async function generateAIAnalysis(opportunityId: string) {
  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get opportunity details
    const { data: opportunity, error } = await supabase
      .from('rfp_opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single();
    
    if (error) {
      throw new Error(`Failed to fetch opportunity: ${error.message}`);
    }
    
    // Generate AI summary using the AI chat API
    const analysisPrompt = `
    Analyze this commercial real estate opportunity and provide a brief summary:
    
    Title: ${opportunity.title}
    Description: ${opportunity.description}
    Agency: ${opportunity.issuing_agency}
    Location: ${opportunity.place_of_performance_city}, ${opportunity.place_of_performance_state}
    Space Requirements: ${JSON.stringify(opportunity.space_requirements)}
    Value: $${opportunity.estimated_value_min} - $${opportunity.estimated_value_max}
    
    Provide a 2-3 sentence summary focusing on:
    1. Key space/property requirements
    2. Location and timing
    3. Main opportunity highlights
    `;
    
    const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: analysisPrompt }]
      })
    });
    
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const summary = aiData.response || 'AI analysis unavailable';
      
      // Update opportunity with AI summary
      await supabase
        .from('rfp_opportunities')
        .update({ ai_summary: summary })
        .eq('id', opportunityId);
      
      return NextResponse.json({
        analysis: { summary },
        opportunityId
      });
    }
    
    return NextResponse.json({
      analysis: { summary: 'AI analysis unavailable at this time' },
      opportunityId
    });
    
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI analysis' },
      { status: 500 }
    );
  }
}