import { NextRequest, NextResponse } from 'next/server';
import { SAMGovApiResponse, SAMGovOpportunity, RFPOpportunity, RFPType, RFPStatus } from '@/lib/types/rfp-opportunities';

export const runtime = 'edge';

// SAM.gov API configuration
const SAM_API_BASE_URL = 'https://api.sam.gov/opportunities/v2/search';
const COMMERCIAL_REAL_ESTATE_NAICS = [
  '236220', // Commercial Building Construction
  '531120', // Lessors of Nonresidential Buildings
  '531210', // Offices of Real Estate Agents and Brokers
  '531311', // Residential Property Managers
  '531312', // Nonresidential Property Managers
  '531390', // Other Activities Related to Real Estate
  '238210', // Electrical Contractors and Other Wiring Installation
  '238220', // Plumbing, Heating, and Air-Conditioning Contractors
];

interface SAMGovParams {
  api_key: string;
  postedFrom: string; // YYYY-MM-DD format
  postedTo: string;   // YYYY-MM-DD format
  ncode?: string;     // NAICS code
  state?: string;     // State code
  limit?: number;     // Max 1000
  offset?: number;
  ptype?: string;     // Procurement type
}

function transformSAMGovToRFPOpportunity(samData: SAMGovOpportunity): RFPOpportunity {
  // Extract RFP type from SAM.gov type field
  let rfpType: RFPType = 'rfp';
  if (samData.type) {
    const typeStr = samData.type.toLowerCase();
    if (typeStr.includes('solicitation')) rfpType = 'rfp';
    else if (typeStr.includes('quote') || typeStr.includes('rfq')) rfpType = 'rfq';
    else if (typeStr.includes('invitation') || typeStr.includes('ifb')) rfpType = 'ifb';
    else if (typeStr.includes('sources sought')) rfpType = 'sources_sought';
    else if (typeStr.includes('presolicitation')) rfpType = 'presolicitation';
  }

  // Extract status
  let status: RFPStatus = 'open';
  if (samData.active === 'No') {
    status = samData.award ? 'awarded' : 'closed';
  }

  // Build coordinates from place of performance if available
  let coordinates: { lat: number; lng: number } | undefined;
  // Note: SAM.gov doesn't provide coordinates directly, would need geocoding

  // Extract contact information
  const primaryContact = samData.pointOfContact?.[0];
  const contactInfo = primaryContact ? {
    primaryContact: {
      name: primaryContact.fullName || 'Unknown',
      title: primaryContact.title || 'Contact',
      email: primaryContact.email || '',
      phone: primaryContact.phone || '',
    }
  } : undefined;

  // Extract location requirements from place of performance
  const locationRequirements = samData.placeOfPerformance ? {
    state: samData.placeOfPerformance.state?.code,
    city: samData.placeOfPerformance.city?.name,
    country: samData.placeOfPerformance.country?.code || 'USA',
  } : undefined;

  return {
    id: samData.opportunityId,
    solicitationNumber: samData.solicitationNumber,
    title: samData.title,
    description: '', // Would need to fetch from detailed API
    
    // Agency Information
    issuingAgency: samData.fullParentPathName || 'Unknown Agency',
    agencyCode: samData.fullParentPathCode,
    
    // Opportunity Details
    rfpType,
    status,
    setAsideType: samData.typeOfSetAside === 'none' ? 'none' : 'small_business', // Simplified mapping
    
    // Commercial Real Estate Specific
    naicsCodes: samData.naicsCode ? [samData.naicsCode] : [],
    locationRequirements,
    
    // Timeline
    postedDate: samData.postedDate ? new Date(samData.postedDate) : undefined,
    responseDueDate: samData.responseDeadLine ? new Date(samData.responseDeadLine) : undefined,
    
    // Location Data
    placeOfPerformanceState: samData.placeOfPerformance?.state?.code,
    placeOfPerformanceCity: samData.placeOfPerformance?.city?.name,
    placeOfPerformanceZip: samData.placeOfPerformance?.zip,
    placeOfPerformanceCountry: samData.placeOfPerformance?.country?.code || 'USA',
    coordinates,
    
    // Contact Information
    contactInfo,
    
    // Documents and Links
    samGovUrl: samData.uiLink,
    
    // AI Analysis Fields (to be filled by AI processing)
    commercialRealEstateScore: 50, // Default score, should be calculated by AI
    
    // Data Source and Processing
    source: 'sam.gov',
    sourceId: samData.opportunityId,
    extractionConfidence: 0.8, // Default confidence
    
    // System Fields
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
  };
}

