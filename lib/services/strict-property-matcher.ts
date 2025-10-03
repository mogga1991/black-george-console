// Strict property matching service with government RFP precision
import { createClient } from '@supabase/supabase-js';
import { CREProperty, PropertyMatch } from '@/lib/property-matching';

interface StrictMatchCriteria {
  location: {
    city?: string;
    state: string;
    county?: string;
    zipCodes?: string[];
    coordinates?: { lat: number; lng: number };
    radiusKm: number;
    strictLocation: boolean;
  };
  requirements: {
    minSqft?: number;
    maxSqft?: number;
    buildingTypes?: string[];
    tenancyType?: string;
  };
  financial?: {
    maxRatePerSqft?: number;
    budgetMax?: number;
  };
  minimumRelevanceScore: number; // Strict threshold (default 70)
}

interface StrictPropertyMatch extends PropertyMatch {
  relevanceScore: number;
  locationRelevance: number;
  requirementRelevance: number;
  rejectionReasons: string[];
  governmentSuitability: number;
}

export class StrictPropertyMatcher {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Government RFP matching with strict filtering and ML enhancement
  async findStrictMatches(criteria: StrictMatchCriteria): Promise<{
    matches: StrictPropertyMatch[];
    rejected: { property: CREProperty; reasons: string[] }[];
    summary: {
      totalCandidates: number;
      passedLocationFilter: number;
      passedRequirements: number;
      finalMatches: number;
      averageRelevance: number;
      mlEnhanced: boolean;
    };
  }> {
    
    console.log('🔍 Starting strict property matching with criteria:', criteria);
    
    // Step 1: Get candidate properties with database-level filtering
    const candidates = await this.getCandidateProperties(criteria);
    console.log(`📊 Found ${candidates.length} candidate properties from database`);
    
    // Step 2: Apply strict location filtering
    const locationFiltered = this.applyStrictLocationFilter(candidates, criteria);
    console.log(`📍 ${locationFiltered.passed.length} properties passed strict location filter`);
    console.log(`❌ ${locationFiltered.rejected.length} properties rejected for location mismatch`);
    
    // Step 3: Apply requirement filtering
    const requirementFiltered = this.applyRequirementFilter(locationFiltered.passed, criteria);
    console.log(`📏 ${requirementFiltered.passed.length} properties passed requirement filter`);
    
    // Step 4: Score remaining properties with strict thresholds
    const scoredMatches = this.scoreProperties(requirementFiltered.passed, criteria);
    
    // Step 5: Apply minimum relevance threshold
    const finalMatches = scoredMatches.filter(match => 
      match.relevanceScore >= criteria.minimumRelevanceScore
    );
    
    const rejectedLowScore = scoredMatches.filter(match => 
      match.relevanceScore < criteria.minimumRelevanceScore
    ).map(match => ({
      property: match.property,
      reasons: [`Low relevance score: ${match.relevanceScore}% (minimum: ${criteria.minimumRelevanceScore}%)`, ...match.rejectionReasons]
    }));
    
    console.log(`✅ ${finalMatches.length} properties meet strict relevance threshold (${criteria.minimumRelevanceScore}%)`);
    console.log(`❌ ${rejectedLowScore.length} properties rejected for low relevance`);
    
    // Step 6: Enhanced ML ranking for final matches
    let mlEnhanced = false;
    let enhancedMatches = finalMatches;
    
    if (finalMatches.length > 1) {
      try {
        console.log('🧠 Applying TensorFlow.js ML enhancement to ranking...');
        const { propertyEmbeddingService } = await import('@/lib/services/property-embedding-service');
        
        await propertyEmbeddingService.initialize();
        const mlRankedProperties = await propertyEmbeddingService.enhanceSearchRanking(
          finalMatches.map(match => match.property),
          criteria
        );
        
        // Re-order matches based on ML ranking while preserving scoring
        enhancedMatches = mlRankedProperties.map(property => 
          finalMatches.find(match => match.property.id === property.id)!
        );
        
        mlEnhanced = true;
        console.log('✅ ML enhancement applied successfully');
        
      } catch (error) {
        console.log('⚠️ ML enhancement failed, using traditional ranking:', error.message);
        enhancedMatches = finalMatches.sort((a, b) => b.relevanceScore - a.relevanceScore);
      }
    } else {
      enhancedMatches = finalMatches.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    
    // Combine all rejected properties
    const allRejected = [
      ...locationFiltered.rejected,
      ...requirementFiltered.rejected,
      ...rejectedLowScore
    ];
    
    const averageRelevance = enhancedMatches.length > 0 
      ? enhancedMatches.reduce((sum, match) => sum + match.relevanceScore, 0) / enhancedMatches.length
      : 0;
    
    return {
      matches: enhancedMatches,
      rejected: allRejected,
      summary: {
        totalCandidates: candidates.length,
        passedLocationFilter: locationFiltered.passed.length,
        passedRequirements: requirementFiltered.passed.length,
        finalMatches: enhancedMatches.length,
        averageRelevance: Math.round(averageRelevance),
        mlEnhanced
      }
    };
  }
  
  private async getCandidateProperties(criteria: StrictMatchCriteria): Promise<CREProperty[]> {
    let query = this.supabase.from('cre_properties').select('*');
    
    // Apply database-level filters for efficiency
    if (criteria.location.state) {
      query = query.eq('state', criteria.location.state.toUpperCase());
    }
    
    if (criteria.location.city) {
      query = query.ilike('city', `%${criteria.location.city}%`);
    }
    
    if (criteria.location.zipCodes?.length) {
      query = query.in('zip_code', criteria.location.zipCodes);
    }
    
    // Size filtering
    if (criteria.requirements.minSqft) {
      query = query.gte('square_footage_max', criteria.requirements.minSqft);
    }
    
    if (criteria.requirements.maxSqft) {
      query = query.lte('square_footage_min', criteria.requirements.maxSqft);
    }
    
    // Rate filtering
    if (criteria.financial?.maxRatePerSqft) {
      query = query.lte('rate_per_sqft', criteria.financial.maxRatePerSqft);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Database query error:', error);
      return [];
    }
    
    return data as CREProperty[] || [];
  }
  
  private applyStrictLocationFilter(
    properties: CREProperty[], 
    criteria: StrictMatchCriteria
  ): { passed: CREProperty[]; rejected: { property: CREProperty; reasons: string[] }[] } {
    
    const passed: CREProperty[] = [];
    const rejected: { property: CREProperty; reasons: string[] }[] = [];
    
    for (const property of properties) {
      const rejectionReasons: string[] = [];
      
      // State matching (strict for government RFPs)
      if (criteria.location.state && 
          property.state?.toUpperCase() !== criteria.location.state.toUpperCase()) {
        rejectionReasons.push(`State mismatch: Property in ${property.state}, RFP requires ${criteria.location.state}`);
      }
      
      // City matching (strict if specified)
      if (criteria.location.strictLocation && criteria.location.city) {
        const propertyCity = property.city?.toLowerCase() || '';
        const requiredCity = criteria.location.city.toLowerCase();
        
        if (!propertyCity.includes(requiredCity) && !requiredCity.includes(propertyCity)) {
          rejectionReasons.push(`City mismatch: Property in ${property.city}, RFP requires ${criteria.location.city}`);
        }
      }
      
      // Zip code matching (exact if specified)
      if (criteria.location.zipCodes?.length && property.zip_code) {
        if (!criteria.location.zipCodes.includes(property.zip_code)) {
          rejectionReasons.push(`Zip code not in required list: ${property.zip_code} not in [${criteria.location.zipCodes.join(', ')}]`);
        }
      }
      
      // Geographic radius (if coordinates available)
      if (criteria.location.coordinates && property.latitude && property.longitude) {
        const distance = this.calculateDistance(
          criteria.location.coordinates.lat,
          criteria.location.coordinates.lng,
          property.latitude,
          property.longitude
        );
        
        if (distance > criteria.location.radiusKm) {
          rejectionReasons.push(`Outside geographic radius: ${Math.round(distance)}km from target (max: ${criteria.location.radiusKm}km)`);
        }
      }
      
      if (rejectionReasons.length === 0) {
        passed.push(property);
      } else {
        rejected.push({ property, reasons: rejectionReasons });
      }
    }
    
    return { passed, rejected };
  }
  
  private applyRequirementFilter(
    properties: CREProperty[],
    criteria: StrictMatchCriteria
  ): { passed: CREProperty[]; rejected: { property: CREProperty; reasons: string[] }[] } {
    
    const passed: CREProperty[] = [];
    const rejected: { property: CREProperty; reasons: string[] }[] = [];
    
    for (const property of properties) {
      const rejectionReasons: string[] = [];
      
      // Square footage requirements (strict)
      if (criteria.requirements.minSqft && property.square_footage_max) {
        if (property.square_footage_max < criteria.requirements.minSqft) {
          rejectionReasons.push(`Too small: Max ${property.square_footage_max} sq ft, need minimum ${criteria.requirements.minSqft} sq ft`);
        }
      }
      
      if (criteria.requirements.maxSqft && property.square_footage_min) {
        if (property.square_footage_min > criteria.requirements.maxSqft) {
          rejectionReasons.push(`Too large: Min ${property.square_footage_min} sq ft, maximum allowed ${criteria.requirements.maxSqft} sq ft`);
        }
      }
      
      // Building type requirements (strict)
      if (criteria.requirements.buildingTypes?.length && property.building_types?.length) {
        const hasMatchingType = criteria.requirements.buildingTypes.some(requiredType =>
          property.building_types.some(propType => 
            propType.toLowerCase().includes(requiredType.toLowerCase()) ||
            requiredType.toLowerCase().includes(propType.toLowerCase())
          )
        );
        
        if (!hasMatchingType) {
          rejectionReasons.push(`Building type mismatch: Property has [${property.building_types.join(', ')}], RFP requires [${criteria.requirements.buildingTypes.join(', ')}]`);
        }
      }
      
      // Financial requirements (strict)
      if (criteria.financial?.maxRatePerSqft && property.rate_per_sqft) {
        if (property.rate_per_sqft > criteria.financial.maxRatePerSqft) {
          rejectionReasons.push(`Over budget: $${property.rate_per_sqft}/sq ft exceeds maximum $${criteria.financial.maxRatePerSqft}/sq ft`);
        }
      }
      
      if (rejectionReasons.length === 0) {
        passed.push(property);
      } else {
        rejected.push({ property, reasons: rejectionReasons });
      }
    }
    
    return { passed, rejected };
  }
  
  private scoreProperties(
    properties: CREProperty[],
    criteria: StrictMatchCriteria
  ): StrictPropertyMatch[] {
    
    return properties.map(property => {
      const locationRelevance = this.scoreLocationRelevance(property, criteria);
      const requirementRelevance = this.scoreRequirementRelevance(property, criteria);
      const governmentSuitability = this.scoreGovernmentSuitability(property, criteria);
      
      // Weighted scoring for government RFPs
      const relevanceScore = Math.round(
        locationRelevance * 0.5 +      // Location is critical for government
        requirementRelevance * 0.35 +   // Requirements must be met
        governmentSuitability * 0.15    // Government-specific factors
      );
      
      const match = this.calculatePropertyMatch(property, criteria);
      
      return {
        ...match,
        relevanceScore,
        locationRelevance: Math.round(locationRelevance),
        requirementRelevance: Math.round(requirementRelevance),
        governmentSuitability: Math.round(governmentSuitability),
        rejectionReasons: []
      };
    });
  }
  
  private scoreLocationRelevance(property: CREProperty, criteria: StrictMatchCriteria): number {
    let score = 0;
    
    // State match (critical)
    if (property.state?.toUpperCase() === criteria.location.state?.toUpperCase()) {
      score += 40;
    } else {
      return 0; // No points if wrong state
    }
    
    // City match
    if (criteria.location.city && property.city) {
      const propertyCity = property.city.toLowerCase();
      const requiredCity = criteria.location.city.toLowerCase();
      
      if (propertyCity === requiredCity) {
        score += 30; // Exact match
      } else if (propertyCity.includes(requiredCity) || requiredCity.includes(propertyCity)) {
        score += 20; // Partial match
      }
    } else if (!criteria.location.city) {
      score += 25; // No city requirement
    }
    
    // Geographic proximity
    if (criteria.location.coordinates && property.latitude && property.longitude) {
      const distance = this.calculateDistance(
        criteria.location.coordinates.lat,
        criteria.location.coordinates.lng,
        property.latitude,
        property.longitude
      );
      
      if (distance <= criteria.location.radiusKm * 0.5) {
        score += 30; // Very close
      } else if (distance <= criteria.location.radiusKm) {
        score += 20; // Within radius
      } else {
        score += 0; // Too far
      }
    } else {
      score += 15; // No coordinates available
    }
    
    return Math.min(score, 100);
  }
  
  private scoreRequirementRelevance(property: CREProperty, criteria: StrictMatchCriteria): number {
    let score = 0;
    let totalCriteria = 0;
    
    // Size matching
    if (criteria.requirements.minSqft || criteria.requirements.maxSqft) {
      totalCriteria++;
      const propMin = property.square_footage_min || 0;
      const propMax = property.square_footage_max || propMin || 999999;
      const reqMin = criteria.requirements.minSqft || 0;
      const reqMax = criteria.requirements.maxSqft || 999999;
      
      // Calculate overlap
      const overlapStart = Math.max(reqMin, propMin);
      const overlapEnd = Math.min(reqMax, propMax);
      
      if (overlapStart <= overlapEnd) {
        const overlapSize = overlapEnd - overlapStart;
        const requestedSize = reqMax - reqMin;
        const overlapRatio = requestedSize > 0 ? overlapSize / requestedSize : 1;
        score += Math.min(overlapRatio * 100, 100);
      }
    }
    
    // Building type matching
    if (criteria.requirements.buildingTypes?.length && property.building_types?.length) {
      totalCriteria++;
      const matches = criteria.requirements.buildingTypes.filter(reqType =>
        property.building_types.some(propType => 
          propType.toLowerCase().includes(reqType.toLowerCase()) ||
          reqType.toLowerCase().includes(propType.toLowerCase())
        )
      );
      
      const matchRatio = matches.length / criteria.requirements.buildingTypes.length;
      score += matchRatio * 100;
    }
    
    // Financial matching
    if (criteria.financial?.maxRatePerSqft && property.rate_per_sqft) {
      totalCriteria++;
      if (property.rate_per_sqft <= criteria.financial.maxRatePerSqft) {
        const savings = criteria.financial.maxRatePerSqft - property.rate_per_sqft;
        const savingsRatio = savings / criteria.financial.maxRatePerSqft;
        score += 70 + (savingsRatio * 30); // Base 70 + bonus for savings
      } else {
        score += 0; // Over budget
      }
    }
    
    return totalCriteria > 0 ? score / totalCriteria : 50;
  }
  
  private scoreGovernmentSuitability(property: CREProperty, criteria: StrictMatchCriteria): number {
    let score = 50; // Base score
    
    // Look for government-friendly features in property description or features
    const description = (property.description || '').toLowerCase();
    const features = (property.amenities || []).map(a => a.toLowerCase());
    const allText = [description, ...features].join(' ');
    
    // Government-preferred features
    if (allText.includes('parking') || allText.includes('garage')) score += 15;
    if (allText.includes('security') || allText.includes('access control')) score += 15;
    if (allText.includes('ada') || allText.includes('accessible')) score += 10;
    if (allText.includes('conference') || allText.includes('meeting')) score += 10;
    if (allText.includes('elevator')) score += 5;
    if (allText.includes('backup') || allText.includes('generator')) score += 5;
    
    return Math.min(score, 100);
  }
  
  private calculatePropertyMatch(property: CREProperty, criteria: StrictMatchCriteria): PropertyMatch {
    // Simplified match calculation for interface compatibility
    const matchScore = this.scoreLocationRelevance(property, criteria);
    
    let matchLevel: 'excellent' | 'good' | 'fair' | 'poor';
    let matchColor: string;
    
    if (matchScore >= 90) {
      matchLevel = 'excellent';
      matchColor = '#10B981';
    } else if (matchScore >= 75) {
      matchLevel = 'good';
      matchColor = '#F59E0B';
    } else if (matchScore >= 60) {
      matchLevel = 'fair';
      matchColor = '#EF4444';
    } else {
      matchLevel = 'poor';
      matchColor = '#6B7280';
    }
    
    return {
      property,
      matchScore: Math.round(matchScore),
      matchLevel,
      matchColor,
      matchReasons: ['Location analysis completed'],
      failureReasons: [],
      locationScore: Math.round(matchScore),
      sizeScore: 0,
      typeScore: 0,
      proximityScore: 0
    };
  }
  
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
}

export const strictPropertyMatcher = new StrictPropertyMatcher();