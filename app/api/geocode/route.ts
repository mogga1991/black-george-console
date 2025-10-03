import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Geocoding service for location validation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter required' },
        { status: 400 }
      );
    }

    // Try multiple geocoding services for accuracy
    let result = await tryNominatimGeocoding(query);
    
    if (!result) {
      // Fallback to another service if available
      result = await tryMapboxGeocoding(query);
    }
    
    if (!result) {
      // Final fallback to a simpler service
      result = await tryOpenStreetMapGeocoding(query);
    }

    if (result) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json(
      { error: 'Geocoding service failed' },
      { status: 500 }
    );
  }
}

async function tryNominatimGeocoding(query: string): Promise<any> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=1&countrycodes=us&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CRE-Console/1.0'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        return {
          coordinates: {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon)
          },
          address: result.display_name,
          city: result.address?.city || result.address?.town || result.address?.village,
          state: result.address?.state,
          county: result.address?.county,
          zipCode: result.address?.postcode,
          confidence: parseFloat(result.importance || '0.8'),
          source: 'Nominatim OSM'
        };
      }
    }
  } catch (error) {
    console.error('Nominatim geocoding failed:', error);
  }
  return null;
}

async function tryMapboxGeocoding(query: string): Promise<any> {
  try {
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) return null;

    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxToken}&country=us&limit=1&types=place,locality,address`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const [lng, lat] = feature.center;
        
        // Extract location components
        const context = feature.context || [];
        const place = context.find((c: any) => c.id.startsWith('place'));
        const region = context.find((c: any) => c.id.startsWith('region'));
        const postcode = context.find((c: any) => c.id.startsWith('postcode'));

        return {
          coordinates: { lat, lng },
          address: feature.place_name,
          city: place?.text || feature.text,
          state: region?.short_code?.replace('US-', ''),
          zipCode: postcode?.text,
          confidence: feature.relevance || 0.8,
          source: 'Mapbox'
        };
      }
    }
  } catch (error) {
    console.error('Mapbox geocoding failed:', error);
  }
  return null;
}

async function tryOpenStreetMapGeocoding(query: string): Promise<any> {
  try {
    // This is a simplified geocoding using a basic location lookup
    // You could implement additional services here
    const stateAbbreviations: { [key: string]: { lat: number; lng: number } } = {
      'NY': { lat: 40.7128, lng: -74.0060 },
      'CA': { lat: 34.0522, lng: -118.2437 },
      'TX': { lat: 31.9686, lng: -99.9018 },
      'FL': { lat: 27.6648, lng: -81.5158 },
      'IL': { lat: 40.3363, lng: -89.0022 },
      'PA': { lat: 40.5908, lng: -77.2098 },
      'OH': { lat: 40.3888, lng: -82.7649 },
      'GA': { lat: 33.76, lng: -84.39 },
      'NC': { lat: 35.771, lng: -78.638 },
      'MI': { lat: 43.3266, lng: -84.5361 }
    };

    // Try to match state abbreviation
    const stateMatch = query.match(/\b([A-Z]{2})\b/);
    if (stateMatch && stateAbbreviations[stateMatch[1]]) {
      const coords = stateAbbreviations[stateMatch[1]];
      return {
        coordinates: coords,
        address: query,
        state: stateMatch[1],
        confidence: 0.6,
        source: 'Basic state lookup'
      };
    }
  } catch (error) {
    console.error('Basic geocoding failed:', error);
  }
  return null;
}