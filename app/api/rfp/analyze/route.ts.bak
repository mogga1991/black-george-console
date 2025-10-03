import { NextRequest, NextResponse } from 'next/server';
import { PropertyMatcher } from '@/lib/notion/matching';

export const runtime = 'edge';

interface RFPAnalysisRequest {
  text?: string;
  fileContent?: string;
  fileName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { text, fileContent, fileName }: RFPAnalysisRequest = await request.json();

    if (!text && !fileContent) {
      return NextResponse.json(
        { error: 'Either text or fileContent is required' },
        { status: 400 }
      );
    }

    const contentToAnalyze = text || fileContent || '';

    // Extract requirements using AI
    const requirements = await analyzeRFPWithAI(contentToAnalyze);

    // Also extract basic requirements using pattern matching as fallback
    const fallbackRequirements = PropertyMatcher.extractRequirementsFromText(contentToAnalyze);

    // Merge AI and fallback requirements
    const combinedRequirements = mergeRequirements(requirements, fallbackRequirements);

    return NextResponse.json({
      requirements: combinedRequirements,
      analysis: {
        extractedFrom: fileName || 'text input',
        contentLength: contentToAnalyze.length,
        analysisMethod: 'AI + Pattern Matching',
        timestamp: new Date().toISOString()
      },
      summary: generateRequirementsSummary(combinedRequirements)
    });

  } catch (error) {
    console.error('RFP analysis error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze RFP',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function analyzeRFPWithAI(content: string) {
  try {
    // Use Cloudflare Workers AI for analysis
    const ai = (globalThis as any).AI;
    
    if (!ai) {
      console.warn('AI binding not available, using fallback analysis');
      return PropertyMatcher.extractRequirementsFromText(content);
    }

    const prompt = `Analyze this RFP/RLP document and extract commercial real estate requirements in JSON format:

${content}

Extract and return ONLY a JSON object with this structure:
{
  "location": {
    "cities": ["city1", "city2"],
    "states": ["ST1", "ST2"],
    "regions": ["region"],
    "proximityRequirements": ["near airport", "downtown area"]
  },
  "space": {
    "minSquareFootage": 5000,
    "maxSquareFootage": 25000,
    "ceilingHeight": "12 feet",
    "specialSpaces": ["conference rooms", "server room"],
    "accessibilityRequirements": ["ADA compliant"]
  },
  "technical": {
    "powerRequirements": "high capacity electrical",
    "hvacSpecs": "24/7 climate control",
    "itInfrastructure": ["fiber optic", "redundant internet"],
    "loadingDocks": 2,
    "parkingMinimum": 50
  },
  "leaseTerms": {
    "duration": "5-10 years",
    "occupancyDate": "2024-06-01",
    "maxBudgetPerSF": 25.00,
    "governmentTerms": ["GSA lease standards"]
  },
  "security": {
    "clearanceLevel": "Secret",
    "securityFeatures": ["controlled access", "security cameras"],
    "complianceRequirements": ["NIST guidelines"]
  },
  "compliance": {
    "gsaRequired": true,
    "environmentalCerts": ["LEED certified"],
    "historicPreservation": false,
    "buyAmericanAct": true
  }
}`;

    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are an expert at analyzing government RFPs and RLPs for commercial real estate requirements. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 1024
    });

    // Try to parse AI response as JSON
    try {
      const requirements = JSON.parse(response.response);
      return requirements;
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, using fallback');
      return PropertyMatcher.extractRequirementsFromText(content);
    }

  } catch (error) {
    console.error('AI analysis failed:', error);
    return PropertyMatcher.extractRequirementsFromText(content);
  }
}

function mergeRequirements(aiRequirements: any, fallbackRequirements: any) {
  // Merge the two requirement objects, preferring AI results but filling gaps with fallback
  const merged = { ...aiRequirements };

  // Merge location
  if (!merged.location && fallbackRequirements.location) {
    merged.location = fallbackRequirements.location;
  } else if (merged.location && fallbackRequirements.location) {
    merged.location = {
      ...merged.location,
      cities: merged.location.cities || fallbackRequirements.location.cities,
      states: merged.location.states || fallbackRequirements.location.states
    };
  }

  // Merge space
  if (!merged.space && fallbackRequirements.space) {
    merged.space = fallbackRequirements.space;
  } else if (merged.space && fallbackRequirements.space) {
    merged.space = {
      ...merged.space,
      minSquareFootage: merged.space.minSquareFootage || fallbackRequirements.space.minSquareFootage,
      ceilingHeight: merged.space.ceilingHeight || fallbackRequirements.space.ceilingHeight
    };
  }

  // Merge lease terms
  if (!merged.leaseTerms && fallbackRequirements.leaseTerms) {
    merged.leaseTerms = fallbackRequirements.leaseTerms;
  } else if (merged.leaseTerms && fallbackRequirements.leaseTerms) {
    merged.leaseTerms = {
      ...merged.leaseTerms,
      maxBudgetPerSF: merged.leaseTerms.maxBudgetPerSF || fallbackRequirements.leaseTerms.maxBudgetPerSF
    };
  }

  // Merge compliance
  if (!merged.compliance && fallbackRequirements.compliance) {
    merged.compliance = fallbackRequirements.compliance;
  } else if (merged.compliance && fallbackRequirements.compliance) {
    merged.compliance = {
      ...merged.compliance,
      gsaRequired: merged.compliance.gsaRequired !== undefined ? merged.compliance.gsaRequired : fallbackRequirements.compliance.gsaRequired
    };
  }

  return merged;
}

function generateRequirementsSummary(requirements: any): string {
  const summary: string[] = [];

  if (requirements.location) {
    if (requirements.location.cities?.length > 0) {
      summary.push(`Location: ${requirements.location.cities.join(', ')}`);
    }
    if (requirements.location.states?.length > 0) {
      summary.push(`State(s): ${requirements.location.states.join(', ')}`);
    }
  }

  if (requirements.space) {
    if (requirements.space.minSquareFootage || requirements.space.maxSquareFootage) {
      const min = requirements.space.minSquareFootage?.toLocaleString() || '0';
      const max = requirements.space.maxSquareFootage?.toLocaleString() || 'unlimited';
      summary.push(`Space: ${min} - ${max} SF`);
    }
    if (requirements.space.ceilingHeight) {
      summary.push(`Ceiling: ${requirements.space.ceilingHeight}`);
    }
  }

  if (requirements.leaseTerms?.maxBudgetPerSF) {
    summary.push(`Budget: Up to $${requirements.leaseTerms.maxBudgetPerSF}/SF`);
  }

  if (requirements.leaseTerms?.occupancyDate) {
    summary.push(`Occupancy: ${requirements.leaseTerms.occupancyDate}`);
  }

  if (requirements.technical?.parkingMinimum) {
    summary.push(`Parking: ${requirements.technical.parkingMinimum}+ spaces`);
  }

  if (requirements.technical?.loadingDocks) {
    summary.push(`Loading: ${requirements.technical.loadingDocks} dock(s)`);
  }

  if (requirements.compliance?.gsaRequired) {
    summary.push('GSA compliance required');
  }

  if (requirements.security?.clearanceLevel) {
    summary.push(`Security: ${requirements.security.clearanceLevel} clearance`);
  }

  return summary.length > 0 ? summary.join(' • ') : 'General commercial real estate requirements';
}