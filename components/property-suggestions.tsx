'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, MapPin, Building, DollarSign, Zap } from 'lucide-react';

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  buildingTypes: string[];
  squareFootage?: number;
  ratePerSqft?: number;
  rateText?: string;
  coordinates?: { lat: number; lng: number };
}

interface SimilarProperty {
  property: Property;
  similarity: number;
  similarityBreakdown: {
    location: number;
    size: number;
    type: number;
    amenities: number;
    financial: number;
    government: number;
  };
}

interface PropertySuggestionsProps {
  targetProperty: Property;
  onPropertySelect?: (property: Property) => void;
  onViewOnMap?: (property: Property) => void;
}

export function PropertySuggestions({ 
  targetProperty, 
  onPropertySelect, 
  onViewOnMap 
}: PropertySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SimilarProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mlStats, setMlStats] = useState<any>(null);

  useEffect(() => {
    if (targetProperty) {
      findSimilarProperties();
    }
  }, [targetProperty]);

  const findSimilarProperties = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Finding AI-powered property suggestions...');

      const response = await fetch('/api/properties/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: targetProperty.id,
          limit: 6,
          includeEmbeddingStats: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch similar properties');
      }

      const data = await response.json();
      setSuggestions(data.similarProperties || []);
      setMlStats(data.embeddingStats);

      console.log(`✅ Found ${data.similarProperties?.length || 0} AI-powered suggestions`);

    } catch (err) {
      console.error('Property suggestions error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 80) return 'bg-green-500';
    if (similarity >= 60) return 'bg-yellow-500';
    if (similarity >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getSimilarityLabel = (similarity: number): string => {
    if (similarity >= 80) return 'Excellent Match';
    if (similarity >= 60) return 'Good Match';
    if (similarity >= 40) return 'Fair Match';
    return 'Weak Match';
  };

  const getTopSimilarityFeature = (breakdown: any): string => {
    const features = Object.entries(breakdown) as [string, number][];
    const topFeature = features.reduce((max, current) => 
      current[1] > max[1] ? current : max
    );
    
    const featureNames: { [key: string]: string } = {
      location: 'Location',
      size: 'Size',
      type: 'Building Type', 
      amenities: 'Amenities',
      financial: 'Pricing',
      government: 'Gov Suitability'
    };
    
    return featureNames[topFeature[0]] || topFeature[0];
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI-Powered Property Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-gray-600">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span>Finding similar properties using TensorFlow.js...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Sparkles className="h-5 w-5" />
            AI Suggestions Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 text-sm mb-3">{error}</p>
          <Button 
            onClick={findSimilarProperties}
            variant="outline"
            size="sm"
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            Retry AI Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI-Powered Property Suggestions
            <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
              <Zap className="h-3 w-3 mr-1" />
              TensorFlow.js
            </Badge>
          </CardTitle>
          {mlStats && (
            <div className="text-xs text-gray-500">
              Backend: {mlStats.tfBackend} • Cached: {mlStats.totalEmbeddings}
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600">
          Properties similar to <strong>{targetProperty.address}</strong> using neural network analysis
        </p>
      </CardHeader>
      
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Building className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No similar properties found in the current database.</p>
            <p className="text-xs mt-1">Try expanding search criteria or add more properties to improve suggestions.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <div 
                key={suggestion.property.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">
                      {suggestion.property.address}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {suggestion.property.city}, {suggestion.property.state}
                      </span>
                      {suggestion.property.squareFootage && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {suggestion.property.squareFootage.toLocaleString()} sq ft
                        </span>
                      )}
                      {suggestion.property.ratePerSqft && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${suggestion.property.ratePerSqft}/sq ft
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className={`w-3 h-3 rounded-full ${getSimilarityColor(suggestion.similarity)}`}
                      ></div>
                      <span className="text-sm font-medium">
                        {suggestion.similarity}% Match
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {getSimilarityLabel(suggestion.similarity)}
                    </div>
                  </div>
                </div>

                {/* Building Types */}
                <div className="flex items-center gap-2 mb-3">
                  {suggestion.property.buildingTypes?.map((type, idx) => (
                    <Badge 
                      key={idx} 
                      variant="secondary" 
                      className="text-xs bg-gray-100"
                    >
                      {type}
                    </Badge>
                  ))}
                </div>

                {/* Similarity Breakdown */}
                <div className="mb-3">
                  <div className="text-xs text-gray-600 mb-2">
                    Strongest similarity: <strong>{getTopSimilarityFeature(suggestion.similarityBreakdown)}</strong> ({Math.max(...Object.values(suggestion.similarityBreakdown))}%)
                  </div>
                  <div className="grid grid-cols-6 gap-1 text-xs">
                    {Object.entries(suggestion.similarityBreakdown).map(([feature, score]) => (
                      <div key={feature} className="text-center">
                        <div className="text-gray-500 capitalize mb-1">
                          {feature === 'government' ? 'Gov' : feature.charAt(0).toUpperCase() + feature.slice(1, 3)}
                        </div>
                        <div className={`text-xs font-medium ${
                          score >= 70 ? 'text-green-600' : 
                          score >= 50 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {score}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPropertySelect?.(suggestion.property)}
                    className="flex-1"
                  >
                    View Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewOnMap?.(suggestion.property)}
                    className="flex-1"
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    View on Map
                  </Button>
                </div>
              </div>
            ))}
            
            {/* ML Performance Info */}
            <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 text-blue-700 text-sm font-medium mb-1">
                <TrendingUp className="h-4 w-4" />
                AI Analysis Performance
              </div>
              <div className="text-xs text-blue-600">
                Neural network embeddings analyzed {suggestions.length} properties using location, size, type, amenities, financial, and government suitability vectors.
                {mlStats && (
                  <span className="block mt-1">
                    Memory usage: {Math.round(mlStats.memoryUsage?.numBytes / 1024 / 1024 || 0)}MB • 
                    Backend: {mlStats.tfBackend}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}