async function fetchFromSAMGov(params: SAMGovParams): Promise<SAMGovApiResponse> {
  const url = new URL(SAM_API_BASE_URL);
  
  // Add required parameters
  url.searchParams.append('api_key', params.api_key);
  url.searchParams.append('postedFrom', params.postedFrom);
  url.searchParams.append('postedTo', params.postedTo);
  
  // Add optional parameters
  if (params.ncode) url.searchParams.append('ncode', params.ncode);
  if (params.state) url.searchParams.append('state', params.state);
  if (params.limit) url.searchParams.append('limit', params.limit.toString());
  if (params.offset) url.searchParams.append('offset', params.offset.toString());
  if (params.ptype) url.searchParams.append('ptype', params.ptype);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'CRE-Console/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`SAM.gov API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function calculateCREScore(opportunity: SAMGovOpportunity): number {
  let score = 0;
  
  // Check NAICS codes
  if (opportunity.naicsCode && COMMERCIAL_REAL_ESTATE_NAICS.includes(opportunity.naicsCode)) {
    score += 50;
  }
  
  // Check title and description for real estate keywords
  const title = (opportunity.title || '').toLowerCase();
  const keywords = ['lease', 'office', 'building', 'space', 'property', 'real estate', 'facility', 'premises'];
  const keywordMatches = keywords.filter(keyword => title.includes(keyword)).length;
  score += (keywordMatches / keywords.length) * 30;
  
  // Check for construction/renovation indicators
  const constructionKeywords = ['construction', 'renovation', 'build', 'design', 'architect'];
  const constructionMatches = constructionKeywords.filter(keyword => title.includes(keyword)).length;
  score += (constructionMatches / constructionKeywords.length) * 20;
  
  return Math.min(100, Math.max(0, score));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get API key from environment
    const apiKey = process.env.SAM_GOV_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SAM.gov API key not configured' },
        { status: 500 }
      );
    }

    // Parse query parameters
    const state = searchParams.get('state');
    const naicsCode = searchParams.get('naicsCode');
    const daysBack = parseInt(searchParams.get('daysBack') || '30');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const minCREScore = parseInt(searchParams.get('minCREScore') || '30');

    // Calculate date range
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const params: SAMGovParams = {
      api_key: apiKey,
      postedFrom: fromDate.toISOString().split('T')[0],
      postedTo: toDate.toISOString().split('T')[0],
      limit: Math.min(1000, limit),
      offset,
      ptype: 'o', // Solicitations only
    };

    if (state) params.state = state;
    if (naicsCode) params.ncode = naicsCode;

    // Fetch from SAM.gov
    console.log('Fetching from SAM.gov with params:', params);
    const samResponse = await fetchFromSAMGov(params);

    // Transform and filter opportunities
    const opportunities: RFPOpportunity[] = samResponse.opportunitiesData
      .map(samData => {
        const opportunity = transformSAMGovToRFPOpportunity(samData);
        // Calculate commercial real estate relevance score
        opportunity.commercialRealEstateScore = calculateCREScore(samData);
        return opportunity;
      })
      .filter(opp => (opp.commercialRealEstateScore || 0) >= minCREScore)
      .sort((a, b) => (b.commercialRealEstateScore || 0) - (a.commercialRealEstateScore || 0));

    return NextResponse.json({
      opportunities,
      totalCount: samResponse.page.totalElements,
      page: samResponse.page.number,
      totalPages: samResponse.page.totalPages,
      filteredCount: opportunities.length,
    });

  } catch (error) {
    console.error('Error fetching government opportunities:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch opportunities',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'refresh':
        // Trigger a refresh of opportunities from SAM.gov
        // This could be enhanced to update the database
        return NextResponse.json({ message: 'Refresh triggered' });
      
      case 'analyze':
        // Analyze an opportunity with AI for commercial real estate relevance
        const { opportunityId } = body;
        if (!opportunityId) {
          return NextResponse.json(
            { error: 'opportunityId required' },
            { status: 400 }
          );
        }
        
        // Here you would implement AI analysis
        // For now, return a placeholder
        return NextResponse.json({
          opportunityId,
          analysis: {
            commercialRealEstateScore: 75,
            summary: 'This opportunity appears to be for office space leasing with good commercial real estate potential.',
            highlights: ['Office space', 'Multi-year lease', 'Government tenant'],
            risks: ['Specific compliance requirements', 'Limited location flexibility']
          }
        });
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in POST /api/government-opportunities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}