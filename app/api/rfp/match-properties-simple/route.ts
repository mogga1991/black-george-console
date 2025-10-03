import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const { criteria, filters } = await request.json();
    
    if (!criteria) {
      return NextResponse.json(
        { error: "RFP criteria required" },
        { status: 400 }
      );
    }

    // Transform RFP criteria to our matching format
    const requirements = {
      locationCriteria: {
        state: extractStateFromLocation(criteria.locationText),
        city: extractCityFromLocation(criteria.locationText),
        center: criteria.center,
        radiusKm: criteria.radiusKm || 25
      },
      spaceRequirements: {
        minSquareFeet: criteria.minSqft,
        maxSquareFeet: criteria.maxSqft,
        preferredSquareFeet: Math.round((criteria.minSqft + criteria.maxSqft) / 2),
        spaceType: 'office' // Default, could be extracted from criteria
      },
      buildingTypePreferences: criteria.buildingTypes || ['Office'],
      tenancyPreference: criteria.tenancyType,
      maxRatePerSqft: criteria.maxRatePerSqft,
      mustHaves: criteria.mustHaves || [],
      niceToHaves: criteria.niceToHaves || []
    };

    // Fetch matching properties using HTTP request to avoid import issues
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/cre_properties`, {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch properties');
    }

    const allProperties = await response.json();
    
    // Apply matching logic
    const matches = findMatchingProperties(allProperties, requirements, filters?.minScore || 30);

    // Calculate summary statistics
    const summary = {
      totalMatches: matches.length,
      excellent: matches.filter(m => m.matchLevel === 'excellent').length,
      good: matches.filter(m => m.matchLevel === 'good').length,
      fair: matches.filter(m => m.matchLevel === 'fair').length,
      averageScore: matches.length > 0 
        ? Math.round(matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length)
        : 0,
      searchRadius: requirements.locationCriteria.radiusKm,
      matchCriteria: {
        location: criteria.locationText,
        sizeRange: `${criteria.minSqft?.toLocaleString() || 'Any'} - ${criteria.maxSqft?.toLocaleString() || 'Any'} sq ft`,
        buildingTypes: requirements.buildingTypePreferences.join(', '),
        maxRate: criteria.maxRatePerSqft ? `$${criteria.maxRatePerSqft}/sq ft` : 'No limit'
      }
    };

    // Transform matches for API response
    const apiMatches = matches.map(match => ({
      id: match.property.id,
      address: match.property.address,
      city: match.property.city,
      state: match.property.state,
      zipCode: match.property.zip_code,
      buildingTypes: match.property.building_types,
      squareFootage: match.property.square_footage,
      squareFootageMin: match.property.square_footage_min,
      squareFootageMax: match.property.square_footage_max,
      rateText: match.property.rate_text,
      ratePerSqft: match.property.rate_per_sqft,
      coordinates: match.property.latitude && match.property.longitude 
        ? { lat: match.property.latitude, lng: match.property.longitude }
        : null,
      matchScore: match.matchScore,
      matchLevel: match.matchLevel,
      matchColor: match.matchColor,
      matchReasons: match.matchReasons,
      failureReasons: match.failureReasons,
      detailedScores: {
        location: match.locationScore,
        size: match.sizeScore,
        type: match.typeScore,
        financial: match.proximityScore // Using as financial score
      }
    }));

    return NextResponse.json({
      matches: apiMatches,
      summary,
      extractionMethod: "Real property matching",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Property matching error:", error);
    return NextResponse.json(
      { error: "Failed to match properties" },
      { status: 500 }
    );
  }
}

// Property matching logic (copied from lib/property-matching.ts for edge compatibility)
function findMatchingProperties(properties: any[], requirements: any, minScore: number) {
  return properties
    .map(property => calculatePropertyMatch(property, requirements))
    .filter(match => match.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore);
}

function calculatePropertyMatch(property: any, requirements: any) {
  const locationScore = scoreLocation(property, requirements);
  const sizeScore = scoreSize(property, requirements);
  const typeScore = scoreType(property, requirements);
  const financialScore = scoreFinancial(property, requirements);
  
  const overallScore = (
    locationScore * 0.4 +
    sizeScore * 0.3 +
    typeScore * 0.2 +
    financialScore * 0.1
  );
  
  let matchLevel: string;
  let matchColor: string;
  
  if (overallScore >= 80) {
    matchLevel = 'excellent';
    matchColor = '#10B981';
  } else if (overallScore >= 65) {
    matchLevel = 'good'; 
    matchColor = '#F59E0B';
  } else if (overallScore >= 45) {
    matchLevel = 'fair';
    matchColor = '#EF4444';
  } else {
    matchLevel = 'poor';
    matchColor = '#6B7280';
  }
  
  const matchReasons: string[] = [];
  const failureReasons: string[] = [];
  
  if (locationScore >= 70) {
    matchReasons.push('Excellent location match');
  } else if (locationScore < 30) {
    failureReasons.push('Poor location match');
  }
  
  if (sizeScore >= 70) {
    matchReasons.push('Size fits requirements well');
  } else if (sizeScore < 30) {
    failureReasons.push('Size does not meet requirements');
  }
  
  return {
    property,
    matchScore: Math.round(overallScore),
    matchLevel,
    matchColor,
    matchReasons,
    failureReasons,
    locationScore: Math.round(locationScore),
    sizeScore: Math.round(sizeScore),
    typeScore: Math.round(typeScore),
    proximityScore: Math.round(financialScore)
  };
}

// Scoring functions
function scoreLocation(property: any, requirements: any): number {
  let score = 0;
  
  if (requirements.locationCriteria.state) {
    if (property.state.toLowerCase() === requirements.locationCriteria.state.toLowerCase()) {
      score += 40;
    } else {
      return 0;
    }
  }
  
  if (requirements.locationCriteria.city) {
    if (property.city.toLowerCase().includes(requirements.locationCriteria.city.toLowerCase())) {
      score += 30;
    } else {
      score -= 20;
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

function scoreSize(property: any, requirements: any): number {
  if (!requirements.spaceRequirements) return 50;
  
  const { minSquareFeet, maxSquareFeet } = requirements.spaceRequirements;
  const propMin = property.square_footage_min || 0;
  const propMax = property.square_footage_max || propMin || 999999;
  
  if (minSquareFeet && maxSquareFeet) {
    const overlapStart = Math.max(minSquareFeet, propMin);
    const overlapEnd = Math.min(maxSquareFeet, propMax);
    
    if (overlapStart <= overlapEnd) {
      const overlapSize = overlapEnd - overlapStart;
      const requiredSize = maxSquareFeet - minSquareFeet;
      const overlapRatio = overlapSize / requiredSize;
      return Math.min(100, overlapRatio * 100);
    } else {
      return 0;
    }
  }
  
  return 50;
}

function scoreType(property: any, requirements: any): number {
  if (!requirements.buildingTypePreferences?.length) {
    return 50;
  }
  
  const propertyTypes = property.building_types.map((t: string) => t.toLowerCase());
  const requiredTypes = requirements.buildingTypePreferences.map((t: string) => t.toLowerCase());
  
  const exactMatches = propertyTypes.filter((type: string) => 
    requiredTypes.some((req: string) => req.includes(type) || type.includes(req))
  );
  
  if (exactMatches.length > 0) {
    return Math.min(100, (exactMatches.length / requiredTypes.length) * 100);
  }
  
  return 25;
}

function scoreFinancial(property: any, requirements: any): number {
  if (!requirements.maxRatePerSqft || !property.rate_per_sqft) {
    return 50;
  }
  
  if (property.rate_per_sqft <= requirements.maxRatePerSqft) {
    const savings = requirements.maxRatePerSqft - property.rate_per_sqft;
    const savingsRatio = savings / requirements.maxRatePerSqft;
    return Math.min(100, 70 + savingsRatio * 30);
  } else {
    const overage = property.rate_per_sqft - requirements.maxRatePerSqft;
    const overageRatio = overage / requirements.maxRatePerSqft;
    return Math.max(0, 50 - overageRatio * 50);
  }
}

// Helper functions
function extractStateFromLocation(locationText: string): string | undefined {
  const stateMatch = locationText.match(/\b([A-Z]{2})\b/);
  return stateMatch?.[1];
}

function extractCityFromLocation(locationText: string): string | undefined {
  const cityMatch = locationText.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*),?\s*[A-Z]{2}/);
  return cityMatch?.[1];
}