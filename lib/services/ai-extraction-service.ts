// AI-powered RFP extraction service with multiple fallbacks
import { RfpCriteria } from '@/lib/types';

interface LocationData {
  city?: string;
  state?: string;
  county?: string;
  zipCodes?: string[];
  specificAreas?: string[];
  coordinates?: { lat: number; lng: number };
  radiusKm?: number;
  strictLocation: boolean; // Whether location is strictly defined
}

interface ExtractionResult {
  locationData: LocationData;
  criteria: RfpCriteria;
  confidence: number;
  extractionMethod: string;
  warnings: string[];
}

export class AIExtractionService {
  private static instance: AIExtractionService;
  
  static getInstance(): AIExtractionService {
    if (!AIExtractionService.instance) {
      AIExtractionService.instance = new AIExtractionService();
    }
    return AIExtractionService.instance;
  }

  async extractRFPRequirements(
    documentContent: string, 
    filename: string
  ): Promise<ExtractionResult> {
    const warnings: string[] = [];
    
    // Try multiple AI services in order of preference
    let result = await this.tryPerplexityAI(documentContent, filename);
    
    if (result.confidence < 0.6) {
      warnings.push('AI confidence still low, trying OpenAI...');
      const openaiResult = await this.tryOpenAI(documentContent, filename);
      if (openaiResult.confidence > result.confidence) {
        result = openaiResult;
      }
    }
    
    // Validate and enhance location data
    result = await this.validateAndEnhanceLocation(result);
    
    // Add warnings to result
    result.warnings = [...result.warnings, ...warnings];
    
    return result;
  }


  private async tryPerplexityAI(content: string, filename: string): Promise<ExtractionResult> {
    try {
      const response = await fetch('/api/ai/perplexity-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename })
      });

      if (response.ok) {
        const data = await response.json();
        return this.parseAIResponse(data, 'Perplexity AI');
      }
    } catch (error) {
      console.error('Perplexity AI failed:', error);
    }
    
    return this.getFallbackResult(content, filename);
  }

  private async tryOpenAI(content: string, filename: string): Promise<ExtractionResult> {
    try {
      const response = await fetch('/api/ai/openai-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename })
      });

      if (response.ok) {
        const data = await response.json();
        return this.parseAIResponse(data, 'OpenAI');
      }
    } catch (error) {
      console.error('OpenAI failed:', error);
    }
    
    return this.getFallbackResult(content, filename);
  }

  private parseAIResponse(data: any, method: string): ExtractionResult {
    const analysis = typeof data.analysis === 'string' ? JSON.parse(data.analysis) : data.analysis;
    
    return {
      locationData: {
        city: analysis.location?.city,
        state: analysis.location?.state,
        county: analysis.location?.county,
        zipCodes: analysis.location?.zipCodes || [],
        specificAreas: analysis.location?.specificAreas || [],
        coordinates: analysis.location?.coordinates,
        radiusKm: analysis.location?.radiusKm || 25,
        strictLocation: analysis.location?.strictLocation !== false // Default to strict
      },
      criteria: {
        locationText: analysis.locationText || '',
        center: analysis.location?.coordinates || { lng: -98.5795, lat: 39.8283 },
        radiusKm: analysis.location?.radiusKm || 25,
        minSqft: analysis.minSqft || 0,
        maxSqft: analysis.maxSqft || 999999,
        leaseType: analysis.leaseType || 'full-service',
        buildingTypes: analysis.buildingTypes || ['Office'],
        tenancyType: analysis.tenancyType || 'single',
        maxRatePerSqft: analysis.maxRatePerSqft,
        mustHaves: analysis.mustHaves || [],
        niceToHaves: analysis.niceToHaves || [],
        notes: analysis.notes || ''
      },
      confidence: data.confidence || 0.8,
      extractionMethod: method,
      warnings: data.warnings || []
    };
  }

  private async validateAndEnhanceLocation(result: ExtractionResult): Promise<ExtractionResult> {
    // Use web search to validate and enhance location data
    if (result.locationData.city || result.locationData.state) {
      try {
        const locationQuery = `${result.locationData.city || ''} ${result.locationData.state || ''}`.trim();
        const geoData = await this.searchLocationData(locationQuery);
        
        if (geoData) {
          result.locationData.coordinates = geoData.coordinates;
          result.locationData.county = geoData.county;
          result.confidence = Math.min(result.confidence + 0.1, 1.0);
        }
      } catch (error) {
        result.warnings.push('Could not validate location data with web search');
      }
    }
    
    return result;
  }

  private async searchLocationData(locationQuery: string): Promise<{ coordinates: { lat: number; lng: number }; county?: string } | null> {
    try {
      // Try geocoding service first
      const geocodeResponse = await fetch(`/api/geocode?q=${encodeURIComponent(locationQuery)}`);
      if (geocodeResponse.ok) {
        const data = await geocodeResponse.json();
        return data;
      }
      
      // Fallback to web search
      const searchResponse = await fetch('/api/ai/location-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: locationQuery })
      });
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        return searchData;
      }
    } catch (error) {
      console.error('Location search failed:', error);
    }
    
    return null;
  }

  private getFallbackResult(content: string, filename: string): ExtractionResult {
    // Pattern-based extraction as ultimate fallback
    const locationMatch = this.extractLocationPatterns(content);
    const sizeMatch = this.extractSizePatterns(content);
    
    return {
      locationData: {
        city: locationMatch.city,
        state: locationMatch.state,
        strictLocation: true
      },
      criteria: {
        locationText: locationMatch.text || 'Location not specified',
        center: { lng: -98.5795, lat: 39.8283 },
        radiusKm: 25,
        minSqft: sizeMatch.min || 1000,
        maxSqft: sizeMatch.max || 10000,
        leaseType: 'full-service',
        buildingTypes: ['Office'],
        tenancyType: 'single',
        mustHaves: [],
        niceToHaves: [],
        notes: `Fallback extraction from ${filename}`
      },
      confidence: 0.5,
      extractionMethod: 'Pattern-based fallback',
      warnings: ['Low confidence extraction - manual review recommended']
    };
  }

  private extractLocationPatterns(content: string): { city?: string; state?: string; text?: string } {
    // Enhanced pattern matching for locations
    const stateMatch = content.match(/\b([A-Z]{2})\b/g);
    const cityStateMatch = content.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*),?\s*([A-Z]{2})/);
    const fullLocationMatch = content.match(/(in|near|around|within)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)*),?\s*([A-Z]{2})/i);
    
    return {
      city: cityStateMatch?.[1] || fullLocationMatch?.[2],
      state: cityStateMatch?.[2] || fullLocationMatch?.[3] || stateMatch?.[0],
      text: fullLocationMatch?.[0] || cityStateMatch?.[0]
    };
  }

  private extractSizePatterns(content: string): { min?: number; max?: number } {
    const sqftMatches = content.match(/([\d,]+)\s*(?:to|-)?\s*([\d,]+)?\s*(?:square feet|sq\.?\s*ft\.?|sf)/gi);
    if (sqftMatches) {
      const numbers = sqftMatches.flatMap(match => 
        match.match(/[\d,]+/g)?.map(n => parseInt(n.replace(/,/g, ''))) || []
      ).sort((a, b) => a - b);
      
      return {
        min: numbers[0],
        max: numbers[numbers.length - 1] || numbers[0]
      };
    }
    
    return {};
  }
}

export const aiExtractionService = AIExtractionService.getInstance();