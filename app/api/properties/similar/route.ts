import { NextRequest, NextResponse } from 'next/server';
import { propertyEmbeddingService } from '@/lib/services/property-embedding-service';
import { createClient } from '@/lib/supabase/client';

export const runtime = 'edge';

// Find similar properties using TensorFlow.js embeddings
export async function POST(request: NextRequest) {
  try {
    const { propertyId, limit = 10, includeEmbeddingStats = false } = await request.json();
    
    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Finding similar properties for property ${propertyId} using TensorFlow.js...`);

    // Get the target property
    const supabase = createClient();
    const { data: targetProperty, error: targetError } = await supabase
      .from('cre_properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (targetError || !targetProperty) {
      return NextResponse.json(
        { error: 'Target property not found' },
        { status: 404 }
      );
    }

    // Get candidate properties (excluding the target)
    const { data: candidateProperties, error: candidatesError } = await supabase
      .from('cre_properties')
      .select('*')
      .neq('id', propertyId)
      .limit(100); // Limit for performance

    if (candidatesError) {
      console.error('Error fetching candidate properties:', candidatesError);
      return NextResponse.json(
        { error: 'Failed to fetch candidate properties' },
        { status: 500 }
      );
    }

    // Initialize the embedding service
    await propertyEmbeddingService.initialize();

    // Find similar properties using TensorFlow embeddings
    const similarProperties = await propertyEmbeddingService.findSimilarProperties(
      targetProperty,
      candidateProperties || [],
      limit
    );

    // Format response
    const response: any = {
      targetProperty: {
        id: targetProperty.id,
        address: targetProperty.address,
        city: targetProperty.city,
        state: targetProperty.state,
        buildingTypes: targetProperty.building_types,
        squareFootage: targetProperty.square_footage
      },
      similarProperties: similarProperties.map(sim => ({
        property: {
          id: sim.property.id,
          address: sim.property.address,
          city: sim.property.city,
          state: sim.property.state,
          buildingTypes: sim.property.building_types,
          squareFootage: sim.property.square_footage,
          ratePerSqft: sim.property.rate_per_sqft,
          rateText: sim.property.rate_text,
          coordinates: sim.property.latitude && sim.property.longitude ? {
            lat: sim.property.latitude,
            lng: sim.property.longitude
          } : null
        },
        similarity: Math.round(sim.similarity * 100), // Convert to percentage
        similarityBreakdown: {
          location: Math.round(sim.similarityBreakdown.location * 100),
          size: Math.round(sim.similarityBreakdown.size * 100),
          type: Math.round(sim.similarityBreakdown.type * 100),
          amenities: Math.round(sim.similarityBreakdown.amenities * 100),
          financial: Math.round(sim.similarityBreakdown.financial * 100),
          government: Math.round(sim.similarityBreakdown.government * 100)
        }
      })),
      totalCandidates: candidateProperties?.length || 0,
      processingTime: Date.now() - Date.now(), // Placeholder
      mlMethod: 'TensorFlow.js Neural Network Embeddings'
    };

    // Include embedding service stats if requested
    if (includeEmbeddingStats) {
      response.embeddingStats = propertyEmbeddingService.getEmbeddingStats();
    }

    console.log(`✅ Found ${similarProperties.length} similar properties with average similarity ${
      similarProperties.length > 0 
        ? Math.round(similarProperties.reduce((sum, p) => sum + p.similarity, 0) / similarProperties.length * 100)
        : 0
    }%`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('🚨 Property similarity error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to find similar properties',
        details: error.message,
        suggestion: 'The TensorFlow.js model may be initializing. Please try again.'
      },
      { status: 500 }
    );
  }
}

// Enhanced search ranking endpoint
export async function PUT(request: NextRequest) {
  try {
    const { properties, searchCriteria, includeEmbeddingStats = false } = await request.json();
    
    if (!properties || !Array.isArray(properties)) {
      return NextResponse.json(
        { error: 'Properties array is required' },
        { status: 400 }
      );
    }

    console.log(`🎯 Enhancing search ranking for ${properties.length} properties using ML...`);

    // Initialize the embedding service
    await propertyEmbeddingService.initialize();

    // Enhance ranking using TensorFlow embeddings
    const rankedProperties = await propertyEmbeddingService.enhanceSearchRanking(
      properties,
      searchCriteria || {}
    );

    const response: any = {
      rankedProperties: rankedProperties.map((property, index) => ({
        ...property,
        mlRank: index + 1,
        originalRank: properties.findIndex(p => p.id === property.id) + 1
      })),
      originalCount: properties.length,
      rerankedCount: rankedProperties.length,
      improvementMetrics: {
        positionChanges: rankedProperties.reduce((changes, property, newIndex) => {
          const originalIndex = properties.findIndex(p => p.id === property.id);
          const positionChange = originalIndex - newIndex;
          changes.push({
            propertyId: property.id,
            originalPosition: originalIndex + 1,
            newPosition: newIndex + 1,
            positionChange
          });
          return changes;
        }, [] as any[])
      },
      mlMethod: 'TensorFlow.js Neural Network Ranking'
    };

    // Include embedding service stats if requested
    if (includeEmbeddingStats) {
      response.embeddingStats = propertyEmbeddingService.getEmbeddingStats();
    }

    console.log(`✅ ML ranking completed. Average position change: ${
      Math.abs(response.improvementMetrics.positionChanges.reduce((sum: number, change: any) => 
        sum + change.positionChange, 0) / rankedProperties.length)
    }`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('🚨 Enhanced search ranking error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to enhance search ranking',
        details: error.message,
        suggestion: 'The TensorFlow.js model may be initializing. Please try again.'
      },
      { status: 500 }
    );
  }
}

// Get embedding service health and stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'health') {
      const stats = propertyEmbeddingService.getEmbeddingStats();
      
      return NextResponse.json({
        status: 'healthy',
        tensorflowBackend: stats.tfBackend,
        modelInitialized: stats.modelInitialized,
        embeddingsCached: stats.totalEmbeddings,
        memoryUsage: stats.memoryUsage,
        features: [
          'Property similarity matching',
          'Neural network embeddings', 
          'Enhanced search ranking',
          'Real-time ML inference'
        ]
      });
    }

    if (action === 'cleanup') {
      const cleared = propertyEmbeddingService.clearOldEmbeddings();
      return NextResponse.json({
        message: `Cleared ${cleared} old embeddings`,
        remainingEmbeddings: propertyEmbeddingService.getEmbeddingStats().totalEmbeddings
      });
    }

    return NextResponse.json({
      message: 'Property similarity API powered by TensorFlow.js',
      endpoints: {
        'POST /api/properties/similar': 'Find similar properties using ML',
        'PUT /api/properties/similar': 'Enhanced search ranking using ML',
        'GET /api/properties/similar?action=health': 'Service health check',
        'GET /api/properties/similar?action=cleanup': 'Clear old embeddings'
      },
      example: {
        findSimilar: {
          propertyId: 'property-uuid',
          limit: 10,
          includeEmbeddingStats: false
        },
        enhanceRanking: {
          properties: ['array of properties'],
          searchCriteria: { locationText: 'New York', minSqft: 5000 },
          includeEmbeddingStats: false
        }
      }
    });

  } catch (error) {
    console.error('🚨 API health check error:', error);
    return NextResponse.json(
      { error: 'Service health check failed', details: error.message },
      { status: 500 }
    );
  }
}