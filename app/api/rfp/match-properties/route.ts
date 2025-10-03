import { NextRequest, NextResponse } from 'next/server';
import { RFPExtractionResult, PropertyMatchingCriteria } from '@/lib/types/rfp-extraction';

export const runtime = 'edge';

// Type definitions for Cloudflare bindings
interface CloudflareEnv {
  AI: Ai;
  CRE_DB: D1Database;
}

// Property match result with scoring
interface PropertyMatch {
  propertyId: string;
  matchScore: number;
  matchBreakdown: {
    location: number;
    space: number;
    compliance: number;
    financial: number;
    timeline: number;
    total: number;
  };
  dealBreakers: string[];
  advantages: string[];
  warnings: string[];
  aiReasoning: string;
}

interface MatchRequest {
  rfpDocumentId: string;
  extractionId?: string;
  propertyFilters?: {
    maxResults?: number;
    minMatchScore?: number;
    requireCompliance?: boolean;
  };
}

// Get Cloudflare bindings from the runtime
function getCloudflareBindings(): CloudflareEnv {
  // @ts-ignore - Cloudflare bindings are available in the runtime
  return process.env as any;
}

export async function POST(request: NextRequest) {
  try {
    const { AI, CRE_DB } = getCloudflareBindings();
    
    if (!AI || !CRE_DB) {
      return NextResponse.json(
        { error: 'Cloudflare bindings not available' },
        { status: 500 }
      );
    }

    const { rfpDocumentId, extractionId, propertyFilters }: MatchRequest = await request.json();

    if (!rfpDocumentId) {
      return NextResponse.json(
        { error: 'RFP document ID is required' },
        { status: 400 }
      );
    }

    // Get RFP extraction data
    let extractionData;
    if (extractionId) {
      extractionData = await CRE_DB.prepare(`
        SELECT * FROM rfp_extractions WHERE id = ?
      `).bind(extractionId).first();
    } else {
      // Get the latest extraction for this document
      extractionData = await CRE_DB.prepare(`
        SELECT * FROM rfp_extractions 
        WHERE rfp_document_id = ? 
        ORDER BY extraction_date DESC 
        LIMIT 1
      `).bind(rfpDocumentId).first();
    }

    if (!extractionData) {
      return NextResponse.json(
        { error: 'No extraction data found for this RFP' },
        { status: 404 }
      );
    }

    // Build search criteria from extraction data
    const searchCriteria = buildSearchCriteria(extractionData);
    
    // Get properties from Supabase (you'll need to implement this connection)
    // For now, we'll simulate with a basic query structure
    const candidateProperties = await findCandidateProperties(CRE_DB, searchCriteria);
    
    // Score and rank each property
    const matches: PropertyMatch[] = [];
    
    for (const property of candidateProperties) {
      const match = await scorePropertyMatch(AI, extractionData, property);
      
      // Apply filters
      if (propertyFilters?.minMatchScore && match.matchScore < propertyFilters.minMatchScore) {
        continue;
      }
      
      if (propertyFilters?.requireCompliance && match.dealBreakers.length > 0) {
        continue;
      }
      
      matches.push(match);
    }

    // Sort by match score (highest first)
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Limit results
    const maxResults = propertyFilters?.maxResults || 50;
    const finalMatches = matches.slice(0, maxResults);

    // Save matches to database
    for (const match of finalMatches) {
      await CRE_DB.prepare(`
        INSERT OR REPLACE INTO rfp_property_matches (
          id, rfp_document_id, property_id, match_score, 
          match_criteria, ai_reasoning, created_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'ai', 'suggested')
      `).bind(
        `${rfpDocumentId}-${match.propertyId}`,
        rfpDocumentId,
        match.propertyId,
        match.matchScore,
        JSON.stringify(match.matchBreakdown),
        match.aiReasoning
      ).run();
    }

    return NextResponse.json({
      success: true,
      data: {
        rfpDocumentId,
        extractionId: extractionData.id,
        totalCandidates: candidateProperties.length,
        totalMatches: finalMatches.length,
        matches: finalMatches,
        searchCriteria: searchCriteria
      }
    });

  } catch (error) {
    console.error('Property matching error:', error);
    return NextResponse.json(
      { error: 'Failed to match properties' },
      { status: 500 }
    );
  }
}

