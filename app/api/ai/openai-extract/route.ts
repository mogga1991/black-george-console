import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// OpenAI extraction as final fallback
export async function POST(request: NextRequest) {
  try {
    const { content, filename } = await request.json();
    
    if (!content) {
      return NextResponse.json(
        { error: 'Document content is required' },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const extractionPrompt = `
You are an expert government RFP/RLP document analyzer. Extract requirements with extreme precision.

LOCATION EXTRACTION CRITICAL RULES:
1. If document says "New York" - extract ONLY New York state (NY)
2. If document says "New York City" - extract city: "New York City", state: "NY"
3. DO NOT include neighboring states unless explicitly mentioned
4. If document mentions specific zip codes, extract them exactly
5. If document mentions specific neighborhoods/areas, extract them
6. Set strictLocation to true unless document explicitly allows broader areas

EXTRACTION REQUIREMENTS:
- Extract exact text phrases about location requirements
- Identify minimum and maximum square footage
- Extract specific building type requirements
- Identify must-have vs nice-to-have features
- Extract budget/rate information if present
- Identify timeline requirements

Document content:
"${content.substring(0, 5000)}"

Return ONLY this JSON structure:
{
  "location": {
    "city": "exact city name or null",
    "state": "exact state code (NY, CA, TX, etc.) or null", 
    "county": "county if mentioned",
    "zipCodes": ["array of specific zip codes"],
    "specificAreas": ["specific areas/neighborhoods mentioned"],
    "coordinates": {"lat": latitude_if_known, "lng": longitude_if_known},
    "radiusKm": 25,
    "strictLocation": true,
    "originalText": "exact location text from document"
  },
  "requirements": {
    "minSqft": minimum_square_feet_number,
    "maxSqft": maximum_square_feet_number,
    "preferredSqft": preferred_if_mentioned,
    "buildingTypes": ["Office", "Retail", "Warehouse", etc.],
    "tenancyType": "single" or "multiple",
    "floors": number_of_floors_if_specified,
    "ceilingHeight": height_if_specified
  },
  "financial": {
    "maxRatePerSqft": max_rate_per_square_foot,
    "budgetMin": minimum_budget,
    "budgetMax": maximum_budget,
    "currency": "USD"
  },
  "compliance": {
    "mustHaves": ["parking", "ADA compliance", "security", etc.],
    "niceToHaves": ["fitness center", "cafeteria", etc.],
    "governmentSpecific": ["security clearance", "GSA approval", etc.],
    "accessibilityRequirements": ["ADA features"]
  },
  "timeline": {
    "rfpDueDate": "YYYY-MM-DD or null",
    "proposalDueDate": "YYYY-MM-DD or null", 
    "occupancyDate": "YYYY-MM-DD or null",
    "leaseStartDate": "YYYY-MM-DD or null",
    "leaseTerm": "lease_duration_if_specified"
  },
  "confidence": 0.85,
  "warnings": []
}`;

    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a precise government RFP analyzer. Extract requirements with extreme accuracy. Return only valid JSON with no additional text or formatting.'
            },
            {
              role: 'user',
              content: extractionPrompt
            }
          ],
          max_tokens: 2048,
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json();
        throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorData.error?.message}`);
      }

      const openaiData = await openaiResponse.json();
      const analysis = openaiData.choices[0]?.message?.content;
      
      let parsedAnalysis;
      try {
        parsedAnalysis = JSON.parse(analysis);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', parseError);
        throw new Error('Invalid JSON response from OpenAI');
      }

      // Validate and enhance the result
      const validatedResult = validateOpenAIExtraction(parsedAnalysis, content);

      return NextResponse.json({
        analysis: validatedResult,
        confidence: validatedResult.confidence || 0.85,
        extractionMethod: 'OpenAI GPT-4',
        warnings: validatedResult.warnings || []
      });

    } catch (openaiError) {
      console.error('OpenAI extraction failed:', openaiError);
      
      return NextResponse.json(
        { error: 'OpenAI extraction failed', details: openaiError.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('OpenAI extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to process with OpenAI' },
      { status: 500 }
    );
  }
}

function validateOpenAIExtraction(analysis: any, content: string): any {
  const warnings: string[] = [...(analysis.warnings || [])];
  
  // Validate critical location data
  if (!analysis.location?.state) {
    warnings.push('No state specified - search results may be too broad');
    analysis.confidence = Math.max((analysis.confidence || 0.8) - 0.2, 0.4);
  }
  
  if (!analysis.location?.city && !analysis.location?.zipCodes?.length) {
    warnings.push('No specific city or zip codes - location matching may be imprecise');
    analysis.confidence = Math.max((analysis.confidence || 0.8) - 0.1, 0.5);
  }
  
  // Ensure strict location by default
  if (analysis.location) {
    analysis.location.strictLocation = true;
  }
  
  // Validate square footage requirements
  if (!analysis.requirements?.minSqft && !analysis.requirements?.maxSqft) {
    warnings.push('No square footage requirements found - may show irrelevant properties');
  }
  
  // Add location validation warning if no coordinates
  if (analysis.location?.city && analysis.location?.state && !analysis.location?.coordinates) {
    warnings.push('Location coordinates not available - using text-based matching only');
  }
  
  analysis.warnings = warnings;
  
  // Boost confidence if we have good location data
  if (analysis.location?.state && analysis.location?.city) {
    analysis.confidence = Math.min((analysis.confidence || 0.8) + 0.05, 1.0);
  }
  
  return analysis;
}