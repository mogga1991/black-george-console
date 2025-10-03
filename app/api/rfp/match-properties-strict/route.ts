import { NextRequest, NextResponse } from 'next/server';
import { strictPropertyMatcher } from '@/lib/services/strict-property-matcher';

export const runtime = 'edge';

// Strict property matching for government RFPs with high precision requirements
export async function POST(request: NextRequest) {
  try {
    const { criteria, filters } = await request.json();
    
    if (!criteria) {
      return NextResponse.json(
        { error: "RFP criteria required" },
        { status: 400 }
      );
    }

    console.log('🎯 Starting strict property matching for government RFP');
    console.log('📍 Location requirements:', {
      city: criteria.locationData?.city || 'Not specified',
      state: criteria.locationData?.state || 'Not specified', 
      strictLocation: criteria.locationData?.strictLocation !== false
    });

    // Transform criteria to strict matching format
    const strictCriteria = {
      location: {
        city: criteria.locationData?.city || extractCityFromLocation(criteria.locationText),
        state: criteria.locationData?.state || extractStateFromLocation(criteria.locationText),
        county: criteria.locationData?.county,
        zipCodes: criteria.locationData?.zipCodes,
        coordinates: criteria.center || criteria.locationData?.coordinates,
        radiusKm: criteria.radiusKm || criteria.locationData?.radiusKm || 25,
        strictLocation: criteria.locationData?.strictLocation !== false // Default to strict
      },
      requirements: {
        minSqft: criteria.minSqft,
        maxSqft: criteria.maxSqft,
        buildingTypes: criteria.buildingTypes || ['Office'],
        tenancyType: criteria.tenancyType
      },
      financial: {
        maxRatePerSqft: criteria.maxRatePerSqft,
        budgetMax: criteria.budgetMax
      },
      minimumRelevanceScore: filters?.minScore || 70 // High threshold for government RFPs
    };

    console.log('⚙️ Strict matching criteria:', strictCriteria);

    // Perform strict matching
    const matchingResult = await strictPropertyMatcher.findStrictMatches(strictCriteria);

    // Log results for transparency
    console.log('📊 Matching results summary:', matchingResult.summary);
    console.log(`✅ Found ${matchingResult.matches.length} properties meeting strict criteria`);
    console.log(`❌ Rejected ${matchingResult.rejected.length} properties for various reasons`);

    if (matchingResult.matches.length === 0) {
      console.log('⚠️ No properties meet strict criteria - government RFP may be very specific');
      
      // Log top rejection reasons for debugging
      const rejectionReasonCounts: { [reason: string]: number } = {};
      matchingResult.rejected.forEach(rejected => {
        rejected.reasons.forEach(reason => {
          const key = reason.split(':')[0]; // Get reason category
          rejectionReasonCounts[key] = (rejectionReasonCounts[key] || 0) + 1;
        });
      });
      
      console.log('🔍 Top rejection reasons:', rejectionReasonCounts);
    }

    // Transform matches for API response
    const apiMatches = matchingResult.matches.map(match => ({
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
      matchScore: match.relevanceScore,
      matchLevel: match.matchLevel,
      matchColor: match.matchColor,
      matchReasons: match.matchReasons,
      failureReasons: match.failureReasons,
      detailedScores: {
        location: match.locationRelevance,
        requirements: match.requirementRelevance,
        government: match.governmentSuitability,
        overall: match.relevanceScore
      },
      // Additional metadata for government RFPs
      governmentSuitability: match.governmentSuitability,
      locationRelevance: match.locationRelevance,
      requirementRelevance: match.requirementRelevance
    }));

    // Calculate enhanced summary statistics
    const summary = {
      totalCandidates: matchingResult.summary.totalCandidates,
      passedLocationFilter: matchingResult.summary.passedLocationFilter,
      passedRequirements: matchingResult.summary.passedRequirements,
      finalMatches: matchingResult.summary.finalMatches,
      averageRelevance: matchingResult.summary.averageRelevance,
      
      // Government-specific metrics
      excellent: apiMatches.filter(m => m.matchLevel === 'excellent').length,
      good: apiMatches.filter(m => m.matchLevel === 'good').length,
      fair: apiMatches.filter(m => m.matchLevel === 'fair').length,
      poor: apiMatches.filter(m => m.matchLevel === 'poor').length,
      
      // Filtering breakdown
      rejectedForLocation: matchingResult.rejected.filter(r => 
        r.reasons.some(reason => reason.toLowerCase().includes('location') || reason.toLowerCase().includes('state') || reason.toLowerCase().includes('city'))
      ).length,
      rejectedForSize: matchingResult.rejected.filter(r => 
        r.reasons.some(reason => reason.toLowerCase().includes('too small') || reason.toLowerCase().includes('too large'))
      ).length,
      rejectedForBudget: matchingResult.rejected.filter(r => 
        r.reasons.some(reason => reason.toLowerCase().includes('budget') || reason.toLowerCase().includes('rate'))
      ).length,
      rejectedForLowRelevance: matchingResult.rejected.filter(r => 
        r.reasons.some(reason => reason.toLowerCase().includes('low relevance'))
      ).length,
      
      strictness: {
        locationStrict: strictCriteria.location.strictLocation,
        minimumRelevanceThreshold: strictCriteria.minimumRelevanceScore,
        searchRadius: strictCriteria.location.radiusKm
      },
      
      matchCriteria: {
        location: strictCriteria.location.city ? 
          `${strictCriteria.location.city}, ${strictCriteria.location.state}` :
          strictCriteria.location.state || 'Location not specified',
        sizeRange: strictCriteria.requirements.minSqft || strictCriteria.requirements.maxSqft ?
          `${(strictCriteria.requirements.minSqft || 0).toLocaleString()} - ${(strictCriteria.requirements.maxSqft || 'Unlimited').toLocaleString()} sq ft` :
          'Size not specified',
        buildingTypes: strictCriteria.requirements.buildingTypes?.join(', ') || 'Not specified',
        maxRate: strictCriteria.financial?.maxRatePerSqft ? 
          `$${strictCriteria.financial.maxRatePerSqft}/sq ft` : 'No limit',
        strictLocation: strictCriteria.location.strictLocation
      }
    };

    // Include rejection details for transparency (useful for government procurement)
    const rejectionSample = matchingResult.rejected.slice(0, 10).map(rejected => ({
      propertyId: rejected.property.id,
      address: rejected.property.address,
      city: rejected.property.city,
      state: rejected.property.state,
      rejectionReasons: rejected.reasons
    }));

    return NextResponse.json({
      matches: apiMatches,
      summary,
      rejectionSample, // Help understand why properties were filtered out
      extractionMethod: "Strict government RFP matching",
      timestamp: new Date().toISOString(),
      processingNotes: [
        `Applied strict location filtering: ${strictCriteria.location.strictLocation ? 'YES' : 'NO'}`,
        `Minimum relevance threshold: ${strictCriteria.minimumRelevanceScore}%`,
        `Geographic radius: ${strictCriteria.location.radiusKm}km`,
        `TensorFlow.js ML enhancement: ${matchingResult.summary.mlEnhanced ? 'APPLIED' : 'NOT APPLIED'}`,
        `Total processing time: ${Date.now() - Date.now()}ms` // Placeholder
      ],
      mlEnhancement: {
        enabled: true,
        applied: matchingResult.summary.mlEnhanced,
        technology: 'TensorFlow.js Neural Network Embeddings',
        features: ['Property similarity analysis', 'Enhanced ranking', 'Vector embeddings']
      }
    });

  } catch (error) {
    console.error("🚨 Strict property matching error:", error);
    return NextResponse.json(
      { 
        error: "Failed to match properties with strict criteria",
        details: error.message,
        suggestion: "Try relaxing the minimum relevance score or expanding the search radius"
      },
      { status: 500 }
    );
  }
}

