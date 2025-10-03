import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Perplexity AI for RFP extraction with web search validation
export async function POST(request: NextRequest) {
  try {
    const { content, filename } = await request.json();
    
    if (!content) {
      return NextResponse.json(
        { error: 'Document content is required' },
        { status: 400 }
      );
    }

    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!perplexityApiKey) {
      return NextResponse.json(
        { error: 'Perplexity API key not configured' },
        { status: 500 }
      );
    }

    // Use Perplexity's web search capabilities to validate locations
    const extractionPrompt = `
Analyze this government RFP/RLP document with extreme precision. Use your web search capabilities to validate location requirements.

CRITICAL LOCATION RULES:
- If document mentions "New York", search for and confirm this refers specifically to New York state/city
- Do NOT include neighboring states unless explicitly mentioned in the document
- Use web search to get exact coordinates for mentioned locations
- Validate that extracted locations match real places

Document excerpt: "${content.substring(0, 4000)}"

Extract and return this JSON structure with validated data:

{
  "location": {
    "city": "validated city name",
    "state": "validated state code (NY, CA, etc.)",
    "county": "county if mentioned",
    "zipCodes": ["specific zip codes from document"],
    "coordinates": {"lat": verified_latitude, "lng": verified_longitude},
    "radiusKm": radius_or_25_default,
    "strictLocation": true,
    "validationSource": "web search validation details"
  },
  "requirements": {
    "minSqft": minimum_square_feet,
    "maxSqft": maximum_square_feet,
    "buildingTypes": ["Office", "Retail", etc.],
    "tenancyType": "single_or_multiple"
  },
  "financial": {
    "maxRatePerSqft": max_rate_if_specified,
    "budgetRange": {"min": budget_min, "max": budget_max}
  },
  "compliance": {
    "mustHaves": ["required_features"],
    "governmentRequirements": ["gov_specific_needs"]
  },
  "confidence": 0.0_to_1.0,
  "warnings": ["any_concerns"]
}

Search the web to validate the location information and return only the JSON.`;

    try {
      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-large-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are a government RFP analyzer with web search capabilities. Validate all location data with web search. Return only valid JSON with no additional text.'
            },
            {
              role: 'user',
              content: extractionPrompt
            }
          ],
          max_tokens: 2048,
          temperature: 0.1,
          search_domain_filter: ["gov", "edu"],
          return_citations: true
        })
      });

      if (!perplexityResponse.ok) {
        throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
      }

      const perplexityData = await perplexityResponse.json();
      const analysis = perplexityData.choices[0]?.message?.content;
      
      let parsedAnalysis;
      try {
        // Extract JSON from response
        const jsonMatch = analysis.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedAnalysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in Perplexity response');
        }
      } catch (parseError) {
        console.error('Failed to parse Perplexity response:', parseError);
        throw parseError;
      }

      // Enhance with citations if available
      if (perplexityData.citations) {
        parsedAnalysis.validationSources = perplexityData.citations;
      }

      // Validate the extraction
      const validatedResult = validatePerplexityExtraction(parsedAnalysis, content);

      return NextResponse.json({
        analysis: validatedResult,
        confidence: validatedResult.confidence || 0.85,
        extractionMethod: 'Perplexity AI with web search',
        warnings: validatedResult.warnings || [],
        citations: perplexityData.citations || []
      });

    } catch (perplexityError) {
      console.error('Perplexity AI failed:', perplexityError);
      
      // Return error for fallback handling
      return NextResponse.json(
        { error: 'Perplexity extraction failed', details: perplexityError.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Perplexity extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to process with Perplexity' },
      { status: 500 }
    );
  }
}

function validatePerplexityExtraction(analysis: any, content: string): any {
  const warnings: string[] = [...(analysis.warnings || [])];
  
  // Additional validation for Perplexity results
  if (!analysis.location?.coordinates) {
    warnings.push('Location coordinates not validated - may affect precision');
  }
  
  if (!analysis.location?.validationSource) {
    warnings.push('Location not web-validated - relying on document text only');
  }
  
  // Ensure strict location enforcement
  if (analysis.location) {
    analysis.location.strictLocation = true;
  }
  
  // Boost confidence if web validation was successful
  if (analysis.location?.coordinates && analysis.location?.validationSource) {
    analysis.confidence = Math.min((analysis.confidence || 0.8) + 0.1, 1.0);
  }
  
  analysis.warnings = warnings;
  return analysis;
}