// Build search criteria from RFP extraction data
function buildSearchCriteria(extractionData: any): PropertyMatchingCriteria {
  const locationCriteria = extractionData.location_criteria ? 
    JSON.parse(extractionData.location_criteria) : {};
  
  return {
    required: {
      location: {
        state: extractionData.location_criteria?.state,
        city: extractionData.location_criteria?.city,
        zipCodes: locationCriteria.zipCodes || [],
        delineatedAreas: locationCriteria.delineatedAreas || [],
        proximityRequirements: locationCriteria.proximityRequirements || [],
        geographicRestrictions: locationCriteria.geographicRestrictions || [],
        preferredLocations: locationCriteria.preferredLocations || []
      },
      space: {
        minSquareFeet: extractionData.min_square_feet,
        maxSquareFeet: extractionData.max_square_feet,
        preferredSquareFeet: extractionData.preferred_square_feet,
        measurementType: extractionData.measurement_type || 'RSF',
        spaceType: extractionData.space_type || 'office',
        floors: extractionData.floors,
        ceilingHeight: extractionData.ceiling_height,
        specialSpaceNeeds: [],
        layoutRequirements: []
      },
      parking: {
        reservedGovernmentSpaces: extractionData.reserved_government_spaces,
        reservedVisitorSpaces: extractionData.reserved_visitor_spaces,
        reservedCustomerSpaces: extractionData.reserved_customer_spaces,
        nonReservedEmployeeSpaces: extractionData.non_reserved_employee_spaces,
        totalParkingSpaces: extractionData.total_parking_spaces,
        onSiteRequired: extractionData.on_site_required,
        proximityToBuilding: null,
        adaCompliantSpaces: null,
        parkingType: null
      },
      compliance: JSON.parse(extractionData.compliance_requirements_json || '{}')
    },
    preferred: {
      financial: {
        budgetRange: {
          min: extractionData.budget_min,
          max: extractionData.budget_max,
          currency: extractionData.budget_currency || 'USD',
          period: extractionData.budget_period || 'monthly'
        },
        pricePerSquareFoot: {
          min: extractionData.price_per_sqft_min,
          max: extractionData.price_per_sqft_max,
          currency: extractionData.budget_currency || 'USD',
          period: 'monthly'
        },
        operatingExpenses: null,
        utilities: null,
        securityDeposit: null
      },
      timeline: {
        expressionOfInterestDue: extractionData.expression_of_interest_due ? 
          new Date(extractionData.expression_of_interest_due) : undefined,
        marketSurveyDate: extractionData.market_survey_date ? 
          new Date(extractionData.market_survey_date) : undefined,
        proposalDueDate: extractionData.proposal_due_date ? 
          new Date(extractionData.proposal_due_date) : undefined,
        awardDate: extractionData.award_date ? 
          new Date(extractionData.award_date) : undefined,
        occupancyDate: extractionData.occupancy_date ? 
          new Date(extractionData.occupancy_date) : undefined,
        moveInDate: extractionData.move_in_date ? 
          new Date(extractionData.move_in_date) : undefined,
        keyMilestones: []
      },
      additionalFeatures: JSON.parse(extractionData.key_phrases || '[]')
    },
    dealBreakers: JSON.parse(extractionData.warnings || '[]'),
    scoring: {
      locationWeight: 0.3,
      spaceWeight: 0.25,
      complianceWeight: 0.2,
      financialWeight: 0.15,
      timelineWeight: 0.1
    }
  };
}

