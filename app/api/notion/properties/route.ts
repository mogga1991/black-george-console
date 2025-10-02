import { NextRequest, NextResponse } from 'next/server';
import { getNotionClient, NotionQueryFilters } from '@/lib/notion/client';
import { PropertyMatcher } from '@/lib/notion/matching';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const filters: NotionQueryFilters = {};
    
    if (searchParams.get('buildingTypes')) {
      filters.buildingTypes = searchParams.get('buildingTypes')!.split(',');
    }
    
    if (searchParams.get('minSquareFootage')) {
      filters.minSquareFootage = parseInt(searchParams.get('minSquareFootage')!);
    }
    
    if (searchParams.get('maxSquareFootage')) {
      filters.maxSquareFootage = parseInt(searchParams.get('maxSquareFootage')!);
    }
    
    if (searchParams.get('maxRatePerSF')) {
      filters.maxRatePerSF = parseFloat(searchParams.get('maxRatePerSF')!);
    }
    
    if (searchParams.get('cities')) {
      filters.cities = searchParams.get('cities')!.split(',');
    }
    
    if (searchParams.get('states')) {
      filters.states = searchParams.get('states')!.split(',');
    }
    
    if (searchParams.get('gsaApproved')) {
      filters.gsaApproved = searchParams.get('gsaApproved') === 'true';
    }
    
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status')!.split(',');
    }

    // Get Notion client and query properties
    const notionClient = getNotionClient();
    const properties = await notionClient.queryProperties(filters);

    // If search query is provided, filter results
    const searchQuery = searchParams.get('search');
    let results = properties;
    
    if (searchQuery) {
      results = await notionClient.searchProperties(searchQuery);
    }

    return NextResponse.json({
      properties: results,
      count: results.length,
      filters: filters
    });

  } catch (error) {
    console.error('Properties API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch properties',
        details: error instanceof Error ? error.message : 'Unknown error',
        properties: [],
        count: 0
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requirements, includeAll = false } = body;

    if (!requirements) {
      return NextResponse.json(
        { error: 'Requirements are required for property matching' },
        { status: 400 }
      );
    }

    // Get all properties or apply basic filters
    const notionClient = getNotionClient();
    const filters: NotionQueryFilters = {
      status: ['Available'] // Only show available properties
    };

    // Add basic filters from requirements
    if (requirements.location?.cities) {
      filters.cities = requirements.location.cities;
    }
    
    if (requirements.location?.states) {
      filters.states = requirements.location.states;
    }
    
    if (requirements.space?.minSquareFootage) {
      filters.minSquareFootage = requirements.space.minSquareFootage;
    }
    
    if (requirements.space?.maxSquareFootage) {
      filters.maxSquareFootage = requirements.space.maxSquareFootage;
    }
    
    if (requirements.leaseTerms?.maxBudgetPerSF) {
      filters.maxRatePerSF = requirements.leaseTerms.maxBudgetPerSF;
    }
    
    if (requirements.compliance?.gsaRequired) {
      filters.gsaApproved = true;
    }

    const properties = await notionClient.queryProperties(filters);

    // Match properties against requirements
    const matches = PropertyMatcher.matchProperties(properties, requirements);

    // Return all matches or just good+ matches
    const filteredMatches = includeAll ? matches : matches.filter(m => m.score >= 70);

    return NextResponse.json({
      matches: filteredMatches,
      totalProperties: properties.length,
      matchCount: filteredMatches.length,
      requirements: requirements,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Property matching error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to match properties',
        details: error instanceof Error ? error.message : 'Unknown error',
        matches: [],
        totalProperties: 0,
        matchCount: 0
      },
      { status: 500 }
    );
  }
}