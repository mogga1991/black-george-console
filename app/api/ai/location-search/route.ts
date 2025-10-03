import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Web search for location validation using multiple sources
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Try multiple search approaches
    let result = await searchWithPerplexity(query);
    
    if (!result || result.confidence < 0.7) {
      // Fallback to Bing search if available
      const bingResult = await searchWithBing(query);
      if (bingResult && bingResult.confidence > (result?.confidence || 0)) {
        result = bingResult;
      }
    }

    if (result) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: 'Location validation failed' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Location search error:', error);
    return NextResponse.json(
      { error: 'Location search service failed' },
      { status: 500 }
    );
  }
}

async function searchWithPerplexity(locationQuery: string): Promise<any> {
  try {
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    if (!perplexityApiKey) return null;

    const searchPrompt = `
Find the exact geographic coordinates and administrative details for: "${locationQuery}"

Return ONLY this JSON format:
{
  "coordinates": {"lat": latitude_number, "lng": longitude_number},
  "city": "official_city_name",
  "state": "state_abbreviation", 
  "county": "county_name",
  "zipCodes": ["primary_zip_codes"],
  "confidence": 0.0_to_1.0,
  "validated": true,
  "source": "source_of_information"
}

Search for official government or geographic sources to ensure accuracy.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a geographic location validator. Return only valid JSON with accurate coordinates and location data.'
          },
          {
            role: 'user',
            content: searchPrompt
          }
        ],
        max_tokens: 1024,
        temperature: 0.1,
        search_domain_filter: ["gov", "edu", "org"]
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            ...parsed,
            searchMethod: 'Perplexity web search'
          };
        }
      } catch (parseError) {
        console.error('Failed to parse Perplexity location search:', parseError);
      }
    }
  } catch (error) {
    console.error('Perplexity location search failed:', error);
  }
  return null;
}

async function searchWithBing(locationQuery: string): Promise<any> {
  try {
    const bingApiKey = process.env.BING_SEARCH_API_KEY;
    if (!bingApiKey) return null;

    // Search for location information
    const searchUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(locationQuery + ' coordinates city state')}&count=5`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': bingApiKey
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      // Process search results to extract location data
      if (data.webPages?.value?.length > 0) {
        const topResults = data.webPages.value.slice(0, 3);
        
        // Look for coordinate patterns in results
        for (const result of topResults) {
          const text = `${result.name} ${result.snippet}`;
          const coordMatch = text.match(/(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)/);
          
          if (coordMatch) {
            const lat = parseFloat(coordMatch[1]);
            const lng = parseFloat(coordMatch[2]);
            
            // Validate coordinates are reasonable for US
            if (lat >= 24 && lat <= 71 && lng >= -179 && lng <= -66) {
              // Extract location components from the query
              const stateMatch = locationQuery.match(/\b([A-Z]{2})\b/);
              const cityMatch = locationQuery.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*)/);
              
              return {
                coordinates: { lat, lng },
                city: cityMatch?.[1],
                state: stateMatch?.[1],
                confidence: 0.7,
                validated: true,
                source: 'Bing search results',
                searchMethod: 'Bing web search'
              };
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Bing location search failed:', error);
  }
  return null;
}