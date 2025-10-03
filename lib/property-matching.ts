// Property Matching Engine
// Matches CRE properties against RFP/RLP requirements with scoring

export interface PropertyMatch {
  property: CREProperty;
  matchScore: number;
  matchLevel: 'excellent' | 'good' | 'fair' | 'poor';
  matchColor: string;
  matchReasons: string[];
  failureReasons: string[];
  locationScore: number;
  sizeScore: number;
  typeScore: number;
  proximityScore: number;
}

export interface CREProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  building_types: string[];
  tenancy?: string;
  square_footage: string;
  square_footage_min?: number;
  square_footage_max?: number;
  number_of_suites: number;
  rate_text: string;
  rate_per_sqft?: number;
  longitude?: number;
  latitude?: number;
}

export interface RFPRequirements {
  locationCriteria: {
    state?: string;
    city?: string;
    zipCodes?: string[];
    radiusKm?: number;
    center?: { lat: number; lng: number };
  };
  spaceRequirements: {
    minSquareFeet?: number;
    maxSquareFeet?: number;
    preferredSquareFeet?: number;
    spaceType?: string;
  };
  buildingTypePreferences?: string[];
  tenancyPreference?: 'single' | 'multiple';
  maxRatePerSqft?: number;
  mustHaves?: string[];
  niceToHaves?: string[];
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Score location match (0-100)
function scoreLocation(property: CREProperty, requirements: RFPRequirements): number {
  let score = 0;
  
  // State match (critical)
  if (requirements.locationCriteria.state) {
    if (property.state.toLowerCase() === requirements.locationCriteria.state.toLowerCase()) {
      score += 40;
    } else {
      return 0; // Complete failure if state doesn't match
    }
  }
  
  // City match
  if (requirements.locationCriteria.city) {
    if (property.city.toLowerCase().includes(requirements.locationCriteria.city.toLowerCase()) ||
        requirements.locationCriteria.city.toLowerCase().includes(property.city.toLowerCase())) {
      score += 30;
    } else {
      score -= 20;
    }
  }
  
  // ZIP code match
  if (requirements.locationCriteria.zipCodes && property.zip_code) {
    if (requirements.locationCriteria.zipCodes.includes(property.zip_code)) {
      score += 20;
    }
  }
  
  // Distance from center point
  if (requirements.locationCriteria.center && property.latitude && property.longitude) {
    const distance = calculateDistance(
      requirements.locationCriteria.center.lat,
      requirements.locationCriteria.center.lng,
      property.latitude,
      property.longitude
    );
    
    const maxDistance = requirements.locationCriteria.radiusKm || 50; // Default 50km
    if (distance <= maxDistance) {
      const distanceScore = Math.max(0, 30 * (1 - distance / maxDistance));
      score += distanceScore;
    } else {
      score -= 10;
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

// Score size match (0-100)
function scoreSize(property: CREProperty, requirements: RFPRequirements): number {
  if (!requirements.spaceRequirements) return 50; // Neutral if no requirements
  
  const { minSquareFeet, maxSquareFeet, preferredSquareFeet } = requirements.spaceRequirements;
  
  let propMin = property.square_footage_min || 0;
  let propMax = property.square_footage_max || propMin || 999999;
  
  // If we have a preferred size, use that as primary target
  if (preferredSquareFeet) {
    const difference = Math.abs(preferredSquareFeet - (propMin + propMax) / 2);
    const tolerance = preferredSquareFeet * 0.2; // 20% tolerance
    
    if (difference <= tolerance) {
      return 100; // Perfect match
    } else {
      return Math.max(0, 100 - (difference / preferredSquareFeet) * 100);
    }
  }
  
  // Check if property falls within required range
  if (minSquareFeet && maxSquareFeet) {
    // Property must overlap with required range
    const overlapStart = Math.max(minSquareFeet, propMin);
    const overlapEnd = Math.min(maxSquareFeet, propMax);
    
    if (overlapStart <= overlapEnd) {
      const overlapSize = overlapEnd - overlapStart;
      const requiredSize = maxSquareFeet - minSquareFeet;
      const overlapRatio = overlapSize / requiredSize;
      return Math.min(100, overlapRatio * 100);
    } else {
      return 0; // No overlap
    }
  }
  
  return 50; // Neutral if insufficient data
}

// Score building type match (0-100)
function scoreType(property: CREProperty, requirements: RFPRequirements): number {
  if (!requirements.buildingTypePreferences?.length) {
    return 50; // Neutral if no preference
  }
  
  const propertyTypes = property.building_types.map(t => t.toLowerCase());
  const requiredTypes = requirements.buildingTypePreferences.map(t => t.toLowerCase());
  
  // Check for exact matches
  const exactMatches = propertyTypes.filter(type => 
    requiredTypes.some(req => req.includes(type) || type.includes(req))
  );
  
  if (exactMatches.length > 0) {
    return Math.min(100, (exactMatches.length / requiredTypes.length) * 100);
  }
  
  // Check for partial matches (office, retail, etc.)
  const keywords = {
    office: ['office', 'corporate', 'business'],
    retail: ['retail', 'store', 'shop', 'commercial'],
    industrial: ['industrial', 'warehouse', 'manufacturing'],
    land: ['land', 'development', 'vacant']
  };
  
  let partialScore = 0;
  for (const [category, categoryKeywords] of Object.entries(keywords)) {
    const hasPropertyType = propertyTypes.some(type => 
      categoryKeywords.some(keyword => type.includes(keyword))
    );
    const hasRequiredType = requiredTypes.some(type => 
      categoryKeywords.some(keyword => type.includes(keyword))
    );
    
    if (hasPropertyType && hasRequiredType) {
      partialScore += 25;
    }
  }
  
  return Math.min(100, partialScore);
}

// Score rate/financial match (0-100)
function scoreFinancial(property: CREProperty, requirements: RFPRequirements): number {
  if (!requirements.maxRatePerSqft || !property.rate_per_sqft) {
    return 50; // Neutral if no financial requirements
  }
  
  if (property.rate_per_sqft <= requirements.maxRatePerSqft) {
    // Property is within budget
    const savings = requirements.maxRatePerSqft - property.rate_per_sqft;
    const savingsRatio = savings / requirements.maxRatePerSqft;
    return Math.min(100, 70 + savingsRatio * 30); // Base 70 + bonus for savings
  } else {
    // Property is over budget
    const overage = property.rate_per_sqft - requirements.maxRatePerSqft;
    const overageRatio = overage / requirements.maxRatePerSqft;
    return Math.max(0, 50 - overageRatio * 50); // Penalty for being over budget
  }
}

// Calculate overall match score and classification
export function calculatePropertyMatch(
  property: CREProperty, 
  requirements: RFPRequirements
): PropertyMatch {
  const locationScore = scoreLocation(property, requirements);
  const sizeScore = scoreSize(property, requirements);
  const typeScore = scoreType(property, requirements);
  const financialScore = scoreFinancial(property, requirements);
  
  // Weighted average (location and size are most important)
  const overallScore = (
    locationScore * 0.4 +    // 40% weight on location
    sizeScore * 0.3 +        // 30% weight on size
    typeScore * 0.2 +        // 20% weight on type
    financialScore * 0.1     // 10% weight on financial
  );
  
  // Determine match level and color
  let matchLevel: PropertyMatch['matchLevel'];
  let matchColor: string;
  
  if (overallScore >= 80) {
    matchLevel = 'excellent';
    matchColor = '#10B981'; // Green
  } else if (overallScore >= 65) {
    matchLevel = 'good'; 
    matchColor = '#F59E0B'; // Amber
  } else if (overallScore >= 45) {
    matchLevel = 'fair';
    matchColor = '#EF4444'; // Red
  } else {
    matchLevel = 'poor';
    matchColor = '#6B7280'; // Gray
  }
  
  // Generate match reasons
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
  
  if (typeScore >= 70) {
    matchReasons.push('Building type matches needs');
  } else if (typeScore < 30) {
    failureReasons.push('Building type not suitable');
  }
  
  if (financialScore >= 70) {
    matchReasons.push('Within budget requirements');
  } else if (financialScore < 30) {
    failureReasons.push('Exceeds budget constraints');
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

// Filter and rank properties based on RFP requirements
export function findMatchingProperties(
  properties: CREProperty[], 
  requirements: RFPRequirements,
  minScore: number = 30 // Only show properties above this threshold
): PropertyMatch[] {
  return properties
    .map(property => calculatePropertyMatch(property, requirements))
    .filter(match => match.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore); // Sort by best match first
}

// Get summary statistics for matches
export function getMatchingSummary(matches: PropertyMatch[]) {
  const excellent = matches.filter(m => m.matchLevel === 'excellent').length;
  const good = matches.filter(m => m.matchLevel === 'good').length;
  const fair = matches.filter(m => m.matchLevel === 'fair').length;
  const poor = matches.filter(m => m.matchLevel === 'poor').length;
  
  const averageScore = matches.length > 0 
    ? Math.round(matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length)
    : 0;
  
  return {
    total: matches.length,
    excellent,
    good,
    fair,
    poor,
    averageScore,
    bestMatch: matches[0] || null
  };
}