// Find candidate properties (simplified - you'd query your actual property database)
async function findCandidateProperties(db: D1Database, criteria: PropertyMatchingCriteria): Promise<any[]> {
  // This is a simplified version - you'd implement actual property search
  // For now, we'll return mock data structure
  
  // In real implementation, you'd:
  // 1. Query Supabase for properties matching basic criteria
  // 2. Filter by location (state, city, zip codes)
  // 3. Filter by size range
  // 4. Filter by space type
  // 5. Return candidate properties for scoring
  
  return [
    {
      id: 'prop-1',
      title: 'Example Office Building',
      address: '123 Main St, St Cloud, FL 34769',
      squareFeet: 4300,
      spaceType: 'office',
      monthlyRent: 12000,
      parking: { total: 25, reserved: 10 },
      compliance: { ada: true, fireCode: true, floodZone: false }
    },
    // Add more mock properties...
  ];
}

// Score a property against RFP criteria using AI
async function scorePropertyMatch(ai: Ai, extractionData: any, property: any): Promise<PropertyMatch> {
  const prompt = `Analyze how well this property matches the RFP requirements and provide a detailed scoring:

RFP REQUIREMENTS:
- Space: ${extractionData.min_square_feet || 'N/A'} - ${extractionData.max_square_feet || 'N/A'} sq ft
- Location: ${extractionData.location_criteria || 'N/A'}
- Budget: $${extractionData.budget_min || 'N/A'} - $${extractionData.budget_max || 'N/A'} ${extractionData.budget_period || 'monthly'}
- Parking: ${extractionData.total_parking_spaces || 'N/A'} total spaces
- Lease Term: ${extractionData.full_term_months || 'N/A'} months
- Compliance: ${extractionData.compliance_requirements_json || 'Standard requirements'}

PROPERTY DETAILS:
${JSON.stringify(property, null, 2)}

Provide response as JSON:
{
  "matchScore": 0-100,
  "locationScore": 0-100,
  "spaceScore": 0-100,
  "complianceScore": 0-100,
  "financialScore": 0-100,
  "timelineScore": 0-100,
  "dealBreakers": ["list any deal-breaking issues"],
  "advantages": ["list key advantages"],
  "warnings": ["list potential concerns"],
  "reasoning": "detailed explanation of scoring"
}`;

  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a commercial real estate expert. Analyze property matches objectively and provide accurate scoring.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1024
    });

    const aiResult = JSON.parse(response.response || '{}');
    
    return {
      propertyId: property.id,
      matchScore: aiResult.matchScore || 0,
      matchBreakdown: {
        location: aiResult.locationScore || 0,
        space: aiResult.spaceScore || 0,
        compliance: aiResult.complianceScore || 0,
        financial: aiResult.financialScore || 0,
        timeline: aiResult.timelineScore || 0,
        total: aiResult.matchScore || 0
      },
      dealBreakers: aiResult.dealBreakers || [],
      advantages: aiResult.advantages || [],
      warnings: aiResult.warnings || [],
      aiReasoning: aiResult.reasoning || 'AI analysis completed'
    };
    
  } catch (error) {
    console.error('AI scoring error:', error);
    // Return default low score if AI fails
    return {
      propertyId: property.id,
      matchScore: 0,
      matchBreakdown: { location: 0, space: 0, compliance: 0, financial: 0, timeline: 0, total: 0 },
      dealBreakers: ['AI analysis failed'],
      advantages: [],
      warnings: ['Could not complete AI analysis'],
      aiReasoning: 'AI analysis failed'
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { CRE_DB } = getCloudflareBindings();
    
    if (!CRE_DB) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rfpDocumentId = searchParams.get('rfpDocumentId');
    const minScore = parseFloat(searchParams.get('minScore') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!rfpDocumentId) {
      return NextResponse.json(
        { error: 'RFP document ID is required' },
        { status: 400 }
      );
    }

    // Get existing matches
    const matches = await CRE_DB.prepare(`
      SELECT * FROM rfp_property_matches 
      WHERE rfp_document_id = ? AND match_score >= ?
      ORDER BY match_score DESC
      LIMIT ?
    `).bind(rfpDocumentId, minScore, limit).all();

    return NextResponse.json({
      success: true,
      data: matches.results
    });

  } catch (error) {
    console.error('Fetch matches error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}