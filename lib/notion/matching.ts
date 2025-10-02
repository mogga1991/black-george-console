import { NotionProperty, RFPRequirements, PropertyMatch } from './client';

export class PropertyMatcher {
  /**
   * Match properties against RFP requirements and return scored results
   */
  static matchProperties(
    properties: NotionProperty[], 
    requirements: RFPRequirements
  ): PropertyMatch[] {
    const matches = properties.map(property => {
      const score = this.calculateMatchScore(property, requirements);
      const matchReasons = this.generateMatchReasons(property, requirements, score);
      const category = this.categorizeMatch(score);

      return {
        property,
        score,
        matchReasons,
        category
      } as PropertyMatch;
    });

    // Filter out poor matches and sort by score
    return matches
      .filter(match => match.score >= 55) // Only show fair+ matches
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate match score (0-100) based on requirements
   */
  private static calculateMatchScore(
    property: NotionProperty, 
    requirements: RFPRequirements
  ): number {
    let score = 0;
    let maxScore = 0;

    // Location matching (25 points)
    const locationScore = this.scoreLocation(property, requirements.location);
    score += locationScore.score;
    maxScore += locationScore.maxScore;

    // Space requirements (30 points)
    const spaceScore = this.scoreSpace(property, requirements.space);
    score += spaceScore.score;
    maxScore += spaceScore.maxScore;

    // Technical requirements (20 points)
    const technicalScore = this.scoreTechnical(property, requirements.technical);
    score += technicalScore.score;
    maxScore += technicalScore.maxScore;

    // Compliance & Security (15 points)
    const complianceScore = this.scoreCompliance(property, requirements.security, requirements.compliance);
    score += complianceScore.score;
    maxScore += complianceScore.maxScore;

    // Budget & Terms (10 points)
    const budgetScore = this.scoreBudget(property, requirements.leaseTerms);
    score += budgetScore.score;
    maxScore += budgetScore.maxScore;

    // Convert to percentage
    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  private static scoreLocation(property: NotionProperty, location?: any): { score: number; maxScore: number } {
    if (!location) return { score: 25, maxScore: 25 }; // No requirements = perfect match

    let score = 0;
    const maxScore = 25;

    // City match
    if (location.cities && location.cities.length > 0) {
      if (location.cities.some((city: string) => 
        city.toLowerCase() === property.city.toLowerCase()
      )) {
        score += 15; // Exact city match
      }
    } else {
      score += 15; // No city requirement
    }

    // State match
    if (location.states && location.states.length > 0) {
      if (location.states.some((state: string) => 
        state.toLowerCase() === property.state.toLowerCase()
      )) {
        score += 10; // State match
      } else {
        score += 5; // Partial points for being in wrong state
      }
    } else {
      score += 10; // No state requirement
    }

    return { score, maxScore };
  }

  private static scoreSpace(property: NotionProperty, space?: any): { score: number; maxScore: number } {
    if (!space) return { score: 30, maxScore: 30 };

    let score = 0;
    const maxScore = 30;

    // Square footage fit (15 points)
    if (space.minSquareFootage || space.maxSquareFootage) {
      const propSF = property.squareFootage;
      const minSF = space.minSquareFootage || 0;
      const maxSF = space.maxSquareFootage || Infinity;

      if (propSF >= minSF && propSF <= maxSF) {
        score += 15; // Perfect fit
      } else if (propSF >= minSF * 0.8 && propSF <= maxSF * 1.2) {
        score += 10; // Close fit
      } else if (propSF >= minSF * 0.6) {
        score += 5; // Partial fit
      }
    } else {
      score += 15; // No size requirement
    }

    // Ceiling height (5 points)
    if (space.ceilingHeight && property.ceilingHeight) {
      const requiredHeight = this.parseHeight(space.ceilingHeight);
      const availableHeight = this.parseHeight(property.ceilingHeight);
      
      if (availableHeight >= requiredHeight) {
        score += 5;
      } else if (availableHeight >= requiredHeight * 0.9) {
        score += 3;
      }
    } else {
      score += 5; // No height requirement or no data
    }

    // Special features (10 points)
    if (space.specialSpaces && space.specialSpaces.length > 0) {
      const matches = space.specialSpaces.filter((feature: string) =>
        property.specialFeatures?.some(pf => 
          pf.toLowerCase().includes(feature.toLowerCase())
        ) || property.description?.toLowerCase().includes(feature.toLowerCase())
      );
      score += Math.min(10, (matches.length / space.specialSpaces.length) * 10);
    } else {
      score += 10; // No special requirements
    }

    return { score, maxScore };
  }

  private static scoreTechnical(property: NotionProperty, technical?: any): { score: number; maxScore: number } {
    if (!technical) return { score: 20, maxScore: 20 };

    let score = 0;
    const maxScore = 20;

    // Power capacity (5 points)
    if (technical.powerRequirements && property.power) {
      if (property.power.toLowerCase().includes('adequate') || 
          property.power.toLowerCase().includes('high') ||
          property.power.toLowerCase().includes('industrial')) {
        score += 5;
      } else {
        score += 2;
      }
    } else {
      score += 5; // No requirement or no data
    }

    // HVAC (5 points)
    if (technical.hvacSpecs && property.hvac) {
      score += 5; // Has HVAC info
    } else {
      score += 5; // No requirement
    }

    // Loading docks (5 points)
    if (technical.loadingDocks && property.loadingDocks !== undefined) {
      if (property.loadingDocks >= technical.loadingDocks) {
        score += 5;
      } else {
        score += Math.max(0, 5 - (technical.loadingDocks - property.loadingDocks));
      }
    } else {
      score += 5; // No requirement
    }

    // Parking (5 points)
    if (technical.parkingMinimum && property.parkingSpaces !== undefined) {
      if (property.parkingSpaces >= technical.parkingMinimum) {
        score += 5;
      } else {
        const ratio = property.parkingSpaces / technical.parkingMinimum;
        score += Math.max(0, ratio * 5);
      }
    } else {
      score += 5; // No requirement
    }

    return { score, maxScore };
  }

  private static scoreCompliance(property: NotionProperty, security?: any, compliance?: any): { score: number; maxScore: number } {
    let score = 0;
    const maxScore = 15;

    // GSA approval (10 points)
    if (compliance?.gsaRequired) {
      if (property.gsaApproved) {
        score += 10;
      }
      // No points if GSA required but not approved
    } else {
      score += 10; // Not required
    }

    // Security clearance (5 points)
    if (security?.clearanceLevel && property.securityClearance) {
      if (property.securityClearance.toLowerCase().includes(security.clearanceLevel.toLowerCase())) {
        score += 5;
      } else if (property.securityClearance.toLowerCase() !== 'none') {
        score += 2; // Has some clearance
      }
    } else {
      score += 5; // No requirement
    }

    return { score, maxScore };
  }

  private static scoreBudget(property: NotionProperty, leaseTerms?: any): { score: number; maxScore: number } {
    if (!leaseTerms) return { score: 10, maxScore: 10 };

    let score = 0;
    const maxScore = 10;

    // Rate within budget (5 points)
    if (leaseTerms.maxBudgetPerSF && property.ratePerSF) {
      if (property.ratePerSF <= leaseTerms.maxBudgetPerSF) {
        score += 5;
      } else if (property.ratePerSF <= leaseTerms.maxBudgetPerSF * 1.1) {
        score += 3; // 10% over budget
      }
    } else {
      score += 5; // No budget constraint
    }

    // Availability timing (5 points)
    if (leaseTerms.occupancyDate && property.availabilityDate) {
      const requiredDate = new Date(leaseTerms.occupancyDate);
      const availableDate = new Date(property.availabilityDate);
      
      if (availableDate <= requiredDate) {
        score += 5; // Available in time
      } else {
        const daysDiff = (availableDate.getTime() - requiredDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 30) {
          score += 3; // Within 30 days
        } else if (daysDiff <= 90) {
          score += 1; // Within 90 days
        }
      }
    } else {
      score += 5; // No timing requirement
    }

    return { score, maxScore };
  }

  private static generateMatchReasons(
    property: NotionProperty, 
    requirements: RFPRequirements,
    score: number
  ): string[] {
    const reasons: string[] = [];

    // Location reasons
    if (requirements.location?.cities?.includes(property.city)) {
      reasons.push(`Located in requested city: ${property.city}`);
    }

    // Space reasons
    if (requirements.space?.minSquareFootage && property.squareFootage >= requirements.space.minSquareFootage) {
      reasons.push(`Meets size requirement: ${property.squareFootage.toLocaleString()} SF`);
    }

    // Budget reasons
    if (requirements.leaseTerms?.maxBudgetPerSF && property.ratePerSF <= requirements.leaseTerms.maxBudgetPerSF) {
      reasons.push(`Within budget: $${property.ratePerSF}/SF (max $${requirements.leaseTerms.maxBudgetPerSF}/SF)`);
    }

    // Compliance reasons
    if (property.gsaApproved) {
      reasons.push('GSA approved facility');
    }

    if (property.securityClearance && property.securityClearance !== 'None') {
      reasons.push(`Security clearance: ${property.securityClearance}`);
    }

    // Technical reasons
    if (property.loadingDocks && property.loadingDocks > 0) {
      reasons.push(`${property.loadingDocks} loading dock(s) available`);
    }

    if (property.parkingSpaces && property.parkingSpaces > 0) {
      reasons.push(`${property.parkingSpaces} parking spaces`);
    }

    // Add general match quality
    if (score >= 85) {
      reasons.unshift('Excellent match for requirements');
    } else if (score >= 70) {
      reasons.unshift('Good match for requirements');
    } else if (score >= 55) {
      reasons.unshift('Fair match for requirements');
    }

    return reasons;
  }

  private static categorizeMatch(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 55) return 'fair';
    return 'poor';
  }

  private static parseHeight(heightStr: string): number {
    // Parse height strings like "12 feet", "12'", "12 ft", etc.
    const match = heightStr.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Extract RFP requirements from text using AI analysis
   */
  static async extractRequirementsFromText(text: string): Promise<RFPRequirements> {
    // This would typically call your AI service
    // For now, return a basic extraction
    const requirements: RFPRequirements = {};

    // Simple keyword extraction
    const lowerText = text.toLowerCase();

    // Location extraction
    const cities = this.extractCities(text);
    const states = this.extractStates(text);
    if (cities.length > 0 || states.length > 0) {
      requirements.location = { cities, states };
    }

    // Space extraction
    const sqftMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:square\s*feet|sq\s*ft|sf)/i);
    const ceilingMatch = text.match(/(\d+)\s*(?:foot|feet|ft|')\s*(?:ceiling|height)/i);
    
    if (sqftMatch || ceilingMatch) {
      requirements.space = {};
      if (sqftMatch) {
        const sqft = parseInt(sqftMatch[1].replace(/,/g, ''));
        requirements.space.minSquareFootage = sqft;
      }
      if (ceilingMatch) {
        requirements.space.ceilingHeight = ceilingMatch[0];
      }
    }

    // Budget extraction
    const budgetMatch = text.match(/\$(\d+(?:\.\d{2})?)\s*(?:per\s*(?:square\s*foot|sq\s*ft|sf))/i);
    if (budgetMatch) {
      requirements.leaseTerms = {
        maxBudgetPerSF: parseFloat(budgetMatch[1])
      };
    }

    // GSA requirement
    if (lowerText.includes('gsa') || lowerText.includes('government')) {
      requirements.compliance = {
        gsaRequired: true
      };
    }

    return requirements;
  }

  private static extractCities(text: string): string[] {
    // Basic city extraction - in a real implementation, use a more comprehensive list
    const commonCities = [
      'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
      'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
      'fort worth', 'columbus', 'charlotte', 'san francisco', 'indianapolis',
      'seattle', 'denver', 'washington', 'boston', 'el paso', 'nashville',
      'detroit', 'oklahoma city', 'portland', 'las vegas', 'memphis', 'louisville',
      'baltimore', 'milwaukee', 'albuquerque', 'tucson', 'fresno', 'sacramento',
      'mesa', 'kansas city', 'atlanta', 'long beach', 'colorado springs', 'raleigh',
      'miami', 'virginia beach', 'omaha', 'oakland', 'minneapolis', 'tulsa',
      'wichita', 'arlington', 'new orleans', 'cleveland'
    ];

    const found: string[] = [];
    const lowerText = text.toLowerCase();

    for (const city of commonCities) {
      if (lowerText.includes(city)) {
        found.push(city.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '));
      }
    }

    return found;
  }

  private static extractStates(text: string): string[] {
    const stateMap: { [key: string]: string } = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
      'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
      'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
      'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
      'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
      'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
      'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
      'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
      'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
      'wisconsin': 'WI', 'wyoming': 'WY'
    };

    const found: string[] = [];
    const lowerText = text.toLowerCase();

    // Check for state names
    for (const [stateName, code] of Object.entries(stateMap)) {
      if (lowerText.includes(stateName)) {
        found.push(code);
      }
    }

    // Check for state codes
    const codeMatches = text.match(/\b([A-Z]{2})\b/g);
    if (codeMatches) {
      for (const code of codeMatches) {
        if (Object.values(stateMap).includes(code) && !found.includes(code)) {
          found.push(code);
        }
      }
    }

    return found;
  }
}