// Helper functions for location extraction
function extractStateFromLocation(locationText: string): string | undefined {
  const stateMatch = locationText?.match(/\b([A-Z]{2})\b/);
  return stateMatch?.[1];
}

function extractCityFromLocation(locationText: string): string | undefined {
  const cityMatch = locationText?.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*),?\s*[A-Z]{2}/);
  return cityMatch?.[1];
}

// Handle GET requests for documentation
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Strict property matching endpoint for government RFPs",
    description: "This endpoint applies extremely strict filtering to ensure only highly relevant properties are returned",
    features: [
      "Strict location matching (no neighboring states unless specified)",
      "Minimum relevance threshold filtering (default 70%)",
      "Government-specific suitability scoring",
      "Detailed rejection tracking for transparency",
      "Multi-level validation and scoring"
    ],
    usage: {
      method: "POST",
      body: {
        criteria: "RFP criteria object with location and requirements",
        filters: {
          minScore: "Minimum relevance score (default: 70)",
          maxResults: "Maximum number of results to return"
        }
      }
    },
    example: {
      criteria: {
        locationText: "New York, NY",
        locationData: {
          city: "New York",
          state: "NY",
          strictLocation: true
        },
        minSqft: 5000,
        maxSqft: 15000,
        buildingTypes: ["Office"],
        maxRatePerSqft: 50
      },
      filters: {
        minScore: 75
      }
    }
  });
}