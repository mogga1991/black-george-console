import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const { action = 'sync' } = await request.json();
    
    if (action === 'sync') {
      const result = await syncOpportunitiesFromNotion();
      return NextResponse.json(result);
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('Supabase sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync opportunities' },
      { status: 500 }
    );
  }
}

async function syncOpportunitiesFromNotion() {
  // Initialize Notion client
  const notionApiToken = process.env.NOTION_API_TOKEN;
  const notionDatabaseId = process.env.NOTION_OPPORTUNITIES_DATABASE_ID;
  
  if (!notionApiToken || !notionDatabaseId) {
    throw new Error('Notion API credentials not configured');
  }

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch opportunities from Notion
  const notionOpportunities = await fetchNotionOpportunities(notionApiToken, notionDatabaseId);
  
  // Transform and insert into Supabase
  const supabaseResults = [];
  const errors = [];

  for (const notionOpp of notionOpportunities) {
    try {
      const supabaseRecord = transformNotionToSupabase(notionOpp);
      
      // Use upsert to handle duplicates
      const { data, error } = await supabase
        .from('rfp_opportunities')
        .upsert(supabaseRecord, { 
          onConflict: 'solicitation_number',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error('Supabase upsert error:', error);
        errors.push({ notionId: notionOpp.id, error: error.message });
      } else {
        supabaseResults.push(data[0]);
      }
    } catch (error) {
      console.error('Transform error:', error);
      errors.push({ notionId: notionOpp.id, error: error instanceof Error ? error.message : 'Transform failed' });
    }
  }

  return {
    success: true,
    synced: supabaseResults.length,
    errors: errors.length,
    total: notionOpportunities.length,
    details: {
      supabaseRecords: supabaseResults.length,
      errorDetails: errors
    }
  };
}

async function fetchNotionOpportunities(apiToken: string, databaseId: string) {
  const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      page_size: 100,
      sorts: [
        {
          property: 'Uploaded At',
          direction: 'descending'
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch from Notion: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.results.map((page: any) => parseNotionOpportunity(page));
}

function parseNotionOpportunity(page: any) {
  const props = page.properties;
  
  return {
    id: page.id,
    title: getPropertyValue(props['Title']),
    solicitationNumber: getPropertyValue(props['Solicitation Number']),
    description: getPropertyValue(props['Description']),
    agency: getPropertyValue(props['Agency']),
    type: getPropertyValue(props['Type']),
    status: getPropertyValue(props['Status']),
    state: getPropertyValue(props['State']),
    city: getPropertyValue(props['City']),
    zipCode: getPropertyValue(props['ZIP Code']),
    minValue: getPropertyValue(props['Min Value']),
    maxValue: getPropertyValue(props['Max Value']),
    postedDate: getPropertyValue(props['Posted Date']),
    dueDate: getPropertyValue(props['Due Date']),
    minSquareFeet: getPropertyValue(props['Min Square Feet']),
    maxSquareFeet: getPropertyValue(props['Max Square Feet']),
    propertyType: getPropertyValue(props['Property Type']),
    latitude: getPropertyValue(props['Latitude']),
    longitude: getPropertyValue(props['Longitude']),
    naicsCode: getPropertyValue(props['NAICS Code']),
    setAside: getPropertyValue(props['Set Aside']),
    source: getPropertyValue(props['Source']),
    uploadedAt: getPropertyValue(props['Uploaded At']),
    lastModified: page.last_edited_time
  };
}

function getPropertyValue(property: any): any {
  if (!property) return null;

  switch (property.type) {
    case 'title':
      return property.title[0]?.plain_text || '';
    case 'rich_text':
      return property.rich_text[0]?.plain_text || '';
    case 'number':
      return property.number;
    case 'select':
      return property.select?.name || '';
    case 'checkbox':
      return property.checkbox;
    case 'date':
      return property.date?.start || '';
    case 'email':
      return property.email || '';
    case 'phone_number':
      return property.phone_number || '';
    default:
      return null;
  }
}

function transformNotionToSupabase(notionOpp: any) {
  // Calculate CRE score based on available data
  const creScore = calculateCREScore(notionOpp);
  
  return {
    id: `notion-${notionOpp.id}`,
    solicitation_number: notionOpp.solicitationNumber || `NOTION-${notionOpp.id.slice(-8)}`,
    title: notionOpp.title || 'Untitled Opportunity',
    description: notionOpp.description || '',
    synopsis: notionOpp.description || '',
    
    // Agency information
    issuing_agency: notionOpp.agency || 'Unknown Agency',
    agency_code: null,
    sub_agency: null,
    office_address: null,
    
    // Opportunity details
    rfp_type: mapRFPType(notionOpp.type),
    status: mapStatus(notionOpp.status),
    procurement_method: null,
    set_aside_type: mapSetAsideType(notionOpp.setAside),
    
    // CRE specific
    naics_codes: notionOpp.naicsCode ? [notionOpp.naicsCode] : ['531120'],
    property_type: notionOpp.propertyType,
    space_requirements: {
      minSquareFeet: notionOpp.minSquareFeet,
      maxSquareFeet: notionOpp.maxSquareFeet,
      propertyType: notionOpp.propertyType
    },
    location_requirements: {
      state: notionOpp.state,
      city: notionOpp.city,
      zipCodes: notionOpp.zipCode ? [notionOpp.zipCode] : []
    },
    
    // Financial
    estimated_value_min: notionOpp.minValue,
    estimated_value_max: notionOpp.maxValue,
    budget_range: notionOpp.minValue || notionOpp.maxValue ? {
      min: notionOpp.minValue,
      max: notionOpp.maxValue,
      currency: 'USD'
    } : null,
    
    // Timeline
    posted_date: notionOpp.postedDate ? new Date(notionOpp.postedDate).toISOString() : null,
    response_due_date: notionOpp.dueDate ? new Date(notionOpp.dueDate).toISOString() : null,
    questions_due_date: null,
    proposal_due_date: notionOpp.dueDate ? new Date(notionOpp.dueDate).toISOString() : null,
    estimated_award_date: null,
    performance_start_date: null,
    performance_end_date: null,
    
    // Location data
    place_of_performance_state: notionOpp.state,
    place_of_performance_city: notionOpp.city,
    place_of_performance_zip: notionOpp.zipCode,
    place_of_performance_country: 'USA',
    coordinates: (notionOpp.latitude && notionOpp.longitude) ? {
      lat: notionOpp.latitude,
      lng: notionOpp.longitude
    } : null,
    
    // Contact info
    contact_info: null,
    
    // Documents and links
    sam_gov_url: null,
    documents: [],
    
    // Compliance
    compliance_requirements: null,
    special_requirements: [],
    
    // AI analysis
    ai_summary: null,
    commercial_real_estate_score: creScore,
    key_highlights: [],
    risk_factors: [],
    
    // Data source
    source: notionOpp.source || 'notion_import',
    source_id: notionOpp.id,
    last_updated_at_source: notionOpp.lastModified,
    extraction_confidence: 0.8,
    
    // System fields
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
    tags: ['excel_upload', 'notion_import']
  };
}

function mapRFPType(value: string): string {
  if (!value) return 'rfp';
  const lower = value.toLowerCase();
  if (lower.includes('rfq')) return 'rfq';
  if (lower.includes('ifb')) return 'ifb';
  if (lower.includes('sources')) return 'sources_sought';
  if (lower.includes('presol')) return 'presolicitation';
  return 'rfp';
}

function mapStatus(value: string): string {
  if (!value) return 'open';
  const lower = value.toLowerCase();
  if (lower.includes('closed')) return 'closed';
  if (lower.includes('award')) return 'awarded';
  if (lower.includes('cancel')) return 'cancelled';
  if (lower.includes('draft')) return 'draft';
  return 'open';
}

function mapSetAsideType(value: string): string {
  if (!value) return 'none';
  const lower = value.toLowerCase();
  if (lower.includes('small')) return 'small_business';
  if (lower.includes('8a')) return '8a';
  if (lower.includes('hub')) return 'hubzone';
  if (lower.includes('wosb')) return 'wosb';
  if (lower.includes('vosb')) return 'vosb';
  if (lower.includes('sdvosb')) return 'sdvosb';
  return 'none';
}

function calculateCREScore(opportunity: any): number {
  let score = 0;
  
  // Base score for having data
  if (opportunity.title) score += 20;
  if (opportunity.description) score += 15;
  if (opportunity.state) score += 10;
  
  // Text analysis
  const text = (opportunity.title + ' ' + opportunity.description + ' ' + opportunity.propertyType).toLowerCase();
  
  // High-value CRE keywords
  const creKeywords = ['office', 'warehouse', 'retail', 'building', 'space', 'lease', 'rent', 'property', 'facility'];
  const foundKeywords = creKeywords.filter(keyword => text.includes(keyword));
  score += foundKeywords.length * 6;
  
  // Space measurements
  if (opportunity.minSquareFeet || opportunity.maxSquareFeet) score += 20;
  
  // Financial info
  if (opportunity.minValue || opportunity.maxValue) score += 10;
  
  // Location coordinates
  if (opportunity.latitude && opportunity.longitude) score += 5;
  
  // NAICS relevance
  if (opportunity.naicsCode && ['531', '236', '238'].some(code => opportunity.naicsCode.includes(code))) {
    score += 15;
  }
  
  return Math.min(score, 100);
}